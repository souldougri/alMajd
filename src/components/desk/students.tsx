import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrintDocs } from "@/components/desk/print";
import { StudentRegistrationModal } from "@/components/students/student-registration-modal";
import { deactivateStudentLogin, ensureStudentLogin } from "@/lib/auth/users";
import { writeAuditEntry } from "@/lib/audit";
import type { BranchStudent, BranchStudentRegistration } from "@/lib/branches";
import { money } from "@/lib/school";
import { useSchool } from "@/lib/store";
import { getAdmissionDocument, type AdmissionDocument } from "@/lib/reports";
import {
  RelationalReportViewer,
  type ReportViewerJob,
} from "@/components/reports/report-sheets";
import { processPhotoFile } from "@/lib/utils";
import type { Gender, Student } from "@/lib/types";

export function StudentsView({ mode = "full", branchId, onRegistered }: {
  mode?: "full" | "registrar" | "branch";
  /**
   * Fixed branch scope for branch-head usage: lists are filtered to this
   * branch, registration locks to it, and finance/delete UI stays hidden.
   */
  branchId?: string;
  onRegistered?: (result: BranchStudentRegistration) => void;
} = {}) {
  const registrar = mode === "registrar";
  const branch = mode === "branch";
  const students = useSchool((s) => s.students);
  const classes = useSchool((s) => s.classes);
  const terms = useSchool((s) => s.terms);
  const selectedId = useSchool((s) => s.selectedId);
  const select = useSchool((s) => s.select);
  const addStudent = useSchool((s) => s.addStudent);
  const editStudent = useSchool((s) => s.editStudent);
  const deleteStudent = useSchool((s) => s.deleteStudent);
  const paidOf = useSchool((s) => s.paidOf);
  const addPayment = useSchool((s) => s.addPayment);
  const attendance = useSchool((s) => s.attendance);
  const computeBulletin = useSchool((s) => s.computeBulletin);
  const { openPrint } = usePrintDocs();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rosterClassId, setRosterClassId] = useState("");
  const [bulletinTermId, setBulletinTermId] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("50000");
  const [payNote, setPayNote] = useState("قسط");
  const [transferClassId, setTransferClassId] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginResult, setLoginResult] = useState<{ studentId: string; email: string; password: string; created: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  // Branch handover: the freshly created student + parent credentials, shown
  // once as a dismissible card (copyable + printable) right after registration.
  const [handover, setHandover] = useState<{
    studentId: string;
    studentName: string;
    sEmail: string;
    sPassword: string;
    pEmail: string;
    pPassword: string;
  } | null>(null);
  const [handoverCopied, setHandoverCopied] = useState(false);
  const [handoverJob, setHandoverJob] = useState<ReportViewerJob | null>(null);
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [handoverError, setHandoverError] = useState("");

  async function copyHandover() {
    if (!handover) return;
    const lines = [
      `حساب الطالب — login: ${handover.sEmail}`,
      handover.sPassword ? `password: ${handover.sPassword}` : null,
      handover.pPassword
        ? `حساب ولي الأمر — login: ${handover.pEmail} / password: ${handover.pPassword}`
        : null,
    ].filter(Boolean) as string[];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setHandoverCopied(true);
      setTimeout(() => setHandoverCopied(false), 1500);
    } catch {
      // Clipboard unavailable — credentials stay visible on screen.
    }
  }

  async function printHandoverAdmission() {
    if (!handover) return;
    setHandoverBusy(true);
    setHandoverError("");
    try {
      const doc: AdmissionDocument = await getAdmissionDocument(handover.studentId);
      setHandoverJob({
        kind: "admission",
        doc: {
          ...doc,
          studentPassword: handover.sPassword || null,
          parentLoginUsername: handover.pEmail || null,
          parentPassword: handover.pPassword || null,
        },
      });
    } catch (err) {
      setHandoverError(err instanceof Error ? err.message : "تعذر تجهيز وثيقة القبول");
    } finally {
      setHandoverBusy(false);
    }
  }

  const scopedStudents = useMemo(
    // Branch scope: the head works on one branch only (server scope already
    // filters, this keeps other headed branches out of sight too).
    () => (branch && branchId ? students.filter((s) => s.branchId === branchId) : students),
    [students, branch, branchId],
  );
  const filtered = useMemo(() => {
    let list = scopedStudents;
    if (rosterClassId) list = list.filter((s) => s.classId === rosterClassId);
    const t = q.trim();
    if (!t) return list;
    return list.filter(
      (s) => s.nameAr.includes(t) || s.nameFr.toLowerCase().includes(t.toLowerCase()) || s.klass.includes(t),
    );
  }, [q, scopedStudents, rosterClassId]);
  const branchClasses = useMemo(
    () => (branch && branchId ? classes.filter((c) => c.branchId === branchId) : classes),
    [classes, branch, branchId],
  );

  const current = filtered.find((s) => s.id === selectedId) ?? filtered[0];
  const editingStudent = editingId ? scopedStudents.find((s) => s.id === editingId) : null;

  const absenceSummary = useMemo(() => {
    if (!current) return { absent: 0, late: 0, last: null as string | null };
    const days: string[] = [];
    let absent = 0;
    let late = 0;
    for (const [date, day] of Object.entries(attendance)) {
      const status = day[current.id];
      if (status) {
        days.push(date);
        if (status === "absent") absent += 1;
        if (status === "late") late += 1;
      }
    }
    days.sort();
    return { absent, late, last: days.length > 0 ? days[days.length - 1] : null };
  }, [attendance, current]);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteStudent(deleteConfirmId);
      void deactivateStudentLogin(deleteConfirmId).catch(() => undefined);
      setDeleteConfirmId(null);
    }
  };

  async function createLogin(st: Student) {
    setLoginBusy(true);
    setLoginError("");
    setLoginResult(null);
    try {
      const r = await ensureStudentLogin({
        studentId: st.id,
        nameAr: st.nameAr,
        nameEn: st.nameFr || st.nameAr,
        email: st.email ?? "",
        password: "",
      });
      const fresh = useSchool.getState().students.find((x) => x.id === st.id);
      if (fresh && (!fresh.email || fresh.email !== r.email)) {
        editStudent(fresh.id, { email: r.email });
      }
      setLoginResult({ studentId: st.id, email: r.email, password: r.password, created: r.created });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء حساب الدخول");
    } finally {
      setLoginBusy(false);
    }
  }

  async function copyCredentials() {
    if (!loginResult) return;
    const text = loginResult.password ? `البريد: ${loginResult.email}\nكلمة المرور: ${loginResult.password}` : `البريد: ${loginResult.email}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — credentials stay visible on screen.
    }
  }

  // Mirror the server-registered student into the local roster store so the
  // table, print roster and documents keep working (server id is kept).
  function syncRegistered(result: BranchStudentRegistration) {
    const s = result.student as BranchStudent & Partial<Student>;
    addStudent({
      id: s.id,
      nameAr: s.nameAr,
      nameFr: s.nameFr ?? s.nameAr,
      gender: s.gender === "female" ? "female" : "male",
      klass: s.klass ?? "",
      classId: s.classId,
      dob: s.dob ?? "",
      placeOfBirth: s.placeOfBirth ?? "",
      parentAr: s.parentAr ?? "—",
      phone: s.phone ?? "—",
      enrolled: s.enrolled ?? new Date().toISOString().slice(0, 10),
      annualFee: typeof s.annualFee === "number" ? s.annualFee : 0,
      email: result.login.student.email || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">تسجيل الطلاب</h1>
          <p className="text-sm text-fg-muted">ملفات القيد · Inscriptions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-11 am-input"
            value={rosterClassId}
            onChange={(e) => setRosterClassId(e.target.value)}
            aria-label="تصفية الفصل"
          >
            <option value="">— كل الفصول —</option>
            {branchClasses
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              const classId = rosterClassId || current?.classId;
              if (!classId) {
                window.alert("اختر الفصل أولاً لطباعة القائمة.");
                return;
              }
              openPrint({ kind: "roster", classId });
            }}
          >
            طباعة القائمة
          </Button>
          <Button
            onClick={() => {
              if (registrar || branch) {
                setRegOpen(true);
                return;
              }
              setEditingId(null);
              setOpen((v) => !v);
            }}
          >
            {open ? "إغلاق النموذج" : "تسجيل جديد"}
          </Button>
        </div>
      </div>

      {open && (!branch || editingId) ? (
        <StudentForm
          onDone={() => { setOpen(false); setEditingId(null); }}
          onSave={(data) => {
            if (editingId) {
              const prev = editingStudent;
              const changedClass = Boolean(prev && data.classId && prev.classId !== data.classId);
              editStudent(editingId, data);
              void writeAuditEntry({
                action: changedClass ? "class.transfer" : "student.update",
                targetId: editingId,
                targetName: data.nameAr ?? prev?.nameAr,
                detail: changedClass ? `transferred to ${data.klass ?? ""}` : "student record updated",
              });
              return;
            }
            addStudent(data as Omit<Student, "id">);
          }}
          student={editingStudent ?? undefined}
          classes={branch ? branchClasses : classes}
          allowLoginEmail={registrar}
          defaultClassId={rosterClassId || undefined}
        />
      ) : null}

      <StudentRegistrationModal
        open={regOpen}
        onClose={() => setRegOpen(false)}
        showBranchPicker={!branch}
        branchId={branch ? branchId : undefined}
        credentialsMode={branch ? "external" : undefined}
        onRegistered={(r) => {
          syncRegistered(r);
          // Branch handover card (GM/registrar keep the modal's own view).
          if (branch && (r.login.student.password || r.login.parent.password)) {
            setHandover({
              studentId: r.student.id,
              studentName: r.student.nameAr,
              sEmail: r.login.student.email,
              sPassword: r.login.student.password,
              pEmail: r.login.parent.email,
              pPassword: r.login.parent.password,
            });
            setHandoverCopied(false);
            setHandoverError("");
          }
          onRegistered?.(r);
        }}
      />

      {branch && handover ? (
        <div className="rounded-2xl border-2 border-gold bg-gold/10 p-4 shadow-sm">
          <p className="font-display text-lg font-bold text-navy">
            تم تسجيل «{handover.studentName}» — سلّم هذه البيانات لأصحابها فورًا
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/70 p-3 text-sm">
              <p className="font-bold text-navy">حساب الطالب</p>
              <p className="mt-1.5" dir="ltr">login: <b>{handover.sEmail}</b></p>
              {handover.sPassword ? (
                <p dir="ltr">password: <b>{handover.sPassword}</b></p>
              ) : (
                <p className="mt-1 text-xs text-navy/55">بلا كلمة مرور جديدة.</p>
              )}
            </div>
            <div className="rounded-xl bg-white/70 p-3 text-sm">
              <p className="font-bold text-navy">حساب ولي الأمر</p>
              <p className="mt-1.5" dir="ltr">login: <b>{handover.pEmail}</b></p>
              {handover.pPassword ? (
                <p dir="ltr">password: <b>{handover.pPassword}</b></p>
              ) : (
                <p className="mt-1 text-xs text-navy/55">بلا كلمة مرور جديدة.</p>
              )}
            </div>
          </div>
          {handoverError ? <p className="mt-2 text-xs font-semibold text-danger">{handoverError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyHandover()}>
              {handoverCopied ? "تم النسخ ✓" : "نسخ البيانات"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void printHandoverAdmission()} disabled={handoverBusy}>
              {handoverBusy ? "جارٍ التجهيز…" : "طباعة وثيقة القبول"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHandover(null)}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : null}
      {handoverJob ? (
        <RelationalReportViewer job={handoverJob} onClose={() => setHandoverJob(null)} />
      ) : null}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="بحث بالاسم أو الصف…"
        className="max-w-md"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-x-auto am-card">
          <table className="am-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الجنس</th>
                <th>الصف</th>
                <th>تاريخ الميلاد</th>
                <th>ولي الأمر</th>
                {!registrar && !branch ? (
                  <th>الرسوم</th>
                ) : null}
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const paid = paidOf(s.id);
                const done = paid >= s.annualFee;
                return (
                  <tr
                    key={s.id}
                    onClick={() => select(s.id)}
                    className={
                      current?.id === s.id
                        ? "bg-primary/5 cursor-pointer"
                        : "cursor-pointer hover:bg-bg-subtle"
                    }
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">{s.nameAr}</p>
                      <p className="text-xs text-fg-subtle">{s.nameFr}</p>
                    </td>
                    <td className="px-3 py-3">
                      {s.gender === "male" ? "ذكر" : s.gender === "female" ? "أنثى" : "—"}
                    </td>
                    <td className="px-3 py-3">{s.klass}</td>
                    <td className="px-3 py-3">
                      <p>{s.dob || "—"}</p>
                      {s.placeOfBirth ? (
                        <p className="text-xs text-fg-subtle">{s.placeOfBirth}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-fg-muted">{s.parentAr}</td>
                    {!registrar && !branch ? (
                      <td className="px-3 py-3">
                        <Badge tone={done ? "ok" : paid > 0 ? "warn" : "bad"}>
                          {done ? "مسدد" : paid > 0 ? "جزئي" : "غير مسدد"}
                        </Badge>
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => select(s.id)}>
                          عرض
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(s.id)}>
                          تعديل
                        </Button>
                        {!branch ? (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                            حذف
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {current ? (
          <aside className="am-card p-4">
            <p className="text-xs text-fg-subtle">ملف الطالب</p>
            <h2 className="mt-1 text-lg font-semibold">{current.nameAr}</h2>
            <p className="text-sm text-fg-muted">{current.nameFr}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="الجنس" v={current.gender === "male" ? "ذكر" : current.gender === "female" ? "أنثى" : "—"} />
              <Row k="الصف" v={current.klass} />
              <Row k="تاريخ الميلاد" v={current.dob || "—"} />
              <Row k="مكان الميلاد" v={current.placeOfBirth || "—"} />
              <Row k="ولي الأمر" v={current.parentAr} />
              <Row k="الهاتف" v={current.phone} />
              <Row k="تاريخ القيد" v={current.enrolled} />
              {!registrar && !branch ? (
                <>
                  <Row k="الرسوم السنوية" v={money(current.annualFee)} />
                  <Row k="المحصّل" v={money(paidOf(current.id))} />
                </>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs text-fg-subtle">الحضور والغياب</p>
              {absenceSummary.last === null ? (
                <p className="mt-2 text-xs text-fg-muted">لا يوجد تسجيل حضور</p>
              ) : (
                <div className="mt-1">
                  <Row k="عدد أيام الغياب" v={String(absenceSummary.absent)} />
                  <Row k="عدد أيام التأخير" v={String(absenceSummary.late)} />
                  <Row k="آخر تسجيل حضور" v={absenceSummary.last} />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {current.classId ? (
                <Button size="sm" variant="outline" onClick={() => openPrint({ kind: "roster", classId: current.classId! })}>
                  طباعة قائمة الفصل
                </Button>
              ) : null}
              {registrar || branch ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openPrint({ kind: "admission", studentId: current.id, email: current.email })
                    }
                  >
                    طباعة وثيقة القبول
                  </Button>
                  <div className="grid gap-1">
                    <Label className="text-xs">تحويل الصف</Label>
                    <select
                      className="am-input h-9 min-h-0 px-2 text-xs"
                      value={transferClassId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setTransferClassId(cid);
                        const cls = branchClasses.find((c) => c.id === cid);
                        if (cls) {
                          editStudent(current.id, { classId: cls.id, klass: cls.nameAr });
                          void writeAuditEntry({
                            action: "class.transfer",
                            targetId: current.id,
                            targetName: current.nameAr,
                            detail: `moved to ${cls.nameAr}`,
                          });
                          setTransferClassId("");
                        }
                      }}
                      aria-label="تحويل الصف"
                    >
                        <option value="">— اختر الصف —</option>
                        {branchClasses
                          .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void createLogin(current)}
                    disabled={loginBusy}
                  >
                    {loginBusy ? "جارٍ إنشاء الحساب…" : "إنشاء حساب دخول الطالب"}
                  </Button>
                  {loginError ? (
                    <p className="rounded-md bg-danger/10 p-3 text-xs text-danger">{loginError}</p>
                  ) : null}
                  {current && loginResult && loginResult.studentId === current.id ? (
                    <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs">
                      <p className="font-semibold text-success">
                        {loginResult.created ? "تم إنشاء حساب دخول الطالب" : "حساب الدخول موجود بالفعل"}
                      </p>
                      <p className="mt-1.5">
                        البريد: <span dir="ltr" className="font-mono">{loginResult.email}</span>
                      </p>
                      {loginResult.password ? (
                        <p className="mt-1">
                          كلمة المرور: <span dir="ltr" className="font-mono">{loginResult.password}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 text-fg-muted">سلّم هذه المعطيات للطالب للدخول إلى بوابة الطالب.</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyCredentials()}
                          className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-white"
                        >
                          {copied ? "تم النسخ ✓" : "نسخ المعطيات"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openPrint({
                              kind: "admission",
                              studentId: current.id,
                              email: loginResult.email,
                              password: loginResult.password || undefined,
                            })
                          }
                          className="rounded-full border border-success/50 px-3 py-1 text-xs font-semibold text-success"
                        >
                          طباعة وثيقة القبول
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <select
                      className="am-input h-9 min-h-0 flex-1 px-2 text-xs"
                      value={bulletinTermId || terms.filter((t) => t.active).sort((a, b) => a.order - b.order).at(-1)?.id || ""}
                      onChange={(e) => setBulletinTermId(e.target.value)}
                      aria-label="الفصل الدراسي للكشف"
                    >
                      {terms
                        .filter((t) => t.active)
                        .sort((a, b) => a.order - b.order)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nameAr}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const termId =
                          bulletinTermId ||
                          terms.filter((t) => t.active).sort((a, b) => a.order - b.order).at(-1)?.id;
                        if (!termId) {
                          window.alert("لا يوجد فصل دراسي لطباعة الكشف.");
                          return;
                        }
                        openPrint({ kind: "bulletin", studentId: current.id, termId });
                      }}
                    >
                      طباعة الكشف
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPrint({ kind: "summons", studentId: current.id })}
                  >
                    استدعاء ولي الأمر
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPayOpen((v) => !v)}>
                    {payOpen ? "إلغاء" : "تسجيل دفعة"}
                  </Button>
                  {payOpen ? (
                    <form
                      className="grid gap-2 rounded-md border border-primary/10 bg-bg p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const amount = Number(payAmount) || 0;
                        if (amount <= 0) {
                          window.alert("أدخل مبلغاً صحيحاً لتسجيل الدفعة.");
                          return;
                        }
                        addPayment(current.id, amount, payNote.trim() || "قسط");
                        void writeAuditEntry({
                          action: "payment.add",
                          targetId: current.id,
                          targetName: current.nameAr,
                          detail: `${money(amount)} — ${payNote.trim() || "قسط"}`,
                        });
                        setPayOpen(false);
                        setPayAmount("50000");
                        setPayNote("قسط");
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">المبلغ</Label>
                          <Input
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            inputMode="numeric"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">البيان</Label>
                          <Input
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                      <Button type="submit" size="sm">
                        حفظ الدفعة
                      </Button>
                    </form>
                  ) : null}
                </>
              )}
            </div>
            {!registrar && !branch && terms.length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs text-fg-subtle">آخر فصل دراسي</p>
                {(() => {
                  const latestTerm = terms[terms.length - 1];
                  const bulletin = computeBulletin(current.id, latestTerm.id);
                  if (bulletin.average > 0) {
                    return (
                      <div className="mt-2 space-y-1">
                        <Row k="المعدل" v={bulletin.average.toFixed(2)} />
                        <Row k="التقدير" v={bulletin.appreciation} />
                      </div>
                    );
                  }
                  return <p className="mt-2 text-xs text-fg-muted">لا توجد درجات</p>;
                })()}
              </div>
            ) : null}
          </aside>
        ) : (
          <p className="text-sm text-fg-muted">لا توجد نتائج.</p>
        )}
      </div>

      {deleteConfirmId && (
        <ConfirmDialog
          open={Boolean(deleteConfirmId)}
          title="تأكيد الحذف"
          description={`هل أنت متأكد من حذف الطالب ${students.find((s) => s.id === deleteConfirmId)?.nameAr ?? ""}؟ سيتم حذف جميع سجلات الدفعات والإنذارات والحضور المرتبطة بهذا الطالب.`}
          confirmLabel="نعم، احذف"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5">
      <dt className="text-fg-subtle">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function StudentForm({
  onDone,
  onSave,
  student,
  classes,
  allowLoginEmail,
  defaultClassId,
}: {
  onDone: () => void;
  onSave: (s: Partial<Student>) => void;
  student?: Student;
  classes: Array<{ id: string; nameAr: string; active: boolean }>;
  allowLoginEmail?: boolean;
  defaultClassId?: string;
}) {
  const [nameAr, setNameAr] = useState(student?.nameAr ?? "");
  const [nameFr, setNameFr] = useState(student?.nameFr ?? "");
  const [gender, setGender] = useState<Gender | "">(student?.gender ?? "");
  const [klass, setKlass] = useState<string>(
    student?.klass ?? classes.find((c) => c.id === defaultClassId)?.nameAr ?? classes[0]?.nameAr ?? "",
  );
  const [classId, setClassId] = useState<string>(student?.classId ?? defaultClassId ?? classes[0]?.id ?? "");
  const [dob, setDob] = useState(student?.dob ?? "");
  const [placeOfBirth, setPlaceOfBirth] = useState(student?.placeOfBirth ?? "");
  const [parentAr, setParentAr] = useState(student?.parentAr ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [annualFee, setAnnualFee] = useState(String(student?.annualFee ?? 180000));
  const [photo, setPhoto] = useState<string | undefined>(student?.photo);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [processingPhoto, setProcessingPhoto] = useState(false);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(undefined);
    setProcessingPhoto(true);

    const result = await processPhotoFile(file);
    if (result.error) {
      setPhotoError(result.error);
    } else {
      setPhoto(result.dataUrl);
    }

    setProcessingPhoto(false);
  }

  function removePhoto() {
    setPhoto(undefined);
    setPhotoError(undefined);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    if (!dob) {
      window.alert("تاريخ الميلاد مطلوب. يرجى إدخاله قبل الحفظ.");
      return;
    }
    if (!placeOfBirth.trim()) {
      window.alert("مكان الميلاد مطلوب. يرجى إدخاله قبل الحفظ.");
      return;
    }
    if (!gender) {
      window.alert("يرجى تحديد الجنس قبل الحفظ.");
      return;
    }
    const selectedClass = classes.find((c) => c.id === classId);
    const payload: Partial<Student> = {
      nameAr: nameAr.trim(),
      nameFr: nameFr.trim() || nameAr.trim(),
      gender,
      klass: selectedClass?.nameAr ?? klass,
      classId: classId,
      dob,
      placeOfBirth: placeOfBirth.trim(),
      parentAr: parentAr.trim() || "—",
      phone: phone.trim() || "—",
      enrolled: student?.enrolled ?? new Date().toISOString().slice(0, 10),
      annualFee: Number(annualFee) || 180000,
      photo,
    };
    if (allowLoginEmail) payload.email = email.trim() || undefined;
    onSave(payload);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 am-card p-4 sm:grid-cols-2">
      <Field label="الاسم بالعربية">
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
      </Field>
      <Field label="Nom (français)">
        <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
      </Field>
      <Field label="الجنس">
        <div className="am-input flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="gender"
              value="male"
              checked={gender === "male"}
              onChange={() => setGender("male")}
              className="accent-primary"
            />
            ذكر
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="gender"
              value="female"
              checked={gender === "female"}
              onChange={() => setGender("female")}
              className="accent-primary"
            />
            أنثى
          </label>
        </div>
      </Field>
      <Field label="الصف">
        <select
          className="flex h-11 w-full am-input"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            const selectedClass = classes.find((c) => c.id === e.target.value);
            if (selectedClass) setKlass(selectedClass.nameAr);
          }}
        >
          {classes.filter((c) => c.active).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ولي الأمر">
        <Input value={parentAr} onChange={(e) => setParentAr(e.target.value)} />
      </Field>
      <Field label="تاريخ الميلاد">
        <Input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          placeholder="YYYY-MM-DD"
        />
      </Field>
      <Field label="مكان الميلاد">
        <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} required />
      </Field>
      <Field label="الهاتف">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      {allowLoginEmail ? (
        <Field label="البريد الإلكتروني (حساب الدخول)">
          <Input
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="اختياري — يُولَّد تلقائيًا إن تُرك فارغًا"
          />
        </Field>
      ) : null}
      <Field label="الرسوم السنوية">
        <Input value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="صورة الطالب (اختياري)">
        <div className="space-y-2">
          {photo ? (
            <div className="relative inline-block">
              <img
                src={photo}
                alt="صورة الطالب"
                className="h-24 w-24 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              disabled={processingPhoto}
            />
          )}
          {photoError && <p className="text-xs text-danger">{photoError}</p>}
          {processingPhoto && <p className="text-xs text-fg-muted">جاري معالجة الصورة...</p>}
        </div>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{student ? "حفظ التعديلات" : "حفظ القيد"}</Button>
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
