import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SchoolSeal } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppreciation } from "@/lib/constants";
import {
  WARNING_KIND_AR,
  admissionNumber,
  classSubjects,
  formatPrintDate,
  formatScore,
  receiptNumber,
  summonsNumber,
  weightedPoints,
} from "@/lib/print";
import { SCHOOL, money } from "@/lib/school";
import { useSchool } from "@/lib/store";
import type { Warning } from "@/lib/types";

export type PrintJob =
  | { kind: "roster"; classId: string }
  | { kind: "receipt"; paymentId: string }
  | { kind: "bulletin"; studentId: string; termId: string }
  | { kind: "warning"; warningId: string }
  | { kind: "summons"; studentId: string; warningId?: string }
  | { kind: "admission"; studentId: string; email?: string; password?: string };

type PrintContextValue = {
  job: PrintJob | null;
  openPrint: (job: PrintJob) => void;
  closePrint: () => void;
};

const PrintContext = createContext<PrintContextValue | null>(null);

export function usePrintDocs() {
  const ctx = useContext(PrintContext);
  if (!ctx) {
    throw new Error("usePrintDocs must be used within PrintProvider");
  }
  return ctx;
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const students = useSchool((s) => s.students);
  const classes = useSchool((s) => s.classes);

  const openPrint = useCallback(
    (next: PrintJob) => {
      if (next.kind === "roster") {
        const cls = classes.find((c) => c.id === next.classId);
        const count = students.filter((s) => s.classId === next.classId).length;
        if (count === 0) {
          window.alert(
            `لا يوجد طلاب مسجّلون في الفصل «${cls?.nameAr ?? "—"}». لا يمكن طباعة القائمة.`,
          );
          return;
        }
      }
      setJob(next);
    },
    [classes, students],
  );

  const closePrint = useCallback(() => setJob(null), []);

  useEffect(() => {
    document.body.classList.toggle("print-open", Boolean(job));
    return () => document.body.classList.remove("print-open");
  }, [job]);

  const value = useMemo(() => ({ job, openPrint, closePrint }), [job, openPrint, closePrint]);

  return (
    <PrintContext.Provider value={value}>
      {children}
      {job ? createPortal(<PrintStage key={printJobKey(job)} job={job} onClose={closePrint} />, document.body) : null}
    </PrintContext.Provider>
  );
}

function printJobKey(job: PrintJob): string {
  return Object.values(job).join(":");
}

async function printWhenReady() {
  const root = document.querySelector(".print-sheet");
  const imgs = root ? Array.from(root.querySelectorAll("img")) : [];
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );
  window.print();
}

