import { useMemo, useState, useEffect, type FormEvent, type ReactNode } from "react";
import { SchoolSeal } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrintDocs } from "@/components/desk/print";
import { SCHOOL, money, todayIso } from "@/lib/school";
import { useSchool } from "@/lib/store";
import { writeAuditEntry } from "@/lib/audit";
import { getTeacherOptions, type TeacherOption } from "@/lib/teachers";
import type { AttendanceStatus, CertKind, ClassSection, Subject, WarningKind } from "@/lib/types";

const statusLabel: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
};

export function AttendanceView() {
  const students = useSchool((s) => s.students);
  const attendance = useSchool((s) => s.attendance);
  const mark = useSchool((s) => s.mark);
  const date = todayIso();
  const day = attendance[date] ?? {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">المتابعة — الحضور</h1>
        <p className="text-sm text-fg-muted">تحضير يوم {date}</p>
      </div>
      <div className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <ul className="divide-y divide-border">
          {students.map((s) => {
            const st = day[s.id] ?? "present";
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.nameAr}</p>
                  <p className="text-xs text-fg-subtle">الصف {s.klass}</p>
                </div>
                <div className="flex gap-1">
                  {(["present", "late", "absent"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        mark(date, s.id, k);
                        void writeAuditEntry({
                          action: "attendance.mark",
                          targetId: s.id,
                          targetName: s.nameAr,
                          detail: `${statusLabel[k]} · ${date}`,
                        });
                      }}
                      className={
                        st === k
                          ? "h-10 rounded-md bg-primary px-3 text-xs text-primary-fg"
                          : "h-10 rounded-md bg-bg px-3 text-xs text-fg-muted"
                      }
                    >
                      {statusLabel[k]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function FeesView() {
  const students = useSchool((s) => s.students);
  const classes = useSchool((s) => s.classes);
  const payments = useSchool((s) => s.payments);
  const feeTypes = useSchool((s) => s.feeTypes);
  const addPayment = useSchool((s) => s.addPayment);
  const paidOf = useSchool((s) => s.paidOf);
  const { openPrint } = usePrintDocs();
  const [classId, setClassId] = useState("");
  const [sid, setSid] = useState(students[0]?.id ?? "");
  const [amount, setAmount] = useState("50000");
  const [note, setNote] = useState("قسط");
  const [ftId, setFtId] = useState("");

  const filteredStudents = useMemo(
    () => classId ? students.filter((s) => s.classId === classId) : students,
    [students, classId],
  );

  const student = students.find((s) => s.id === sid);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">إدارة الرسوم</h1>
        <p className="text-sm text-fg-muted">Frais de scolarité · {SCHOOL.currency}</p>
      </div>

      <form
        className="grid gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!sid) return;
          const st = students.find((s) => s.id === sid);
          addPayment(sid, Number(amount) || 0, note);
          void writeAuditEntry({
            action: "payment.add",
            targetId: sid,
            targetName: st?.nameAr,
            detail: `${money(Number(amount) || 0)} — ${note.trim() || "قسط"}`,
          });
          setAmount("50000");
          setNote("قسط");
          setFtId("");
        }}
      >
        <div className="sm:col-span-4">
          <Label>نوع الرسوم</Label>
          <select
            className="mt-1.5 h-11 w-full rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
            value={ftId}
            onChange={(e) => {
              setFtId(e.target.value);
              const ft = feeTypes.find((f) => f.id === e.target.value);
              if (ft) {
                setAmount(String(ft.amount));
                setNote(`قسط — ${ft.nameAr}`);
              }
            }}
          >
            <option value="">— اختر نوع الرسوم (اختياري) —</option>
            {feeTypes.map((ft) => (
              <option key={ft.id} value={ft.id}>
                {ft.nameAr} · {money(ft.amount)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>الطالب</Label>
          <div className="flex gap-2">
            <select
              className="h-11 flex-1 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                const next = (e.target.value
                  ? students.filter((s) => s.classId === e.target.value)
                  : students)[0]?.id;
                setSid(next ?? "");
              }}
              aria-label="تصفية حسب الفصل"
            >
              <option value="">— كل الفصول —</option>
              {classes
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
            </select>
            <select
              className="h-11 flex-1 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
              value={sid}
              onChange={(e) => setSid(e.target.value)}
            >
              {filteredStudents.length === 0 ? (
                <option value="" disabled>
                  لا يوجد طلاب
                </option>
              ) : (
                filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr} — {s.klass}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>المبلغ</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
        </div>
        <div className="grid gap-1.5">
          <Label>البيان</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="sm:col-span-4">
          <Button type="submit">تسجيل الدفعة</Button>
        </div>
      </form>

      {student ? (
        <p className="text-sm text-fg-muted">
          {student.nameAr}: {money(paidOf(student.id))} من {money(student.annualFee)}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-3 text-right font-medium">التاريخ</th>
              <th className="px-3 py-3 text-right font-medium">الطالب</th>
              <th className="px-3 py-3 text-right font-medium">البيان</th>
              <th className="px-3 py-3 text-right font-medium">المبلغ</th>
              <th className="px-3 py-3 text-right font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const st = students.find((s) => s.id === p.studentId);
              return (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-3 py-3">{p.date}</td>
                  <td className="px-3 py-3">{st?.nameAr ?? "—"}</td>
                  <td className="px-3 py-3 text-fg-muted">{p.note}</td>
                  <td className="px-3 py-3">{money(p.amount)}</td>
                  <td className="px-3 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openPrint({ kind: "receipt", paymentId: p.id })}>
                      طباعة الإيصال
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardsView() {
  const students = useSchool((s) => s.students);
  const selectedId = useSchool((s) => s.selectedId);
  const select = useSchool((s) => s.select);
  const s = students.find((x) => x.id === selectedId) ?? students[0];

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">البطاقات المدرسية</h1>
          <p className="text-sm text-fg-muted">Cartes d'identité scolaires</p>
        </div>
        <Button onClick={() => window.print()}>طباعة البطاقة</Button>
      </div>
      <div className="no-print">
        <Label>اختر الطالب</Label>
        <select
          className="mt-1.5 h-11 max-w-md rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={s?.id}
          onChange={(e) => select(e.target.value)}
        >
          {students.map((st) => (
            <option key={st.id} value={st.id}>
              {st.nameAr}
            </option>
          ))}
        </select>
      </div>
      {s ? <IdCard studentId={s.id} /> : null}
    </div>
  );
}

function IdCard({ studentId }: { studentId: string }) {
  const s = useSchool((st) => st.students.find((x) => x.id === studentId));
  if (!s) return null;
  return (
    <article className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-window)]">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-fg">
        <SchoolSeal className="size-12 bg-surface" />
        <div>
          <p className="text-sm font-semibold">{SCHOOL.nameAr}</p>
          <p className="text-xs opacity-80">{SCHOOL.nameFr}</p>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-4 p-4">
        {s.photo ? (
          <img
            src={s.photo}
            alt={`صورة ${s.nameAr}`}
            className="size-20 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md bg-primary/10 font-display text-3xl text-primary">
            {s.nameAr.slice(0, 1)}
          </div>
        )}
        <div className="text-sm">
          <p className="font-semibold">{s.nameAr}</p>
          {s.nameFr ? <p className="text-fg-muted">{s.nameFr}</p> : null}
          <p className="mt-2 text-xs text-fg-subtle">الصف {s.klass}</p>
          <p className="text-xs text-fg-subtle">رقم {s.id.toUpperCase()} · {SCHOOL.year}</p>
        </div>
      </div>
      <dl className="border-t border-border px-4 py-3 text-sm">
        <div className="flex justify-between gap-3 border-b border-border py-1.5">
          <dt className="text-fg-subtle">تاريخ الميلاد</dt>
          <dd>{s.dob || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-1.5">
          <dt className="text-fg-subtle">مكان الميلاد</dt>
          <dd>{s.placeOfBirth || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1.5">
          <dt className="text-fg-subtle">رقم الهاتف</dt>
          <dd>{s.phone || "—"}</dd>
        </div>
      </dl>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs font-medium text-fg-muted">الختم الرسمي</p>
        <div className="mt-2 flex h-16 items-center justify-center rounded-md border border-dashed border-border-strong">
          <span className="text-xs text-fg-subtle">مكان الختم</span>
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-center text-xs text-fg-subtle">{SCHOOL.motto}</p>
    </article>
  );
}

const certTitle: Record<CertKind, string> = {
  year: "شهادة نهاية السنة",
  honor: "شهادة تفوّق",
  attendance: "شهادة مواظبة",
};

export function CertificatesView() {
  const students = useSchool((s) => s.students);
  const selectedId = useSchool((s) => s.selectedId);
  const select = useSchool((s) => s.select);
  const [kind, setKind] = useState<CertKind>("year");
  const s = students.find((x) => x.id === selectedId) ?? students[0];

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">الشهادات والكشوف</h1>
          <p className="text-sm text-fg-muted">Attestations officielles</p>
        </div>
        <Button onClick={() => window.print()}>طباعة الشهادة</Button>
      </div>
      <div className="no-print flex flex-wrap gap-3">
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={s?.id}
          onChange={(e) => select(e.target.value)}
        >
          {students.map((st) => (
            <option key={st.id} value={st.id}>
              {st.nameAr}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={kind}
          onChange={(e) => setKind(e.target.value as CertKind)}
        >
          {Object.entries(certTitle).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {s ? <Certificate studentId={s.id} kind={kind} /> : null}
    </div>
  );
}

function Certificate({ studentId, kind }: { studentId: string; kind: CertKind }) {
  const s = useSchool((st) => st.students.find((x) => x.id === studentId));
  if (!s) return null;
  return (
    <article className="mx-auto max-w-xl rounded-xl border-2 border-primary bg-paper p-8 text-ink shadow-[var(--shadow-window)]">
      <div className="flex flex-col items-center gap-2 text-center">
        <SchoolSeal className="size-24" />
        <p className="text-sm text-fg-muted">{SCHOOL.countryAr}</p>
        <h2 className="font-display text-2xl font-bold text-primary">{SCHOOL.nameAr}</h2>
        <p className="text-xs tracking-brand text-danger">{SCHOOL.nameFr}</p>
      </div>
      <h3 className="mt-8 text-center font-display text-3xl">{certTitle[kind]}</h3>
      <p className="mt-6 text-center leading-relaxed">
        يشهد مجمع المجد التعليمي العربي بأن التلميذ(ة)
        <span className="font-semibold"> {s.nameAr} </span>
        ({s.nameFr}) من الصف {s.klass} قد استوفى شروط {certTitle[kind]} للسنة الدراسية {SCHOOL.year}.
      </p>
      <p className="mt-8 text-center text-sm text-fg-muted">{SCHOOL.motto}</p>
      <div className="mt-10 flex justify-between text-xs text-fg-subtle">
        <span>نجامينا · {todayIso()}</span>
        <span>الختم والإدارة</span>
      </div>
    </article>
  );
}

const warnLabel: Record<WarningKind, string> = {
  absence: "إنذار غياب",
  behavior: "إنذار سلوك",
  academic: "إنذار دراسي",
};

export function WarningsView() {
  const students = useSchool((s) => s.students);
  const warnings = useSchool((s) => s.warnings);
  const addWarning = useSchool((s) => s.addWarning);
  const { openPrint } = usePrintDocs();
  const [sid, setSid] = useState(students[0]?.id ?? "");
  const [kind, setKind] = useState<WarningKind>("absence");
  const [body, setBody] = useState("");

  const list = useMemo(
    () =>
      warnings.map((w) => ({
        ...w,
        name: students.find((s) => s.id === w.studentId)?.nameAr ?? "—",
      })),
    [warnings, students],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">الإنذارات</h1>
        <p className="text-sm text-fg-muted">Avertissements et suivi disciplinaire</p>
      </div>
      <form
        className="grid gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          const st = students.find((s) => s.id === sid);
          addWarning({ studentId: sid, kind, body: body.trim() });
          void writeAuditEntry({
            action: "warning.add",
            targetId: sid,
            targetName: st?.nameAr,
            detail: `${warnLabel[kind]} — ${body.trim()}`,
          });
          setBody("");
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
            value={sid}
            onChange={(e) => setSid(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
            value={kind}
            onChange={(e) => setKind(e.target.value as WarningKind)}
          >
            {Object.entries(warnLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الإنذار…" />
        <Button type="submit">إصدار إنذار</Button>
      </form>
      <ul className="space-y-2">
        {list.map((w) => (
          <li key={w.id} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-medium">{w.name}</p>
              <Badge tone="bad">{warnLabel[w.kind]}</Badge>
            </div>
            <p className="text-sm text-fg-muted">{w.body}</p>
            <p className="mt-2 text-xs text-fg-subtle">{w.date}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openPrint({ kind: "warning", warningId: w.id })}>
                طباعة الإنذار
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openPrint({ kind: "summons", studentId: w.studentId, warningId: w.id })}
              >
                استدعاء ولي الأمر
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClassesView() {
  const classes = useSchool((s) => s.classes);
  const students = useSchool((s) => s.students);
  const addClass = useSchool((s) => s.addClass);
  const editClass = useSchool((s) => s.editClass);
  const deleteClass = useSchool((s) => s.deleteClass);
  const { openPrint } = usePrintDocs();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const editingClass = editingId ? classes.find((c) => c.id === editingId) : null;

  const handleEdit = (id: string) => {
    setEditingId(id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      const target = classes.find((c) => c.id === deleteConfirmId);
      try {
        deleteClass(deleteConfirmId);
        void writeAuditEntry({
          action: "class.delete",
          targetId: deleteConfirmId,
          targetName: target?.nameAr,
        });
        setDeleteConfirmId(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : "فشل حذف الفصل");
      }
    }
  };

  const activeClasses = classes.filter((c) => c.active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">الفصول الدراسية</h1>
          <p className="text-sm text-fg-muted">إدارة الفصول · Classes</p>
        </div>
        <Button onClick={() => { setEditingId(null); setOpen((v) => !v); }}>
          {open ? "إغلاق النموذج" : "إضافة فصل"}
        </Button>
      </div>

      {open ? (
        <ClassForm
          onDone={() => { setOpen(false); setEditingId(null); }}
          onSave={editingId
            ? (data) => {
                editClass(editingId, data);
                void writeAuditEntry({
                  action: "class.update",
                  targetId: editingId,
                  targetName: data.nameAr ?? editingClass?.nameAr,
                });
              }
            : (data) => {
                addClass(data as Omit<ClassSection, "id">);
                void writeAuditEntry({
                  action: "class.create",
                  targetName: data.nameAr,
                });
              }}
          classData={editingClass ?? undefined}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-3 text-right font-medium">اسم الفصل</th>
              <th className="px-3 py-3 text-right font-medium">المستوى</th>
              <th className="px-3 py-3 text-right font-medium">السعة</th>
              <th className="px-3 py-3 text-right font-medium">الطلاب</th>
              <th className="px-3 py-3 text-right font-medium">الحالة</th>
              <th className="px-3 py-3 text-right font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {activeClasses.map((c) => {
              const studentCount = students.filter((s) => s.classId === c.id).length;
              return (
                <tr key={c.id} className="border-b border-border">
                  <td className="px-3 py-3 font-medium">{c.nameAr}</td>
                  <td className="px-3 py-3 text-fg-muted">{c.level ?? "—"}</td>
                  <td className="px-3 py-3 text-fg-muted">{c.capacity ?? "—"}</td>
                  <td className="px-3 py-3">{studentCount}</td>
                  <td className="px-3 py-3">
                    <Badge tone="ok">نشط</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPrint({ kind: "roster", classId: c.id })}>
                        طباعة القائمة
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(c.id)}>
                        تعديل
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteConfirmId && (
        <DeleteConfirmDialog
          item={classes.find((c) => c.id === deleteConfirmId)!}
          itemType="class"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

function ClassForm({
  onDone,
  onSave,
  classData,
}: {
  onDone: () => void;
  onSave: (data: Partial<ClassSection>) => void;
  classData?: ClassSection;
}) {
  const [nameAr, setNameAr] = useState(classData?.nameAr ?? "");
  const [nameFr, setNameFr] = useState(classData?.nameFr ?? "");
  const [level, setLevel] = useState(classData?.level ?? "");
  const [section, setSection] = useState(classData?.section ?? "");
  const [capacity, setCapacity] = useState(classData?.capacity ?? "");
  const [teacherStaffId, setTeacherStaffId] = useState(classData?.teacherStaffId ?? "");
  const [active, setActive] = useState(classData?.active ?? true);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTeachersLoading(true);
    getTeacherOptions()
      .then((opts) => {
        if (!cancelled) setTeacherOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setTeacherOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTeachersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    onSave({
      nameAr: nameAr.trim(),
      nameFr: nameFr.trim() || undefined,
      level: level.trim() || undefined,
      section: section.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      teacherStaffId: teacherStaffId || undefined,
      active,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
      <Field label="اسم الفصل (عربي)">
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
      </Field>
      <Field label="Nom (français)">
        <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
      </Field>
      <Field label="المستوى">
        <Input value={level} onChange={(e) => setLevel(e.target.value)} />
      </Field>
      <Field label="الشعبة">
        <Input value={section} onChange={(e) => setSection(e.target.value)} />
      </Field>
      <Field label="المعلم المسؤول">
        <select
          className="h-11 w-full rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={teacherStaffId}
          onChange={(e) => setTeacherStaffId(e.target.value)}
          disabled={teachersLoading}
        >
          <option value="">— بدون تحديد —</option>
          {teacherOptions.length === 0 && !teachersLoading ? (
            <option disabled value="">
              لا يوجد معلمين مسجلين في النظام
            </option>
          ) : (
            teacherOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))
          )}
        </select>
        {teacherOptions.length === 0 && !teachersLoading && (
          <p className="mt-1 text-xs text-fg-muted">
            يجب إنشاء حسابات معلمين في الإدارة أولاً
          </p>
        )}
      </Field>
      <Field label="السعة">
        <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="الحالة">
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={active ? "true" : "false"}
          onChange={(e) => setActive(e.target.value === "true")}
        >
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{classData ? "حفظ التعديلات" : "إضافة الفصل"}</Button>
      </div>
    </form>
  );
}

export function SubjectsView() {
  const subjects = useSchool((s) => s.subjects);
  const classes = useSchool((s) => s.classes);
  const addSubject = useSchool((s) => s.addSubject);
  const editSubject = useSchool((s) => s.editSubject);
  const deleteSubject = useSchool((s) => s.deleteSubject);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    getTeacherOptions()
      .then((opts) => {
        if (!cancelled) setTeacherOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setTeacherOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const editingSubject = editingId ? subjects.find((s) => s.id === editingId) : null;

  const handleEdit = (id: string) => {
    setEditingId(id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      const target = subjects.find((s) => s.id === deleteConfirmId);
      deleteSubject(deleteConfirmId);
      void writeAuditEntry({
        action: "subject.delete",
        targetId: deleteConfirmId,
        targetName: target?.nameAr,
      });
      setDeleteConfirmId(null);
    }
  };

  const activeSubjects = subjects.filter((s) => s.active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">المواد الدراسية</h1>
          <p className="text-sm text-fg-muted">إدارة المواد · Subjects</p>
        </div>
        <Button onClick={() => { setEditingId(null); setOpen((v) => !v); }}>
          {open ? "إغلاق النموذج" : "إضافة مادة"}
        </Button>
      </div>

      {open ? (
        <SubjectForm
          onDone={() => { setOpen(false); setEditingId(null); }}
          onSave={editingId
            ? (data) => {
                editSubject(editingId, data);
                void writeAuditEntry({
                  action: "subject.update",
                  targetId: editingId,
                  targetName: data.nameAr ?? editingSubject?.nameAr,
                });
              }
            : (data) => {
                addSubject(data as Omit<Subject, "id">);
                void writeAuditEntry({
                  action: "subject.create",
                  targetName: data.nameAr,
                });
              }}
          subjectData={editingSubject ?? undefined}
          classes={classes}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-3 text-right font-medium">اسم المادة</th>
              <th className="px-3 py-3 text-right font-medium">الفصل</th>
              <th className="px-3 py-3 text-right font-medium">المعلم</th>
              <th className="px-3 py-3 text-right font-medium">المعامل</th>
              <th className="px-3 py-3 text-right font-medium">أقصى علامة</th>
              <th className="px-3 py-3 text-right font-medium">الحالة</th>
              <th className="px-3 py-3 text-right font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {activeSubjects.map((s) => (
              <tr key={s.id} className="border-b border-border">
                <td className="px-3 py-3 font-medium">{s.nameAr}</td>
                <td className="px-3 py-3 text-fg-muted">
                  {s.classId ? classes.find((c) => c.id === s.classId)?.nameAr ?? s.classId : "الكل"}
                </td>
                <td className="px-3 py-3 text-fg-muted">
                  {s.teacherStaffId ? teacherOptions.find((t) => t.id === s.teacherStaffId)?.nameAr ?? "—" : "—"}
                </td>
                <td className="px-3 py-3">{s.coefficient}</td>
                <td className="px-3 py-3">{s.maxScore}</td>
                <td className="px-3 py-3">
                  <Badge tone="ok">نشط</Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(s.id)}>
                      تعديل
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                      حذف
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteConfirmId && (
        <DeleteConfirmDialog
          item={subjects.find((s) => s.id === deleteConfirmId)!}
          itemType="subject"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

function SubjectForm({
  onDone,
  onSave,
  subjectData,
  classes,
}: {
  onDone: () => void;
  onSave: (data: Partial<Subject>) => void;
  subjectData?: Subject;
  classes: ClassSection[];
}) {
  const [nameAr, setNameAr] = useState(subjectData?.nameAr ?? "");
  const [nameFr, setNameFr] = useState(subjectData?.nameFr ?? "");
  const [code, setCode] = useState(subjectData?.code ?? "");
  const [classId, setClassId] = useState(subjectData?.classId ?? "");
  const [teacherStaffId, setTeacherStaffId] = useState(subjectData?.teacherStaffId ?? "");
  const [coefficient, setCoefficient] = useState(String(subjectData?.coefficient ?? 1));
  const [maxScore, setMaxScore] = useState(String(subjectData?.maxScore ?? 20));
  const [active, setActive] = useState(subjectData?.active ?? true);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTeachersLoading(true);
    getTeacherOptions()
      .then((opts) => {
        if (!cancelled) setTeacherOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setTeacherOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTeachersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    onSave({
      nameAr: nameAr.trim(),
      nameFr: nameFr.trim() || undefined,
      code: code.trim() || undefined,
      classId: classId || undefined,
      teacherStaffId: teacherStaffId || undefined,
      coefficient: Number(coefficient) || 1,
      maxScore: Number(maxScore) || 20,
      active,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
      <Field label="اسم المادة (عربي)">
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
      </Field>
      <Field label="Nom (français)">
        <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
      </Field>
      <Field label="الرمز">
        <Input value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="الفصل">
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">— الكل —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
      </Field>
      <Field label="المعلم">
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={teacherStaffId}
          onChange={(e) => setTeacherStaffId(e.target.value)}
          disabled={teachersLoading}
        >
          <option value="">— بدون تحديد —</option>
          {teacherOptions.length === 0 && !teachersLoading ? (
            <option disabled value="">
              لا يوجد معلمين مسجلين في النظام
            </option>
          ) : (
            teacherOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))
          )}
        </select>
        {teacherOptions.length === 0 && !teachersLoading && (
          <p className="mt-1 text-xs text-fg-muted">
            يجب إنشاء حسابات معلمين في الإدارة أولاً
          </p>
        )}
      </Field>
      <Field label="المعامل">
        <Input value={coefficient} onChange={(e) => setCoefficient(e.target.value)} inputMode="numeric" required />
      </Field>
      <Field label="أقصى علامة">
        <Input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} inputMode="numeric" required />
      </Field>
      <Field label="الحالة">
        <select
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
          value={active ? "true" : "false"}
          onChange={(e) => setActive(e.target.value === "true")}
        >
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{subjectData ? "حفظ التعديلات" : "إضافة المادة"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DeleteConfirmDialog({
  item,
  itemType,
  onConfirm,
  onCancel,
}: {
  item: ClassSection | Subject;
  itemType: "class" | "subject";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const itemName = item.nameAr;
  const itemLabel = itemType === "class" ? "الفصل" : "المادة";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-[var(--shadow-window)]">
        <h3 className="text-lg font-semibold">تأكيد الحذف</h3>
        <p className="mt-2 text-sm text-fg-muted">
          هل أنت متأكد من حذف {itemLabel} <span className="font-semibold">{itemName}</span>؟
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            نعم، احذف
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GradesView() {
  const classes = useSchool((s) => s.classes);
  const subjects = useSchool((s) => s.subjects);
  const terms = useSchool((s) => s.terms);
  const students = useSchool((s) => s.students);
  const grades = useSchool((s) => s.grades);
  const upsertGrade = useSchool((s) => s.upsertGrade);
  const deleteGrade = useSchool((s) => s.deleteGrade);
  const computeBulletin = useSchool((s) => s.computeBulletin);
  const computeClassRanking = useSchool((s) => s.computeClassRanking);
  const publishedResults = useSchool((s) => s.publishedResults);
  const setBulletinPublished = useSchool((s) => s.setBulletinPublished);
  const { openPrint } = usePrintDocs();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const activeClasses = classes.filter((c) => c.active);
  const activeTerms = terms.filter((t) => t.active).sort((a, b) => a.order - b.order);

  // Filter subjects by selected class
  const classSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    return subjects.filter((s) => s.active && (s.classId === selectedClassId || !s.classId));
  }, [subjects, selectedClassId]);

  // Filter students by selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  // Compute rankings for the selected class and term
  const rankings = useMemo(() => {
    if (!selectedClassId || !selectedTermId) return [];
    return computeClassRanking(selectedClassId, selectedTermId);
  }, [selectedClassId, selectedTermId, computeClassRanking]);

  const rankingMap = useMemo(() => {
    const map = new Map<string, number>();
    rankings.forEach((r) => map.set(r.studentId, r.rank));
    return map;
  }, [rankings]);

  const isPublished = selectedClassId && selectedTermId
    ? publishedResults[`${selectedClassId}::${selectedTermId}`] === true
    : false;

  function handleGradeChange(studentId: string, subjectId: string, value: string) {
    const subject = classSubjects.find((s) => s.id === subjectId);
    if (!subject) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || value === "") {
      // Empty input - delete the grade
      deleteGrade(studentId, subjectId, selectedTermId);
      void writeAuditEntry({
        action: "grade.entry",
        targetId: studentId,
        targetName: classStudents.find((s) => s.id === studentId)?.nameAr,
        detail: `${subject.nameAr} · cleared`,
      });
      return;
    }

    if (numValue < 0 || numValue > subject.maxScore) {
      setError(`الدرجة يجب أن تكون بين 0 و ${subject.maxScore}`);
      return;
    }

    setError("");
    upsertGrade({
      studentId,
      subjectId,
      termId: selectedTermId,
      score: numValue,
      maxScore: subject.maxScore,
      date: new Date().toISOString().slice(0, 10),
    });
    void writeAuditEntry({
      action: "grade.entry",
      targetId: studentId,
      targetName: classStudents.find((s) => s.id === studentId)?.nameAr,
      detail: `${subject.nameAr} · ${numValue}/${subject.maxScore}`,
    });
  }

  function getGrade(studentId: string, subjectId: string): string {
    const grade = grades.find(
      (g) => g.studentId === studentId && g.subjectId === subjectId && g.termId === selectedTermId
    );
    return grade ? String(grade.score) : "";
  }

  if (!selectedClassId || !selectedTermId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">الدرجات</h1>
          <p className="text-sm text-fg-muted">إدارة الدرجات · Notes</p>
        </div>
        <div className="grid gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>الفصل</Label>
            <select
              className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">— اختر الفصل —</option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>الفصل الدراسي</Label>
            <select
              className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              <option value="">— اختر الفصل الدراسي —</option>
              {activeTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">الدرجات</h1>
          <p className="text-sm text-fg-muted">إدارة الدرجات · Notes</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            {activeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {activeTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setBulletinPublished(selectedClassId, selectedTermId, !isPublished);
              void writeAuditEntry({
                action: "bulletin.publish",
                targetName: activeClasses.find((c) => c.id === selectedClassId)?.nameAr,
                detail: `${isPublished ? "unpublished" : "published"} — ${
                  activeTerms.find((t) => t.id === selectedTermId)?.nameAr ?? ""
                }`,
              });
            }}
          >
            {isPublished ? "سحب نشر النتائج" : "نشر النتائج للطلاب"}
          </Button>
        </div>
      </div>

      {isPublished ? (
        <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
          النتائج منشورة — يستطيع طلاب هذا الفصل رؤيتها في بوابتهم.
        </div>
      ) : (
        <div className="rounded-lg bg-bg p-3 text-sm text-fg-muted">
          النتائج غير منشورة — لا يرى الطلاب علاماتهم بعد. عند اكتمال الإدخال، انقر «نشر النتائج للطلاب».
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {classSubjects.length === 0 ? (
        <div className="rounded-lg bg-surface p-8 text-center text-fg-muted">
          لا توجد مواد لهذا الفصل. أضف المواد أولاً من صف المواد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-fg-muted">
              <tr>
                <th className="px-3 py-3 text-right font-medium">الطالب</th>
                {classSubjects.map((subject) => (
                  <th key={subject.id} className="px-3 py-3 text-right font-medium">
                    {subject.nameAr}
                    <span className="text-fg-subtle block text-xs">
                      (معامل {subject.coefficient} / {subject.maxScore})
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-medium">المعدل</th>
                <th className="px-3 py-3 text-right font-medium">التقدير</th>
                <th className="px-3 py-3 text-right font-medium">الترتيب</th>
                <th className="px-3 py-3 text-right font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((student) => {
                const bulletin = computeBulletin(student.id, selectedTermId);
                const rank = rankingMap.get(student.id);

                return (
                  <tr key={student.id} className="border-b border-border">
                    <td className="px-3 py-3 font-medium">{student.nameAr}</td>
                    {classSubjects.map((subject) => (
                      <td key={subject.id} className="px-3 py-3">
                        <Input
                          type="number"
                          min="0"
                          max={subject.maxScore}
                          step="0.5"
                          value={getGrade(student.id, subject.id)}
                          onChange={(e) => handleGradeChange(student.id, subject.id, e.target.value)}
                          className="h-8 w-20 text-center"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 font-semibold">
                      {bulletin.average > 0 ? bulletin.average.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {bulletin.appreciation && (
                        <Badge tone={bulletin.average >= 10 ? "ok" : "bad"}>
                          {bulletin.appreciation}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {rank && <span className="font-semibold">#{rank}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          openPrint({ kind: "bulletin", studentId: student.id, termId: selectedTermId })
                        }
                      >
                        طباعة الكشف
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
