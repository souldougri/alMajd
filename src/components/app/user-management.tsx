import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { createUser, editUser, getUsers, removeUser, resetUserPassword, toggleUserActive } from "@/lib/auth/users";
import { migrateLegacyUsers } from "@/lib/auth/migrate";
import { DUTY_LABELS, ROLE_LABELS, type Role, type SafeUser, type StaffDuty } from "@/lib/auth/types";
import { useAuth } from "@/lib/auth/store";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";
const labelCls = "mb-1 block text-sm font-semibold text-navy";

type FormState = {
  nameAr: string;
  nameEn: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
  studentId: string;
  duties: StaffDuty[];
};

const emptyForm: FormState = {
  nameAr: "",
  nameEn: "",
  email: "",
  role: "staff",
  active: true,
  password: "",
  studentId: "",
  duties: [],
};

export function UserManagement() {
  const actor = useAuth((s) => s.currentUser);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState<SafeUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await migrateLegacyUsers();
      await refresh();
    })();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setMode("create");
    setError("");
    setMessage("");
  }

  function openEdit(u: SafeUser) {
    setForm({
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      email: u.email,
      role: u.role,
      active: u.active,
      password: "",
      studentId: u.studentId ?? "",
      duties: u.duties ?? [],
    });
    setEditingId(u.id);
    setMode("edit");
    setError("");
    setMessage("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!form.nameAr.trim() || !form.email.trim()) {
      setError("يرجى ملء الاسم والبريد الإلكتروني");
      return;
    }
    if (!actor) return;
    try {
      if (mode === "create") {
        if (!form.password.trim()) {
          setError("يرجى تحديد كلمة مرور أولية");
          return;
        }
        await createUser(
          {
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim() || form.nameAr.trim(),
            email: form.email.trim(),
            role: form.role,
            active: form.active,
            initialPassword: form.password,
            studentId: form.studentId || undefined,
            duties: form.duties,
          },
          actor,
        );
        setMessage("تم إنشاء الحساب بنجاح");
      } else if (editingId) {
        const updates: {
          nameAr: string;
          nameEn: string;
          email: string;
          role: Role;
          active: boolean;
          studentId?: string | null;
          duties?: StaffDuty[] | null;
        } = {
          nameAr: form.nameAr.trim(),
          nameEn: form.nameEn.trim() || form.nameAr.trim(),
          email: form.email.trim(),
          role: form.role,
          active: form.active,
        };
        if (form.role === "student") updates.studentId = form.studentId || null;
        if (form.role === "staff") updates.duties = form.duties;
        await editUser(editingId, updates, actor);
        setMessage("تم تحديث الحساب بنجاح");
      }
      setMode(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء حفظ الحساب");
    }
  }

  async function handleToggle(u: SafeUser) {
    if (!actor) return;
    try {
      await toggleUserActive(u.id, !u.active, actor);
      setMessage(u.active ? `تم تعطيل حساب ${u.nameAr}` : `تم تفعيل حساب ${u.nameAr}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function handleDelete(u: SafeUser) {
    if (!actor) return;
    const ok = window.confirm(`هل أنت متأكد من حذف حساب ${u.nameAr}؟`);
    if (!ok) return;
    try {
      await removeUser(u.id, actor);
      setMessage(`تم حذف حساب ${u.nameAr}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!resetTarget || !actor || !resetPassword.trim()) return;
    try {
      await resetUserPassword(resetTarget.id, resetPassword, actor);
      setMessage(`تمت إعادة تعيين كلمة مرور ${resetTarget.nameAr}`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-navy">إدارة المستخدمين</h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          حساب جديد
        </button>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-medium text-navy">{message}</div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</div>
      ) : null}

      <div className="am-table-wrap">
        <table className="am-table min-w-[560px]">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th className="text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-navy/50">
                  جارٍ تحميل المستخدمين…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-cream">
                  <td>
                    <p className="font-bold text-navy">{u.nameAr}</p>
                    <p className="text-xs text-navy/55">{u.nameEn}</p>
                  </td>
                  <td className="text-navy/75" dir="ltr">{u.email}</td>
                  <td>
                    <span className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-gold">
                      {ROLE_LABELS[u.role]?.ar ?? u.role}
                    </span>
                    {u.role === "staff" ? (
                      u.duties && u.duties.length > 0 ? (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {u.duties.map((d) => (
                            <span key={d} className="rounded-full bg-cream-subtle px-2 py-0.5 text-[11px] font-medium text-navy/70">
                              {DUTY_LABELS[d].ar}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-navy/45">لا توجد اختصاصات</p>
                      )
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.active
                          ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
                          : "rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"
                      }
                    >
                      {u.active ? "نشط" : "معطّل"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-1 sm:flex sm:items-center sm:justify-center sm:gap-1">
                      <button type="button" title="تعديل" aria-label={`تعديل ${u.nameAr}`} className="flex size-11 items-center justify-center rounded-lg text-navy/60 hover:bg-navy hover:text-gold" onClick={() => openEdit(u)}>
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" title="إعادة تعيين كلمة المرور" aria-label={`إعادة تعيين كلمة مرور ${u.nameAr}`} className="flex size-11 items-center justify-center rounded-lg text-navy/60 hover:bg-navy hover:text-gold" onClick={() => setResetTarget(u)}>
                        <KeyRound className="size-4" />
                      </button>
                      <button
                        type="button"
                        title={u.active ? "تعطيل" : "تفعيل"}
                        aria-label={`${u.active ? "تعطيل" : "تفعيل"} ${u.nameAr}`}
                        className="flex size-11 items-center justify-center rounded-lg text-navy/60 hover:bg-navy hover:text-gold"
                        onClick={() => handleToggle(u)}
                      >
                        {u.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                      </button>
                      <button type="button" title="حذف" aria-label={`حذف ${u.nameAr}`} className="flex size-11 items-center justify-center rounded-lg text-danger/70 hover:bg-danger hover:text-white" onClick={() => handleDelete(u)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode ? (
        <Modal open={Boolean(mode)} onClose={() => setMode(null)} size="md">
          <ModalHeader>
            <h3 className="font-display text-xl font-bold text-navy">
              {mode === "create" ? "إنشاء حساب جديد" : "تعديل الحساب"}
            </h3>
          </ModalHeader>
          <ModalContent>
            <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>الاسم بالعربية *</label>
                <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>الاسم باللاتينية</label>
                <input className={inputCls} dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>البريد الإلكتروني *</label>
                <input className={inputCls} dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>الدور</label>
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {(Object.keys(ROLE_LABELS) as Role[])
                    .filter((r) => mode !== "create" || r !== "student")
                    .map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r].ar}
                      </option>
                    ))}
                </select>
                {mode === "create" ? (
                  <p className="mt-1 text-xs text-navy/55">
                    يتم إنشاء حسابات الطلاب من وحدة التسجيل (أمين السجل) مع اسم مستخدم وكلمة مرور تلقائيين.
                  </p>
                ) : null}
              </div>
              {form.role === "staff" ? (
                <div>
                  <label className={labelCls}>اختصاصات الموظف (يمكن الاختيار المتعدد)</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(DUTY_LABELS) as StaffDuty[]).map((d) => (
                      <label
                        key={d}
                        className="flex cursor-pointer items-start gap-2 rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy transition-colors hover:border-gold"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.duties.includes(d)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              duties: e.target.checked
                                ? [...form.duties, d]
                                : form.duties.filter((x) => x !== d),
                            })
                          }
                        />
                        <span>
                          <span className="block font-semibold">{DUTY_LABELS[d].ar}</span>
                          <span className="block text-xs text-navy/50">{DUTY_LABELS[d].fr}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-navy/55">
                    بدون اختصاص، لن يرى الموظف أي وحدة في نظام المدرسة حتى يتم تحديدها.
                  </p>
                </div>
              ) : null}
              {mode === "create" ? (
                <div>
                  <label className={labelCls}>كلمة المرور الأولية *</label>
                  <input className={inputCls} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  الحساب نشط
                </label>
              )}
              {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
            </form>
          </ModalContent>
          <ModalFooter>
            <button type="button" className="rounded-full border border-navy/15 px-5 py-3 text-sm text-navy hover:bg-cream" onClick={() => setMode(null)}>
              إلغاء
            </button>
            <button type="submit" form="user-form" className="rounded-full bg-gold px-5 py-3 text-sm font-bold text-navy">
              حفظ
            </button>
          </ModalFooter>
        </Modal>
      ) : null}

      {resetTarget ? (
        <Modal open={Boolean(resetTarget)} onClose={() => { setResetTarget(null); setResetPassword(""); }} size="sm">
          <ModalHeader>
            <h3 className="font-display text-lg font-bold text-navy">إعادة تعيين كلمة المرور</h3>
            <p className="mt-1 text-sm text-navy/60">للمستخدم {resetTarget.nameAr} ({resetTarget.email})</p>
          </ModalHeader>
          <ModalContent>
            <form id="reset-form" onSubmit={submitReset} className="space-y-4">
              <div>
                <label className={labelCls}>كلمة المرور الجديدة</label>
                <input className={inputCls} dir="ltr" type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={6} required />
              </div>
              {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
            </form>
          </ModalContent>
          <ModalFooter>
            <button type="button" className="rounded-full border border-navy/15 px-5 py-3 text-sm text-navy hover:bg-cream" onClick={() => { setResetTarget(null); setResetPassword(""); }}>
              إلغاء
            </button>
            <button type="submit" form="reset-form" className="rounded-full bg-gold px-5 py-3 text-sm font-bold text-navy">
              إعادة التعيين
            </button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}