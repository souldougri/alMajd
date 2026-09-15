import { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { composeNotification, fetchComposedNotifications, type ComposedNotification, type NotificationTarget, type NotificationType } from "@/lib/notifications";
import { getUsers } from "@/lib/auth/users";
import type { SafeUser } from "@/lib/auth/types";
import { useSchool } from "@/lib/store";
import { formatPrintDate } from "@/lib/print";

const TARGET_LABELS: Record<NotificationTarget, string> = {
  all_students: "كل الطلاب",
  all_teachers: "كل الأساتذة",
  all_staff: "كل الطاقم (الإدارة)",
  one_class: "فصل محدد",
  one_staff: "موظف محدد",
  one_teacher: "أستاذ محدد",
  one_student: "طالب محدد",
};

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: "general", label: "عام" },
  { value: "fees", label: "الرسوم الدراسية" },
  { value: "exam", label: "الامتحانات" },
  { value: "news", label: "أخبار" },
];

const TARGET_OPTIONS: NotificationTarget[] = [
  "all_students",
  "all_teachers",
  "all_staff",
  "one_class",
  "one_staff",
  "one_teacher",
  "one_student",
];

const STAFF_TARGETS: NotificationTarget[] = ["one_staff"];
const TEACHER_TARGETS: NotificationTarget[] = ["one_teacher"];
const STUDENT_TARGETS: NotificationTarget[] = ["one_student"];

export function NotificationsComposer() {
  const classes = useSchool((s) => s.classes);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("general");
  const [target, setTarget] = useState<NotificationTarget>("all_staff");
  const [userId, setUserId] = useState("");
  const [classId, setClassId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [history, setHistory] = useState<ComposedNotification[]>([]);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
    fetchComposedNotifications().then((result) => setHistory(result.items));
  }, []);

  const staffUsers = useMemo(() => users.filter((u) => u.role === "staff" || u.role === "super_admin"), [users]);
  const teacherUsers = useMemo(() => users.filter((u) => u.role === "teacher"), [users]);
  const studentUsers = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  async function submit() {
    setSending(true);
    setError(null);
    setSent(false);
    const result = await composeNotification({ title, body, type, target, userId: userId || undefined, classId: classId || undefined });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setBody("");
    setUserId("");
    setClassId("");
    setSent(true);
    setHistory((prev) => (result.notification ? [result.notification, ...prev] : prev));
  }

  const needUser =
    STAFF_TARGETS.includes(target) || TEACHER_TARGETS.includes(target) || STUDENT_TARGETS.includes(target);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">الإشعارات</h1>
        <p className="mt-1 text-sm text-navy/60">
          تُرسل الإشعارات داخل التطبيق وتظهر في جرس الإشعارات للأساتذة والطلاب والطاقم الإداري.
        </p>
      </div>

      <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-navy">إرسال إشعار</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">
              العنوان <span className="text-danger">*</span>
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">النص</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-xl border border-navy/15 bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">النوع</span>
              <select value={type} onChange={(e) => setType(e.target.value as NotificationType)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm">
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">المستلمون</span>
              <select value={target} onChange={(e) => setTarget(e.target.value as NotificationTarget)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm">
                {TARGET_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TARGET_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {target === "one_class" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">اختر الفصل</span>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm">
                <option value="">— اختر الفصل —</option>
                {classes
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          {needUser ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">اختر المستلم</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm">
                <option value="">— اختر المستلم —</option>
                {STAFF_TARGETS.includes(target)
                  ? staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nameAr} ({u.email})
                      </option>
                    ))
                  : TEACHER_TARGETS.includes(target)
                    ? teacherUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nameAr} ({u.email})
                        </option>
                      ))
                    : studentUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nameAr} ({u.email})
                        </option>
                      ))}
              </select>
            </label>
          ) : null}

          {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
          {sent ? <p className="text-xs font-semibold text-success">تم إرسال الإشعار بنجاح.</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={sending || !title.trim()}
            className="flex h-11 items-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-gold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? "جارٍ الإرسال..." : "إرسال الإشعار"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-navy/10 bg-white shadow-sm">
        <div className="border-b border-navy/10 px-5 py-3">
          <h2 className="font-bold text-navy">الإشعارات المرسلة</h2>
        </div>
        {history.length === 0 ? (
          <p className="py-10 text-center text-sm text-navy/50">لا توجد إشعارات مرسلة بعد.</p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {history.map((n) => (
              <li key={n.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-navy">{n.title}</p>
                  <span className="text-xs text-navy/45">{formatPrintDate(n.createdAt.slice(0, 10))}</span>
                </div>
                {n.body ? <p className="mt-1 whitespace-pre-line text-sm text-navy/65">{n.body}</p> : null}
                <p className="mt-1 text-xs text-navy/45">
                  {TARGET_LABELS[n.target] ?? n.target}
                  {n.classId ? ` · ${classes.find((c) => c.id === n.classId)?.nameAr ?? ""}` : ""}
                  {n.recipientName ? ` · ${n.recipientName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}