function PrintStage({ job, onClose }: { job: PrintJob; onClose: () => void }) {
  const warnings = useSchool((s) => s.warnings);
  const students = useSchool((s) => s.students);
  const warning = job.kind === "summons" && job.warningId ? warnings.find((w) => w.id === job.warningId) : undefined;
  const student =
    job.kind === "summons" ? students.find((s) => s.id === job.studentId) : undefined;

  const [reason, setReason] = useState(warning?.body ?? "");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");

  const needsPrep = job.kind === "summons";

  return (
    <div className="print-stage">
      <div className="no-print print-toolbar">
        <p className="text-sm font-medium">معاينة الوثيقة الرسمية</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button size="sm" onClick={() => void printWhenReady()}>
            طباعة
          </Button>
        </div>
      </div>

      {needsPrep ? (
        <div className="no-print print-prep">
          <p className="mb-3 text-sm text-fg-muted">
            أكمل بيانات الاستدعاء ثم اضغط طباعة. الرقم المرجعي ثابت ولا يتغيّر عند إعادة الطباعة.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>سبب الاستدعاء</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب استدعاء ولي الأمر…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>تاريخ الموعد</Label>
              <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>وقت الموعد</Label>
              <Input type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
            </div>
          </div>
          {student ? (
            <p className="mt-2 text-xs text-fg-subtle">
              موجّه إلى ولي أمر {student.nameAr}
              {warning ? ` · بناءً على إنذار ${WARNING_KIND_AR[warning.kind]}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <OfficialSheet
        job={job}
        summons={{ reason, appointmentDate, appointmentTime }}
      />
    </div>
  );
}

function OfficialSheet({
  job,
  summons,
}: {
  job: PrintJob;
  summons: { reason: string; appointmentDate: string; appointmentTime: string };
}) {
  switch (job.kind) {
    case "roster":
      return <RosterSheet classId={job.classId} />;
    case "receipt":
      return <ReceiptSheet paymentId={job.paymentId} />;
    case "bulletin":
      return <BulletinSheet studentId={job.studentId} termId={job.termId} />;
    case "warning":
      return <WarningSheet warningId={job.warningId} />;
    case "summons":
      return (
        <SummonsSheet
          studentId={job.studentId}
          warningId={job.warningId}
          reason={summons.reason}
          appointmentDate={summons.appointmentDate}
          appointmentTime={summons.appointmentTime}
        />
      );
    case "admission":
      return <AdmissionSheet studentId={job.studentId} email={job.email} password={job.password} />;
  }
}

function PrintHeader({
  titleAr,
  titleFr,
  extra,
}: {
  titleAr: string;
  titleFr?: string;
  extra?: ReactNode;
}) {
  const schoolYear = useSchool((s) => s.schoolYear);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <header className="print-header">
      <SchoolSeal className="print-logo" />
      <div className="min-w-0 flex-1 text-center">
        <p className="print-school-ar">{SCHOOL.nameAr}</p>
        <p className="print-school-fr">{SCHOOL.nameFr}</p>
        <p className="print-meta">
          {SCHOOL.countryAr} · {SCHOOL.city} · السنة الدراسية {schoolYear}
        </p>
        <h1 className="print-title">{titleAr}</h1>
        {titleFr ? <p className="print-title-fr">{titleFr}</p> : null}
        {extra}
      </div>
      <div className="print-date-block">
        <p>التاريخ</p>
        <p>{formatPrintDate(today)}</p>
      </div>
    </header>
  );
}

function SignatureBlock({
  left,
  right,
}: {
  left: string;
  right: string;
}) {
  return (
    <div className="print-signs">
      <div>
        <p>{right}</p>
        <div className="print-sign-line" />
      </div>
      <div>
        <p>{left}</p>
        <div className="print-sign-line" />
      </div>
    </div>
  );
}

function RosterSheet({ classId }: { classId: string }) {
  const classes = useSchool((s) => s.classes);
  const students = useSchool((s) => s.students);
  const cls = classes.find((c) => c.id === classId);
  const roster = students
    .filter((s) => s.classId === classId)
    .slice()
    .sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader
        titleAr="قائمة طلاب الفصل"
        titleFr="Liste des élèves"
        extra={<p className="print-extra">الفصل: {cls?.nameAr ?? "—"}{cls?.nameFr ? ` · ${cls.nameFr}` : ""}</p>}
      />
      {roster.length === 0 ? (
        <p className="print-letter print-empty">
          لا يوجد طلاب مسجّلون في الفصل «{cls?.nameAr ?? "—"}». لا يمكن إصدار قائمة رسمية فارغة بدون هذا التحذير.
        </p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم بالعربية</th>
              <th>Nom</th>
              <th>تاريخ الميلاد</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.nameAr}</td>
                <td className="ltr">{s.nameFr}</td>
                <td>{s.dob || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function ReceiptSheet({ paymentId }: { paymentId: string }) {
  const payments = useSchool((s) => s.payments);
  const students = useSchool((s) => s.students);
  const paidOf = useSchool((s) => s.paidOf);
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) {
    return (
      <article className="print-sheet" dir="rtl">
        <p>الدفعة غير موجودة.</p>
      </article>
    );
  }
  const student = students.find((s) => s.id === payment.studentId);
  const paid = student ? paidOf(student.id) : 0;
  const remaining = student ? Math.max(0, student.annualFee - paid) : 0;
  const no = receiptNumber(payment, payments);

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader titleAr="إيصال رسوم" titleFr="Reçu de paiement" />
      <dl className="print-dl">
        <div>
          <dt>رقم الإيصال</dt>
          <dd className="ltr">{no}</dd>
        </div>
        <div>
          <dt>تاريخ الدفع</dt>
          <dd>{formatPrintDate(payment.date)}</dd>
        </div>
        <div>
          <dt>الطالب</dt>
          <dd>{student?.nameAr ?? "—"}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{student?.klass ?? "—"}</dd>
        </div>
        <div>
          <dt>المبلغ المستلم</dt>
          <dd>{money(payment.amount)}</dd>
        </div>
        <div>
          <dt>البيان</dt>
          <dd>{payment.note || "—"}</dd>
        </div>
        <div>
          <dt>الرسوم السنوية</dt>
          <dd>{student ? money(student.annualFee) : "—"}</dd>
        </div>
        <div>
          <dt>المتبقي من الرسوم السنوية</dt>
          <dd>{student ? money(remaining) : "—"}</dd>
        </div>
      </dl>
      <SignatureBlock left="الختم والتوقيع" right="المحاسبة" />
    </article>
  );
}

function AdmissionSheet({
  studentId,
  email,
  password,
}: {
  studentId: string;
  email?: string;
  password?: string;
}) {
  const students = useSchool((s) => s.students);
  const student = students.find((s) => s.id === studentId);
  const today = new Date().toISOString().slice(0, 10);

  if (!student) {
    return (
      <article className="print-sheet" dir="rtl">
        <p>الطالب غير موجود.</p>
      </article>
    );
  }

  const no = admissionNumber(student, students);

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader
        titleAr="وثيقة قبول الطالب"
        titleFr="Certificat d'admission"
      />
      <p className="print-ref">
        المرجع: <span className="ltr">{no}</span> · {SCHOOL.city} · {formatPrintDate(student.enrolled || today)}
      </p>
      <dl className="print-dl print-dl-id">
        <div>
          <dt>اسم التلميذ(ة)</dt>
          <dd>{student.nameAr}</dd>
        </div>
        <div>
          <dt>Nom</dt>
          <dd>{student.nameFr || "—"}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{student.klass || "—"}</dd>
        </div>
        <div>
          <dt>تاريخ الميلاد</dt>
          <dd>{student.dob || "—"}</dd>
        </div>
        <div>
          <dt>ولي الأمر</dt>
          <dd>{student.parentAr || "—"}</dd>
        </div>
        <div>
          <dt>هاتف ولي الأمر</dt>
          <dd>{student.phone || "—"}</dd>
        </div>
        <div>
          <dt>تاريخ القيد</dt>
          <dd>{student.enrolled ? formatPrintDate(student.enrolled) : "—"}</dd>
        </div>
        <div>
          <dt>الرسوم السنوية</dt>
          <dd>{money(student.annualFee)}</dd>
        </div>
      </dl>
      <section className="print-body">
        <h2>قرار القبول</h2>
        <p>
          تشرف إدارة {SCHOOL.nameAr} بقبول التلميذ(ة) <strong>{student.nameAr}</strong> بالتسجيل هذه السنة.
          يرجى من ولي الأمر الإطلاع على نظام المدرسة والإلتزام بتسوية الرسوم في الآجال المحددة.
        </p>
      </section>
      {email || password ? (
        <section className="print-login">
          <h2>بيانات تسجيل الدخول إلى الفضاء الرقمي</h2>
          <dl className="print-dl print-dl-id">
            <div>
              <dt>اسم المستخدم</dt>
              <dd dir="ltr">{email ?? "—"}</dd>
            </div>
            {password ? (
              <div>
                <dt>كلمة المرور الأولية</dt>
                <dd className="ltr" dir="ltr">{password}</dd>
              </div>
            ) : null}
          </dl>
          <p className="print-letter">
            يستعمل ولي الأمر أو التلميذ(ة) هذه البيانات للاطلاع على النتائج والاستدعاءات والإشعارات عبر
            فضاء المدرسة. نرجو تغيير كلمة المرور بعد أول تسجيل دخول وعدم مشاركتها مع أي طرف آخر.
          </p>
        </section>
      ) : null}
      <SignatureBlock left="الختم وتوقيع الإدارة" right="الختم وتوقيع المدير" />
    </article>
  );
}

function BulletinSheet({ studentId, termId }: { studentId: string; termId: string }) {
  const students = useSchool((s) => s.students);
  const subjects = useSchool((s) => s.subjects);
  const terms = useSchool((s) => s.terms);
  const grades = useSchool((s) => s.grades);
  const computeBulletin = useSchool((s) => s.computeBulletin);
  const computeClassRanking = useSchool((s) => s.computeClassRanking);

  const student = students.find((s) => s.id === studentId);
  const term = terms.find((t) => t.id === termId);
  const list = classSubjects(subjects, student?.classId);
  const bulletin = computeBulletin(studentId, termId);
  const ranking = student?.classId ? computeClassRanking(student.classId, termId) : [];
  const rank = ranking.find((r) => r.studentId === studentId)?.rank;
  const hasScores = list.some((sub) =>
    grades.some((g) => g.studentId === studentId && g.subjectId === sub.id && g.termId === termId),
  );

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader
        titleAr="كشف الدرجات"
        titleFr="Bulletin de notes"
        extra={<p className="print-extra">{term?.nameAr ?? ""}{term?.nameFr ? ` · ${term.nameFr}` : ""}</p>}
      />
      <dl className="print-dl print-dl-id">
        <div>
          <dt>اسم الطالب</dt>
          <dd>{student?.nameAr ?? "—"}</dd>
        </div>
        <div>
          <dt>Nom</dt>
          <dd>{student?.nameFr ?? "—"}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{student?.klass ?? "—"}</dd>
        </div>
        <div>
          <dt>ولي الأمر</dt>
          <dd>{student?.parentAr ?? "—"}</dd>
        </div>
      </dl>
      <table className="print-table">
        <thead>
          <tr>
            <th>المادة</th>
            <th>الدرجة</th>
            <th>القصوى</th>
            <th>المعامل</th>
            <th>المرجّح /20</th>
          </tr>
        </thead>
        <tbody>
          {list.map((sub) => {
            const grade = grades.find(
              (g) => g.studentId === studentId && g.subjectId === sub.id && g.termId === termId,
            );
            const max = grade?.maxScore ?? sub.maxScore;
            const w = grade ? weightedPoints(grade.score, max, sub.coefficient) : null;
            return (
              <tr key={sub.id}>
                <td>{sub.nameAr}</td>
                <td>{grade ? formatScore(grade.score) : "—"}</td>
                <td>{formatScore(max)}</td>
                <td>{formatScore(sub.coefficient)}</td>
                <td>{w == null ? "—" : w.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <dl className="print-dl print-dl-id">
        <div>
          <dt>المعدل</dt>
          <dd>{hasScores ? bulletin.average.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt>الترتيب في الفصل</dt>
          <dd>{hasScores && rank ? rank : "—"}</dd>
        </div>
        <div>
          <dt>التقدير</dt>
          <dd>{hasScores ? bulletin.appreciation || getAppreciation(bulletin.average) : "—"}</dd>
        </div>
      </dl>
      <SignatureBlock left="الختم والإدارة" right="الأستاذ / الإدارة التربوية" />
    </article>
  );
}

function WarningSheet({ warningId }: { warningId: string }) {
  const warnings = useSchool((s) => s.warnings);
  const students = useSchool((s) => s.students);
  const warning = warnings.find((w) => w.id === warningId);
  const student = students.find((s) => s.id === warning?.studentId);

  if (!warning) {
    return (
      <article className="print-sheet" dir="rtl">
        <p>الإنذار غير موجود.</p>
      </article>
    );
  }

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader titleAr="إنذار" titleFr="Avertissement" />
      <dl className="print-dl">
        <div>
          <dt>التاريخ</dt>
          <dd>{formatPrintDate(warning.date)}</dd>
        </div>
        <div>
          <dt>نوع الإنذار</dt>
          <dd>{WARNING_KIND_AR[warning.kind]}</dd>
        </div>
        <div>
          <dt>الطالب</dt>
          <dd>{student?.nameAr ?? "—"}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{student?.klass ?? "—"}</dd>
        </div>
        <div className="print-span-2">
          <dt>اسم ولي الأمر</dt>
          <dd>{student?.parentAr ?? "—"}</dd>
        </div>
      </dl>
      <section className="print-body">
        <h2>نص الإنذار</h2>
        <p>{warning.body}</p>
      </section>
      <div className="print-signs">
        <div>
          <p>توقيع الإدارة</p>
          <div className="print-sign-line" />
        </div>
        <div>
          <p>توقيع ولي الأمر وتاريخه</p>
          <div className="print-sign-line" />
          <p className="print-sign-hint">التاريخ: ………… / ………… / …………</p>
        </div>
      </div>
    </article>
  );
}

function SummonsSheet({
  studentId,
  warningId,
  reason,
  appointmentDate,
  appointmentTime,
}: {
  studentId: string;
  warningId?: string;
  reason: string;
  appointmentDate: string;
  appointmentTime: string;
}) {
  const students = useSchool((s) => s.students);
  const warnings = useSchool((s) => s.warnings);
  const student = students.find((s) => s.id === studentId);
  const warning = warningId ? warnings.find((w) => w.id === warningId) : undefined;
  const today = new Date().toISOString().slice(0, 10);

  const siblings: Array<{ id: string; date: string }> = warning
    ? warnings.map((w: Warning) => ({ id: w.id, date: w.date }))
    : students.map((s) => ({ id: s.id, date: s.enrolled || today }));

  const recordId = warning?.id ?? studentId;
  const no = summonsNumber(warning?.date ?? today, recordId, siblings);

  return (
    <article className="print-sheet" dir="rtl">
      <PrintHeader titleAr="استدعاء ولي الأمر" titleFr="Convocation du tuteur" />
      <p className="print-ref">
        المرجع: <span className="ltr">{no}</span> · {SCHOOL.city} · {formatPrintDate(today)}
      </p>
      <p className="print-letter">
        إلى السيد(ة) ولي الأمر: <strong>{student?.parentAr ?? "—"}</strong>
      </p>
      <p className="print-letter">
        بخصوص التلميذ(ة): <strong>{student?.nameAr ?? "—"}</strong> — الفصل:{" "}
        <strong>{student?.klass ?? "—"}</strong>
      </p>
      {warning ? (
        <p className="print-letter">
          نوع الإنذار المرتبط: <strong>{WARNING_KIND_AR[warning.kind]}</strong>
        </p>
      ) : null}
      <section className="print-body">
        <h2>سبب الاستدعاء</h2>
        <p>{reason.trim() || "—"}</p>
      </section>
      <section className="print-body">
        <h2>موعد الحضور</h2>
        <p>
          التاريخ: {appointmentDate ? formatPrintDate(appointmentDate) : "…………"} — الساعة:{" "}
          {appointmentTime || "…………"}
        </p>
      </section>
      <p className="print-letter">
        وعليه يرجى منكم الحضور إلى إدارة {SCHOOL.nameAr} بمدينة {SCHOOL.city} في الموعد المحدد أعلاه،
        وذلك لمتابعة وضع ابنكم/ابنتكم. والسلام عليكم ورحمة الله وبركاته.
      </p>
      <SignatureBlock left="الختم وتوقيع الإدارة" right="الإدارة التربوية" />
    </article>
  );
}
