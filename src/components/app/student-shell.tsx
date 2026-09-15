import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CreditCard,
  FolderOpen,
  GraduationCap,
  Loader2,
  Timer,
  UserRound,
  Wallet,
} from "lucide-react";
import { AppHeader } from "./app-header";
import { useAuth } from "@/lib/auth/store";
import { getStudentPortfolio, type StudentPortfolio } from "@/lib/student";
import { getAppreciation } from "@/lib/constants";
import { money } from "@/lib/school";
import { Badge } from "@/components/ui/badge";
import { formatPrintDate, formatScore, WARNING_KIND_AR, GENDER_AR, classSubjects } from "@/lib/print";
import type { Grade, Subject } from "@/lib/types";
import { DocumentsPanel } from "@/components/documents/documents-panel";

type Tab = "results" | "fees" | "docs" | "attendance" | "timetable" | "warnings";

const DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SLOTS = ["الفترة 1", "الفترة 2", "الفترة 3", "الفترة 4", "الفترة 5", "الفترة 6"];

const STATUS_AR: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
};

const STATUS_TONE: Record<string, "ok" | "bad" | "warn"> = {
  present: "ok",
  absent: "bad",
  late: "warn",
};

export function StudentShell() {
  const user = useAuth((s) => s.currentUser);
  const [portfolio, setPortfolio] = useState<StudentPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("results");
  const [termId, setTermId] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStudentPortfolio()
      .then((p) => {
        if (cancelled) return;
        setPortfolio(p);
        if (p.terms.length > 0) setTermId(p.terms[0].id);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "تعذر تحميل البيانات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const student = portfolio?.student ?? null;
  const subjects = useMemo(() => {
    if (!portfolio || !student) return [] as Subject[];
    return classSubjects(portfolio.subjects, student.classId);
  }, [portfolio, student]);

  const termGrades = useMemo(() => {
    if (!portfolio) return [] as Grade[];
    return portfolio.grades.filter((g) => g.termId === termId);
  }, [portfolio, termId]);

  const average = useMemo(() => {
    if (termGrades.length === 0) return null;
    let weightedSum = 0;
    let totalCoef = 0;
    for (const grade of termGrades) {
      const s = portfolio?.subjects.find((sub) => sub.id === grade.subjectId);
      if (!s) continue;
      weightedSum += (grade.score / (grade.maxScore || 1)) * s.coefficient;
      totalCoef += s.coefficient;
    }
    return totalCoef > 0 ? (weightedSum / totalCoef) * 20 : null;
  }, [termGrades, portfolio]);

  const attendanceCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0 };
    for (const row of portfolio?.attendance ?? []) {
      if (row.status === "present" || row.status === "absent" || row.status === "late") {
        counts[row.status] += 1;
      }
    }
    return counts;
  }, [portfolio]);

  const timetableMap = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const sub of portfolio?.subjects ?? []) map.set(sub.id, sub);
    return map;
  }, [portfolio]);

  const resultsPublished = useMemo(
    () => termId === "" || portfolio?.publishedTerms[termId] === true,
    [portfolio, termId],
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col bg-cream text-navy">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center p-4 text-navy">
          <Loader2 className="size-6 animate-spin text-gold" />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col bg-cream text-navy">
        <AppHeader />
        <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center p-4 text-center">
          <p className="text-sm text-navy/70">{loadError}</p>
        </main>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-dvh flex-col bg-cream text-navy">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center p-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-navy text-gold">
            <UserRound className="size-7" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">قيد الإعداد</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-navy/60">
            حسابك غير مرتبط بعد بسجل طالب في بيانات المدرسة. تواصل مع إدارة المدرسة لتفعيل بياناتك.
          </p>
        </main>
      </div>
    );
  }

  const paidFull = portfolio && portfolio.paid >= portfolio.annualFee && portfolio.annualFee > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        {/* Profile card */}
        <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-navy text-gold">
            {student.photo ? (
              <img src={student.photo} alt={student.nameAr} className="size-full object-cover" />
            ) : (
              <GraduationCap className="size-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-navy">{student.nameAr}</h1>
            <p className="text-sm text-navy/55">{student.nameFr ?? ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="brand">فصل {portfolio?.className ?? student.klass}</Badge>
              <Badge tone={student.enrolled ? "ok" : "warn"}>
                {student.enrolled ? "مسجل" : "غير مسجل"}
              </Badge>
              <Badge>{GENDER_AR[student.gender]}</Badge>
              <Badge>الرسوم السنوية {money(student.annualFee)}</Badge>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("results")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "results" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <BookOpen className="size-4" />
            النتائج
          </button>
          <button
            type="button"
            onClick={() => setTab("fees")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "fees" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <Wallet className="size-4" />
            الرسوم الدراسية
          </button>
          <button
            type="button"
            onClick={() => setTab("attendance")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "attendance" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <CalendarDays className="size-4" />
            الحضور
          </button>
          <button
            type="button"
            onClick={() => setTab("timetable")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "timetable" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <Timer className="size-4" />
            الجدول الزمني
          </button>
          <button
            type="button"
            onClick={() => setTab("warnings")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "warnings" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <AlertTriangle className="size-4" />
            الملاحظات
          </button>
          <button
            type="button"
            onClick={() => setTab("docs")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === "docs" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
            }`}
          >
            <FolderOpen className="size-4" />
            المستندات
          </button>
        </div>

        {tab === "results" ? (
          <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">النتائج الدراسية</h2>
              <div className="flex flex-wrap gap-1.5">
                {portfolio?.terms.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTermId(t.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      termId === t.id ? "bg-navy text-gold" : "bg-bg-subtle text-navy/70 hover:bg-navy/10"
                    }`}
                  >
                    {t.nameAr}
                  </button>
                ))}
              </div>
            </div>

            {!resultsPublished ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg-subtle px-4 py-12 text-center">
                <BookOpen className="size-8 text-navy/40" />
                <p className="font-display text-lg font-bold text-navy">لم تصدر النتائج بعد</p>
                <p className="max-w-md text-sm leading-relaxed text-navy/60">
                  تُنشر النتائج من طرف الإدارة بعد اكتمال التصحيح والمراجعة. يرجى العودة لاحقًا.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/10 text-start text-xs font-bold text-navy/70">
                      <th className="px-2 py-2 text-start">المادة</th>
                      <th className="px-2 py-2 text-start">المعامل</th>
                      <th className="px-2 py-2 text-start">العلامة</th>
                      <th className="px-2 py-2 text-start">النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => {
                      const grade = termGrades.find((g) => g.subjectId === subject.id);
                      const points = grade
                        ? (grade.score / (grade.maxScore || 1)) * 20 * subject.coefficient
                        : null;
                      return (
                        <tr key={subject.id} className="border-b border-navy/5">
                          <td className="px-2 py-2 font-semibold">{subject.nameAr}</td>
                          <td className="px-2 py-2">{subject.coefficient}</td>
                          <td className="px-2 py-2">
                            {grade ? (
                              <>
                                <span className="font-bold">{formatScore(grade.score)}</span>
                                <span className="text-xs text-navy/50"> / {grade.maxScore}</span>
                              </>
                            ) : (
                              <span className="text-navy/40">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs text-navy/70">
                            {points !== null ? points.toFixed(2) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-6 text-center text-sm text-navy/50">
                          لا توجد مواد مخصصة لفصلك بعد.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-navy/10">
                      <td colSpan={2} className="px-2 py-3 font-bold">
                        المعدل (على 20)
                      </td>
                      <td colSpan={2} className="px-2 py-3">
                        {average !== null ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-display text-xl font-bold text-navy">
                              {average.toFixed(2)}
                            </span>
                            <Badge tone={average >= 10 ? "ok" : "bad"}>
                              {getAppreciation(average)}
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-navy/40">—</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        ) : tab === "attendance" ? (
          <section className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <span className="size-2.5 rounded-full bg-success" />
                  الأيام الحضور
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-success">{attendanceCounts.present}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <span className="size-2.5 rounded-full bg-gold" />
                  التأخير
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-navy">{attendanceCounts.late}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <span className="size-2.5 rounded-full bg-danger" />
                  الغياب
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-danger">{attendanceCounts.absent}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-display text-lg font-bold">سجل الحضور والغياب</h3>
              <div className="mt-3 overflow-x-auto">
                {!portfolio || portfolio.attendance.length === 0 ? (
                  <p className="py-6 text-center text-sm text-navy/50">لا توجد سجلات حضور حتى الآن.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 text-start text-xs font-bold text-navy/70">
                        <th className="px-2 py-2 text-start">التاريخ</th>
                        <th className="px-2 py-2 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.attendance.map((row) => (
                        <tr key={row.date} className="border-b border-navy/5">
                          <td className="px-2 py-2 text-navy/70">{formatPrintDate(row.date)}</td>
                          <td className="px-2 py-2">
                            <Badge tone={STATUS_TONE[row.status] ?? "warn"}>
                              {STATUS_AR[row.status] ?? row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        ) : tab === "timetable" ? (
          <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold">الجدول الزمني — {portfolio?.className ?? ""}</h3>
            </div>
            <div className="mt-4 overflow-x-auto">
              {!portfolio || portfolio.timetable.length === 0 ? (
                <p className="py-6 text-center text-sm text-navy/50">لم يُحدد جدول زمني لفصلك بعد.</p>
              ) : (
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-navy/10 text-start text-xs font-bold text-navy/70">
                      <th className="px-2 py-2 text-start">اليوم</th>
                      {SLOTS.map((s) => (
                        <th key={s} className="px-2 py-2 text-center">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((dayName, di) => (
                      <tr key={dayName} className="border-b border-navy/5">
                        <td className="whitespace-nowrap px-2 py-2 font-semibold">{dayName}</td>
                        {SLOTS.map((_, si) => {
                          const entry = portfolio.timetable.find((t) => t.day === di && t.slot === si);
                          const subject = entry ? timetableMap.get(entry.subjectId) : undefined;
                          return (
                            <td key={si} className="px-2 py-2 text-center">
                              {subject ? (
                                <span className="text-xs font-semibold text-navy">{subject.nameAr}</span>
                              ) : (
                                <span className="text-navy/30">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : tab === "warnings" ? (
          <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-display text-lg font-bold">الملاحظات الموجّهة إليك</h3>
            {!portfolio || portfolio.warnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy/50">لا توجد ملاحظات مسجّلة بحقك. أحسنت!</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {portfolio.warnings.map((w) => (
                  <li key={w.id} className="flex flex-wrap gap-3 rounded-xl bg-bg-subtle p-3">
                    <Badge tone="warn">{WARNING_KIND_AR[w.kind as keyof typeof WARNING_KIND_AR] ?? w.kind}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy/80">{w.body}</p>
                      <p className="mt-0.5 text-xs text-navy/45">{formatPrintDate(w.date)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : tab === "docs" ? (
          <section className="mt-4">
            <DocumentsPanel />
          </section>
        ) : (
          <section className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <CreditCard className="size-4 text-gold" />
                  الرسوم السنوية
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-navy">{money(student.annualFee)}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <Wallet className="size-4 text-gold" />
                  المدفوع
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-success">{money(portfolio?.paid ?? 0)}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-navy/60">
                  <AlertTriangle className="size-4 text-gold" />
                  المتبقي
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-navy">
                  {money(portfolio?.remaining ?? 0)}
                </p>
                {paidFull ? (
                  <span className="mt-2 inline-block">
                    <Badge tone="ok">مسدد بالكامل</Badge>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-display text-lg font-bold">سجل الدفعات</h3>
              <div className="mt-3 overflow-x-auto">
                {!portfolio || portfolio.payments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-navy/50">لا توجد دفعات مسجلة.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 text-start text-xs font-bold text-navy/70">
                        <th className="px-2 py-2 text-start">التاريخ</th>
                        <th className="px-2 py-2 text-start">ملاحظة</th>
                        <th className="px-2 py-2 text-end">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.payments.map((p) => (
                        <tr key={p.id} className="border-b border-navy/5">
                          <td className="px-2 py-2 text-navy/70">{formatPrintDate(p.date)}</td>
                          <td className="px-2 py-2">{p.note || "—"}</td>
                          <td className="px-2 py-2 text-end font-bold text-success">{money(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}