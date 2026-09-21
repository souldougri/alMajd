import { useEffect, useState, type FormEvent } from "react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  getBranchClasses,
  getBranches,
  registerBranchStudent,
  type Branch,
  type BranchClass,
  type BranchStudentRegistration,
} from "@/lib/branches";
import {
  getAdmissionDocument,
  type AdmissionDocument,
} from "@/lib/reports";
import {
  RelationalReportViewer,
  type ReportViewerJob,
} from "@/components/reports/report-sheets";

const inputCls = "am-input";
const labelCls = "am-label";

const EMPTY_FORM = {
  nameAr: "",
  nameFr: "",
  gender: "male",
  classId: "",
  dob: "",
  phone: "",
  parentAr: "",
  annualFee: "",
  loginEmail: "",
  loginPassword: "",
};

type StudentRegistrationModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fixed branch scope (Branch Head portal) — no picker shown. */
  branchId?: string;
  /** Registrar/GM scope: the user picks the target branch explicitly. */
  showBranchPicker?: boolean;
  /**
   * Where the one-time credentials are displayed: inside this modal
   * ("modal", default — GM/registrar flow) or by the caller ("external" —
   * the branch workspace handover card, which also offers copy + print).
   */
  credentialsMode?: "modal" | "external";
  onRegistered?: (result: BranchStudentRegistration) => void;
};

/**
 * Shared student registration: creates the student record plus the student
 * and parent portal logins in one idempotent call, then shows the one-time
 * credentials exactly once.
 */
