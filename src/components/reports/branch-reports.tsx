import { useEffect, useState } from "react";
import { FileText, GraduationCap, ListOrdered, Printer } from "lucide-react";
import { getBranchClasses, getTerms, type BranchClass, type Term } from "@/lib/branches";
import {
  getAdmissionDocument,
  getClassStudentList,
  getReportCard,
  type AdmissionDocument,
  type ClassStudentList,
  type ReportCard,
} from "@/lib/reports";
import { RelationalReportViewer, type ReportViewerJob } from "./report-sheets";
import { cn } from "@/lib/utils";

const selectCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30 min-h-11";

/**
 * Branch-scoped reports picker (report card, class list, admission
 * document). Every payload is fetched from the relational report APIs,
 * which resolve the branch server-side from the resource itself.
 * Used by both the Branch Head workspace and the System Admin branch view.
 */
export function BranchReports({ branchId }: { branchId: string }) {
  const [classes, setClasses] = useState<BranchClass[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [job, setJob] = useState<ReportViewerJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setClassId("");
    setStudentId("");
    setStudents([]);
    setJob(null);
    setError("");
    Promise.all([
      getBranchClasses(branchId).catch(() => [] as BranchClass[]),
      getTerms().catch(() => [] as Term[]),
    ]).then(([cls, ts]) => {
      if (cancelled) return;
      setClasses(cls);
      setTerms(ts);
      if (cls.length > 0) setClassId(cls[0].id);
      if (ts.length > 0) setTermId(ts[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setStudentId("");
      return;
    }
    let cancelled = false;
    getClassStudentList(classId)
      .then((roster) => {
        if (cancelled) return;
        setStudents(roster.students.map((s) => ({ id: s.id, nameAr: s.nameAr })));
        setStudentId("");
      })
      .catch(() => {
        if (!cancelled) {
          setStudents([]);
          setStudentId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  async function openReport(kind: ReportViewerJob["kind"]) {
    setLoading(true);
    setError("");
    try {
      if (kind === "report-card") {
        if (!studentId || !termId) throw new Error("اختر الطالب والفصل الدراسي");
        const report: ReportCard = await getReportCard(studentId, termId);
        setJob({ kind, report });
      } else if (kind === "class-list") {
        if (!classId) throw new Error("اختر الفصل");
        const roster: ClassStudentList = await getClassStudentList(classId);
        setJob({ kind, roster });
      } else {
        if (!studentId) throw new Error("اختر الطالب");
        const doc: AdmissionDocument = await getAdmissionDocument(studentId);
        setJob({ kind, doc });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="am-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <Printer className="size-4 text-gold" />
        التقارير والطباعة
      </h3>
      <p className="mt-1 text-xs text-navy/55">تقارير علائقية من بيانات الفرع — معاينة ثم طباعة أو حفظ PDF.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <select aria-label="الفصل" className={selectCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">اختر الفصل…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <select aria-label="الطالب" className={selectCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">اختر الطالب…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr}
            </option>
          ))}
        </select>
        <select aria-label="الفصل الدراسي" className={selectCls} value={termId} onChange={(e) => setTermId(e.target.value)}>
          <option value="">اختر الفصل الدراسي…</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameAr}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-3 grid gap-2">
        <ReportAction
          icon={GraduationCap}
          label="كشف درجات طالب"
          hint="الدرجات المنشورة فقط"
          disabled={loading || !studentId || !termId}
          onClick={() => void openReport("report-card")}
        />
        <ReportAction
          icon={ListOrdered}
          label="قائمة طلاب فصل"
          hint="مرتبة أبجديًا"
          disabled={loading || !classId}
          onClick={() => void openReport("class-list")}
        />
        <ReportAction
          icon={FileText}
          label="مستند تسجيل الطالب"
          hint="بدون كلمات مرور"
          disabled={loading || !studentId}
          onClick={() => void openReport("admission")}
        />
      </div>

      {job ? <RelationalReportViewer job={job} onClose={() => setJob(null)} /> : null}
    </section>
  );
}

function ReportAction({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof Printer;
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border border-navy/10 px-4 py-3 text-start transition-colors",
        "bg-cream-subtle hover:border-gold disabled:opacity-50",
      )}
    >
      <Icon className="size-5 shrink-0 text-gold" />
      <span>
        <span className="block text-sm font-bold text-navy">{label}</span>
        <span className="block text-xs text-navy/55">{hint}</span>
      </span>
    </button>
  );
}
