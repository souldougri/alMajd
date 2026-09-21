import { Fragment, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SchoolSeal } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { SCHOOL } from "@/lib/school";
import { printOrExportPdf } from "@/lib/print-export";
import { formatPrintDate, formatScore, genderLabel } from "@/lib/print";
import type { AdmissionDocument, ClassStudentList, ReportCard } from "@/lib/reports";

/**
 * Relational report sheets (Phase 3). Markup reuses the global print system
 * (`@page`, `.print-sheet`, `.print-table`, `@media print` in styles.css)
 * and the established `printOrExportPdf` mechanism (browser dialog on
 * desktop/Electron, rasterized PDF on Android). Data comes exclusively from
 * the relational report payloads — never the legacy document store.
 */

function SheetHeader({
  titleAr,
  titleFr,
  yearLabel,
  extra,
}: {
  titleAr: string;
  titleFr?: string;
  yearLabel?: string;
  extra?: ReactNode;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <header className="print-header">
      <SchoolSeal className="print-logo" />
      <div className="min-w-0 flex-1 text-center">
        <p className="print-school-ar">{SCHOOL.nameAr}</p>
        <p className="print-school-fr">{SCHOOL.nameFr}</p>
        <p className="print-meta">
          {SCHOOL.countryAr} · {SCHOOL.city}
          {yearLabel ? ` · السنة الدراسية ${yearLabel}` : ""}
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

function SheetSignatures() {
  return (
    <div className="print-signs">
      <div>
        <p>الإدارة التربوية</p>
        <div className="print-sign-line" />
      </div>
      <div>
        <p>الختم وتوقيع الإدارة</p>
        <div className="print-sign-line" />
      </div>
    </div>
  );
}

export function ReportCardSheet({ report }: { report: ReportCard }) {
  return (
    <article className="print-sheet" dir="rtl">
      <SheetHeader
        titleAr="كشف الدرجات"
        titleFr="Bulletin de notes"
        yearLabel={report.academicYear.label}
        extra={<p className="print-extra">{report.term.nameAr} · {report.branch.nameAr}</p>}
      />
      <dl className="print-dl print-dl-id">
        <div>
          <dt>اسم الطالب</dt>
          <dd>{report.student.nameAr}</dd>
        </div>
        <div>
          <dt>Nom</dt>
          <dd>{report.student.nameFr || "—"}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{report.student.klass || report.class.nameAr || "—"}</dd>
        </div>
        <div>
          <dt>الرقم</dt>
          <dd className="ltr">{report.student.id}</dd>
        </div>
      </dl>
      {!report.published ? (
        <p className="print-letter">
          <strong>ملاحظة:</strong> نتائج هذا الفصل الدراسي غير منشورة بعد — تظهر البنية فقط بدون درجات.
        </p>
      ) : null}
      <table className="print-table">
        <thead>
          <tr>
            <th>المادة</th>
            <th>التقييم</th>
            <th>الدرجة</th>
            <th>القصوى</th>
            <th>النسبة %</th>
          </tr>
        </thead>
        <tbody>
          {report.subjects.map((sub) => (
            <Fragment key={sub.subjectId}>
              {sub.assessments.map((a, i) => (
                <tr key={a.id}>
                  {i === 0 ? <td rowSpan={Math.max(sub.assessments.length, 1) + 1}>{sub.nameAr}</td> : null}
                  <td>{a.title}</td>
                  <td>{a.score === null ? "—" : formatScore(a.score)}</td>
                  <td>{formatScore(a.maxScore)}</td>
                  <td>{a.percent === null ? "—" : `${a.percent.toFixed(1)}%`}</td>
                </tr>
              ))}
              <tr key={`${sub.subjectId}-total`}>
                {sub.assessments.length === 0 ? <td>{sub.nameAr}</td> : null}
                <td colSpan={2}>
                  <strong>
                    معدل {sub.average20 === null ? "—" : `${sub.average20.toFixed(2)}/20`}
                    {" · "}مرجّح {sub.weightedPoints === null ? "—" : sub.weightedPoints.toFixed(2)}
                    {" · "}معامل {formatScore(sub.coefficient)}
                    {sub.appreciation ? ` · ${sub.appreciation}` : ""}
                  </strong>
                  {sub.teacherNameAr ? <span> · الأستاذ: {sub.teacherNameAr}</span> : null}
                  {sub.note ? <span> · ملاحظة: {sub.note}</span> : null}
                </td>
                <td colSpan={2} />
              </tr>
            </Fragment>
          ))}
          {report.subjects.length === 0 ? (
            <tr>
              <td colSpan={5}>لا توجد مواد مرتبطة بهذا الفصل.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <dl className="print-dl print-dl-id">
        <div>
          <dt>المعدل العام /20</dt>
          <dd>{report.average20 === null ? "—" : report.average20.toFixed(2)}</dd>
        </div>
        <div>
          <dt>النسبة المئوية</dt>
          <dd>{report.percentage === null ? "—" : `${report.percentage.toFixed(1)}%`}</dd>
        </div>
        <div>
          <dt>التقدير</dt>
          <dd>{report.appreciation ?? "—"}</dd>
        </div>
        <div>
          <dt>الترتيب</dt>
          <dd>{report.rank === null ? "—" : `${report.rank} من ${report.classSize}`}</dd>
        </div>
      </dl>
      <SheetSignatures />
    </article>
  );
}

export function ClassListSheet({ roster }: { roster: ClassStudentList }) {
  return (
    <article className="print-sheet" dir="rtl">
      <SheetHeader
        titleAr="قائمة طلاب الفصل"
        titleFr="Liste des élèves"
        yearLabel={roster.academicYear.label}
        extra={<p className="print-extra">{roster.class.nameAr} · {roster.branch.nameAr}</p>}
      />
      <table className="print-table">
        <thead>
          <tr>
            <th>الرقم</th>
            <th>اسم الطالب</th>
            <th>Nom</th>
            <th>الجنس</th>
            <th>تاريخ التسجيل</th>
          </tr>
        </thead>
        <tbody>
          {roster.students.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{s.nameAr}</td>
              <td>{s.nameFr || "—"}</td>
              <td>{genderLabel(s.gender)}</td>
              <td>{s.enrolled || "—"}</td>
            </tr>
          ))}
          {roster.students.length === 0 ? (
            <tr>
              <td colSpan={5}>لا يوجد طلاب مسجلون في هذا الفصل.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="print-letter">عدد الطلاب: <strong>{roster.students.length}</strong></p>
      <SheetSignatures />
    </article>
  );
}

export function AdmissionSheet({ doc }: { doc: AdmissionDocument }) {
  return (
    <article className="print-sheet" dir="rtl">
      <SheetHeader titleAr="شهادة تسجيل طالب" titleFr="Certificat de scolarité" />
      <p className="print-ref">
        المرجع: <span className="ltr">{doc.reference}</span> · {SCHOOL.city} · {formatPrintDate(new Date().toISOString().slice(0, 10))}
      </p>
      <dl className="print-dl print-dl-id">
        <div>
          <dt>اسم الطالب</dt>
          <dd>{doc.student.nameAr}</dd>
        </div>
        <div>
          <dt>Nom</dt>
          <dd>{doc.student.nameFr || "—"}</dd>
        </div>
        <div>
          <dt>الجنس</dt>
          <dd>{genderLabel(doc.student.gender)}</dd>
        </div>
        <div>
          <dt>تاريخ الميلاد</dt>
          <dd>{doc.student.dob || "—"}</dd>
        </div>
        <div>
          <dt>مكان الميلاد</dt>
          <dd>{doc.student.placeOfBirth || "—"}</dd>
        </div>
        <div>
          <dt>ولي الأمر</dt>
          <dd>{doc.student.parentAr || "—"}</dd>
        </div>
        <div>
          <dt>الهاتف</dt>
          <dd>{doc.student.phone || "—"}</dd>
        </div>
        <div>
          <dt>الفرع</dt>
          <dd>{doc.branch.nameAr}</dd>
        </div>
        <div>
          <dt>الفصل</dt>
          <dd>{doc.className || "—"}</dd>
        </div>
        <div>
          <dt>تاريخ التسجيل</dt>
          <dd>{doc.student.enrolled || "—"}</dd>
        </div>
        <div>
          <dt>اسم الدخول للبوابة</dt>
          <dd className="ltr">{doc.loginUsername ?? "—"}</dd>
        </div>
        <div>
          <dt>اسم دخول ولي الأمر للبوابة</dt>
          <dd className="ltr">{doc.parentLoginUsername ?? "—"}</dd>
        </div>
        <div>
          <dt>الرقم المرجعي للطالب</dt>
          <dd className="ltr">{doc.student.id}</dd>
        </div>
      </dl>
      {doc.studentPassword || doc.parentPassword ? (
        <section className="print-login">
          <h2>بيانات تسجيل الدخول — تُسلَّم لأصحابها فورًا</h2>
          <dl className="print-dl print-dl-id">
            <div>
              <dt>دخول الطالب</dt>
              <dd className="ltr">{doc.loginUsername ?? "—"}</dd>
            </div>
            {doc.studentPassword ? (
              <div>
                <dt>كلمة مرور الطالب</dt>
                <dd className="ltr">{doc.studentPassword}</dd>
              </div>
            ) : null}
            <div>
              <dt>دخول ولي الأمر</dt>
              <dd className="ltr">{doc.parentLoginUsername ?? "—"}</dd>
            </div>
            {doc.parentPassword ? (
              <div>
                <dt>كلمة مرور ولي الأمر</dt>
                <dd className="ltr">{doc.parentPassword}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <p className="print-letter">
        تشهد إدارة {SCHOOL.nameAr} بأن التلميذ(ة) المذكور(ة) أعلاه مسجَّل(ة) لديها للسنة الدراسية الحالية.
      </p>
      <SheetSignatures />
    </article>
  );
}

export type ReportViewerJob =
  | { kind: "report-card"; report: ReportCard }
  | { kind: "class-list"; roster: ClassStudentList }
  | { kind: "admission"; doc: AdmissionDocument };

const VIEWER_FILENAMES: Record<ReportViewerJob["kind"], string> = {
  "report-card": "report-card.pdf",
  "class-list": "class-student-list.pdf",
  admission: "admission-certificate.pdf",
};

/**
 * Full-screen relational report viewer: toolbar (close + print, hidden when
 * printing) plus the A4 sheet. Mirrors the established PrintStage pattern.
 */
export function RelationalReportViewer({ job, onClose }: { job: ReportViewerJob; onClose: () => void }) {
  useEffect(() => {
    document.body.classList.add("print-open");
    return () => document.body.classList.remove("print-open");
  }, []);

  return createPortal(
    <div className="print-stage">
      <div className="no-print print-toolbar">
        <p className="text-sm font-medium">معاينة التقرير</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="min-h-11 px-4" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            size="sm"
            className="min-h-11 px-4"
            onClick={() => void printOrExportPdf({ rootSelector: ".print-sheet", filename: VIEWER_FILENAMES[job.kind] })}
          >
            طباعة
          </Button>
        </div>
      </div>
      {job.kind === "report-card" ? (
        <ReportCardSheet report={job.report} />
      ) : job.kind === "class-list" ? (
        <ClassListSheet roster={job.roster} />
      ) : (
        <AdmissionSheet doc={job.doc} />
      )}
    </div>,
    document.body,
  );
}