export function StudentRegistrationModal({
  open,
  onClose,
  branchId,
  showBranchPicker,
  credentialsMode = "modal",
  onRegistered,
}: StudentRegistrationModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pickedBranchId, setPickedBranchId] = useState("");
  // Classes of the target branch only (branch scope enforced server-side).
  const [classes, setClasses] = useState<BranchClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  // Idempotency key for the opened form (one per opening).
  const [formKey, setFormKey] = useState("");
  const [created, setCreated] = useState<BranchStudentRegistration | null>(null);
  const [copied, setCopied] = useState(false);
  // One-time admission print (passwords live only in `created`, never fetched).
  const [printJob, setPrintJob] = useState<ReportViewerJob | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState("");

  async function printAdmission() {
    if (!created) return;
    setPrintBusy(true);
    setPrintError("");
    try {
      const doc: AdmissionDocument = await getAdmissionDocument(created.student.id);
      setPrintJob({
        kind: "admission",
        doc: {
          ...doc,
          studentPassword: created.login.student.password || null,
          parentLoginUsername: created.login.parent.email || null,
          parentPassword: created.login.parent.password || null,
        },
      });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "تعذر تجهيز وثيقة القبول");
    } finally {
      setPrintBusy(false);
    }
  }

  async function copyCreated() {
    if (!created) return;
    const lines = [
      `حساب الطالب — login: ${created.login.student.email}`,
      created.login.student.password ? `password: ${created.login.student.password}` : null,
      created.login.parent.password
        ? `حساب ولي الأمر — login: ${created.login.parent.email} / password: ${created.login.parent.password}`
        : null,
    ].filter(Boolean) as string[];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — credentials stay visible on screen.
    }
  }

  const targetBranchId = branchId ?? pickedBranchId;

  useEffect(() => {
    if (!open) return;
    // Fresh idempotency key per opened form: retries of the same form
    // (double submit, timeout retry) resolve to one student, never two.
    setFormKey(crypto.randomUUID());
    setForm(EMPTY_FORM);
    setFormError("");
    setPickedBranchId("");
    setCreated(null);
    setPrintJob(null);
    setPrintError("");
  }, [open]);

  useEffect(() => {
    if (!open || !showBranchPicker) return;
    let cancelled = false;
    getBranches()
      .then((list) => {
        if (!cancelled) setBranches(list.filter((b) => b.active));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, showBranchPicker]);

  // Class options always come from the database, scoped to the single target
  // branch (the branch head's current branch, or the picked GM branch).
  useEffect(() => {
    if (!open || !targetBranchId) {
      setClasses([]);
      return;
    }
    let cancelled = false;
    setClassesLoading(true);
    getBranchClasses(targetBranchId)
      .then((list) => {
        if (!cancelled) setClasses(list.filter((c) => c.active !== false));
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetBranchId]);

  function close() {
    setCreated(null);
    setCopied(false);
    setPrintJob(null);
    setPrintError("");
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      setFormError("يرجى إدخال اسم الطالب");
      return;
    }
    if (!targetBranchId) {
      setFormError("يرجى اختيار الفرع");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const annualFee = form.annualFee.trim() === "" ? undefined : Number(form.annualFee);
      const result = await registerBranchStudent(targetBranchId, {
        id: formKey || undefined,
        nameAr: form.nameAr.trim(),
        nameFr: form.nameFr.trim() || undefined,
        gender: form.gender,
        classId: form.classId || undefined,
        dob: form.dob || undefined,
        phone: form.phone.trim() || undefined,
        parentAr: form.parentAr.trim() || undefined,
        annualFee: Number.isFinite(annualFee) ? annualFee : undefined,
        loginEmail: form.loginEmail.trim() || undefined,
        loginPassword: form.loginPassword || undefined,
      });
      onRegistered?.(result);
      if (credentialsMode === "external") {
        // The caller (branch workspace handover card) displays the
        // credentials itself — just close here so they show exactly once.
        close();
      } else if (result.login.student.password || result.login.parent.password) {
        setCreated(result);
      } else {
        close();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "تعذر تسجيل الطالب");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Modal
      open={open}
      // Once credentials are generated they are shown exactly once: ignore
      // backdrop/Escape dismissal while they are visible so an accidental
      // tap cannot destroy the one-time password before it is shared.
      onClose={() => {
        if (created) return;
        close();
      }}
      size={created ? "sm" : "md"}
    >
      {created ? (
        <>
          <ModalHeader>
            <h3 className="font-display text-lg font-bold text-navy">حساب دخول الطالب</h3>
            <p className="mt-1 text-sm text-navy/60">{created.student.nameAr}</p>
          </ModalHeader>
          <ModalContent>
            <div className="rounded-xl bg-cream-subtle p-4 text-sm">
              <p className="font-bold text-navy">تم تجهيز الحساب — شارك هذه البيانات مع الطالب:</p>
              <p className="mt-2" dir="ltr">login: <b>{created.login.student.email}</b></p>
              {created.login.student.password ? (
                <p dir="ltr">password: <b>{created.login.student.password}</b></p>
              ) : (
                <p className="mt-1 text-xs text-navy/55">كلمة المرور محفوظة مسبقًا ولم تتغير.</p>
              )}
              {created.login.parent.password ? (
                <div className="mt-3 border-t border-navy/10 pt-3">
                  <p className="font-bold text-navy">حساب ولي الأمر — شارك هذه البيانات مع الولي:</p>
                  <p className="mt-2" dir="ltr">login: <b>{created.login.parent.email}</b></p>
                  <p dir="ltr">password: <b>{created.login.parent.password}</b></p>
                </div>
              ) : null}
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              className="min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
              onClick={() => void copyCreated()}
            >
              {copied ? "تم النسخ ✓" : "نسخ البيانات"}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-navy/15 px-5 py-2.5 text-sm font-bold text-navy hover:bg-cream disabled:opacity-60"
              onClick={() => void printAdmission()}
              disabled={printBusy}
            >
              {printBusy ? "جارٍ التجهيز…" : "طباعة وثيقة القبول"}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-navy/15 px-5 py-2.5 text-sm text-navy hover:bg-cream"
              onClick={close}
            >
              إغلاق
            </button>
          </ModalFooter>
          {printError ? (
            <p className="px-6 pb-3 text-sm text-danger">{printError}</p>
          ) : null}
        </>
      ) : (
        <>
          <ModalHeader>
            <h3 className="font-display text-xl font-bold text-navy">تسجيل طالب جديد</h3>
            <p className="mt-1 text-xs text-navy/55">
              {showBranchPicker ? "اختر الفرع الذي سيُسجَّل فيه الطالب." : "سيُسجَّل الطالب في فرعك الحالي فقط."}
            </p>
          </ModalHeader>
          <ModalContent>
            <form id="student-registration-form" onSubmit={submit} className="space-y-4">
              {showBranchPicker ? (
                <div>
                  <label className={labelCls}>الفرع *</label>
                  <select
                    className={inputCls}
                    value={pickedBranchId}
                    onChange={(e) => setPickedBranchId(e.target.value)}
                    required
                  >
                    <option value="">— اختر الفرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={labelCls}>الاسم بالعربية *</label>
                <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>الاسم باللاتينية</label>
                  <input className={inputCls} value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>الجنس</label>
                  <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>الفصل</label>
                  <select
                    className={inputCls}
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: e.target.value })}
                    disabled={classesLoading || !targetBranchId}
                  >
                    <option value="">
                      {classesLoading ? "جارٍ تحميل الفصول…" : targetBranchId ? "— بدون فصل —" : "اختر الفرع أولًا…"}
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>تاريخ الميلاد</label>
                  <input className={inputCls} type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>الهاتف</label>
                  <input className={inputCls} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>ولي الأمر</label>
                  <input className={inputCls} value={form.parentAr} onChange={(e) => setForm({ ...form, parentAr: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>الرسوم السنوية</label>
                <input className={inputCls} dir="ltr" type="number" min={0} value={form.annualFee} onChange={(e) => setForm({ ...form, annualFee: e.target.value })} />
              </div>
              <div className="rounded-xl bg-cream-subtle p-3">
                <p className="mb-2 text-sm font-bold text-navy">حساب الدخول (يُنشأ تلقائيًا — املأ فقط لتخصيصه)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>البريد (يُترك فارغًا للتوليد)</label>
                    <input className={inputCls} dir="ltr" type="email" value={form.loginEmail} onChange={(e) => setForm({ ...form, loginEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>كلمة المرور (اختياري)</label>
                    <input className={inputCls} dir="ltr" value={form.loginPassword} onChange={(e) => setForm({ ...form, loginPassword: e.target.value })} />
                  </div>
                </div>
              </div>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </form>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              className="min-h-11 rounded-full border border-navy/15 px-5 py-2.5 text-sm text-navy hover:bg-cream"
              onClick={close}
            >
              إلغاء
            </button>
            <button
              type="submit"
              form="student-registration-form"
              disabled={saving}
              className="min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
    {printJob ? (
      <RelationalReportViewer job={printJob} onClose={() => setPrintJob(null)} />
    ) : null}
    </>
  );
}
