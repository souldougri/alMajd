import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, CalendarDays, ChevronDown, FolderOpen, GraduationCap, Loader2, Save, type LucideIcon } from "lucide-react";
import { AppHeader } from "./app-header";
import { useAuth } from "@/lib/auth/store";
import { getTeacherPortfolio, saveTeacherGrade, type TeacherPortfolio } from "@/lib/teacher";
import { Badge } from "@/components/ui/badge";
import { weightedPoints } from "@/lib/print";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { TeacherSchedule } from "@/components/app/teacher-schedule";

type RowStatus = "idle" | "saving" | "saved" | "error";

type TabId = "grades" | "schedule" | "docs";

export function TeacherShell() {
  const user = useAuth((s) => s.currentUser);
  const [portfolio, setPortfolio] = useState<TeacherPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");

  const [tab, setTab] = useState<TabId>("grades");

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const originals = useRef<Record<string, number | null>>({});
  const saved = useRef<Record<string, number | null>>({});
  const loadedKey = useRef("");

  useEffect(() => {
    let cancelled = false;
    getTeacherPortfolio()
      .then((p) => {
        if (cancelled) return;
        setPortfolio(p);
        if (p.classes.length > 0) setClassId(p.classes[0].id);
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

  const currentClass = useMemo(
    () => portfolio?.classes.find((c) => c.id === classId) ?? null,
    [portfolio, classId],
  );

  // When the class selection changes, reset the subject selection.
  useEffect(() => {
    if (!currentClass) return;
    const first = currentClass.subjects[0];
    if (first) setSubjectId(first.id);
  }, [currentClass]);

  const currentSubject = useMemo(
    () => currentClass?.subjects.find((s) => s.id === subjectId) ?? null,
    [currentClass, subjectId],
  );

  const term = useMemo(() => portfolio?.terms.find((t) => t.id === termId) ?? null, [portfolio, termId]);

  const matrixKey = `${classId}::${subjectId}::${termId}`;

  // Initialize drafts, originals and saved-snapshot whenever the (class, subject, term) changes.
  useEffect(() => {
    if (!portfolio || !currentSubject || !term) return;
    if (loadedKey.current === matrixKey) return;
    loadedKey.current = matrixKey;
    const next: Record<string, string> = {};
    const orig: Record<string, number | null> = {};
    const savedSnapshot: Record<string, number | null> = {};
    for (const student of currentClass?.students ?? []) {
      const g = (currentClass?.grades ?? []).find(
        (x) => x.studentId === student.id && x.subjectId === subjectId && x.termId === termId,
      );
      if (g && typeof g.score === "number") {
        next[student.id] = String(g.score);
        orig[student.id] = g.score;
        savedSnapshot[student.id] = g.score;
      } else {
        next[student.id] = "";
        orig[student.id] = null;
        savedSnapshot[student.id] = null;
      }
    }
    originals.current = orig;
    saved.current = savedSnapshot;
    setDrafts(next);
    setStatus({});
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixKey]);

  // Debounced auto-save when drafts change.
  useEffect(() => {
    if (!portfolio || !currentSubject || !term || !currentClass) return;
    if (loadedKey.current !== matrixKey) return;

    const timeout = setTimeout(async () => {
      const payload: Array<{ studentId: string; score: number | null }> = [];
      let hasInvalid = false;
      for (const student of currentClass.students) {
        const raw = (drafts[student.id] ?? "").trim();
        const orig = originals.current[student.id] ?? null;
        if (raw === "") {
          if (orig !== null) payload.push({ studentId: student.id, score: null });
          continue;
        }
        const score = Number(raw);
        if (!Number.isFinite(score) || score < 0 || score > currentSubject.maxScore) {
          setStatus((prev) => ({ ...prev, [student.id]: "error" }));
          hasInvalid = true;
          continue;
        }
        if (score !== orig) payload.push({ studentId: student.id, score });
      }

      if (payload.length === 0) {
        if (!hasInvalid) setSaveError(null);
        return;
      }

      setSaveError(null);
      setStatus((prev) => {
        const next = { ...prev };
        for (const item of payload) next[item.studentId] = "saving";
        return next;
      });

      let failed = false;
      for (const item of payload) {
        try {
          await saveTeacherGrade({ studentId: item.studentId, subjectId, termId, score: item.score });
          originals.current[item.studentId] = item.score;
          saved.current[item.studentId] = item.score;
          setStatus((prev) => ({ ...prev, [item.studentId]: "saved" }));
        } catch (err) {
          failed = true;
          setStatus((prev) => ({ ...prev, [item.studentId]: "error" }));
          setSaveError(err instanceof Error ? err.message : "تعذر حفظ بعض الدرجات");
        }
      }
      if (!failed) {
        setTimeout(() => {
          setStatus((prev) => {
            const next = { ...prev };
            for (const item of payload) next[item.studentId] = "idle";
            return next;
          });
        }, 1600);
      }
    }, 450);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, matrixKey]);

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

  const students = currentClass?.students ?? [];
  const isEmpty = !portfolio || portfolio.classes.length === 0;

  const tabItems: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "grades", label: "إدخال الدرجات", icon: GraduationCap },
    { id: "schedule", label: "جدول الحصص", icon: CalendarDays },
    { id: "docs", label: "الملفات التعليمية", icon: FolderOpen },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader
        nav={{
          title: "بوابة الأستاذ",
          items: tabItems.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            active: tab === item.id,
            onSelect: () => setTab(item.id),
          })),
        }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-navy text-gold">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">إدخال الدرجات</h1>
              <p className="text-sm text-navy/55">
                {portfolio ? `الأستاذ: ${portfolio.staffName ?? user?.nameAr ?? ""}` : ""}
              </p>
            </div>
          </div>
          {saveError ? <Badge tone="bad">{saveError}</Badge> : null}
        </header>

        {isEmpty ? (
          <section className="mt-10 rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
              <BookOpenCheck className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold">لا توجد فصول موكلة إليك بعد</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-navy/60">
              عند إنشاء حسابك كمعلم، يكفي أن يوكّلك مدير النظام بالمواد والفصول من خلال حقل "المعلم المسؤول"
              في الفصل أو حقل "المعلم" في المادة. ستظهر فصولك هنا تلقائياً لإدخال الدرجات.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2 md:flex">
              <button
                type="button"
                onClick={() => setTab("grades")}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors md:min-h-0 md:rounded-full md:py-2 ${
                  tab === "grades" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
                }`}
              >
                <GraduationCap className="size-4" />
                إدخال الدرجات
              </button>
              <button
                type="button"
                onClick={() => setTab("schedule")}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors md:min-h-0 md:rounded-full md:py-2 ${
                  tab === "schedule" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
                }`}
              >
                <CalendarDays className="size-4" />
                جدول الحصص
              </button>
              <button
                type="button"
                onClick={() => setTab("docs")}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors md:min-h-0 md:rounded-full md:py-2 ${
                  tab === "docs" ? "bg-navy text-gold" : "bg-white text-navy/70 hover:bg-white/70"
                }`}
              >
                <FolderOpen className="size-4" />
                الملفات التعليمية
              </button>
            </div>

            {tab === "schedule" ? (
              <section className="mt-6">
                <TeacherSchedule portfolio={portfolio} />
              </section>
            ) : tab === "docs" ? (
              <section className="mt-6">
                <DocumentsPanel
                  canUpload
                  uploadMode="one_class"
                  classes={portfolio?.classes.map((c) => ({ id: c.id, nameAr: c.nameAr })) ?? []}
                />
              </section>
            ) : (
              <section className="mt-6 am-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-44 flex-1">
                <span className="sr-only">الفصل</span>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-md border border-navy/10 bg-surface px-9 pl-9 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {portfolio?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      الفصل {c.nameAr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-navy/50" />
              </label>
              <label className="relative min-w-44 flex-1">
                <span className="sr-only">المادة</span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-md border border-navy/10 bg-surface px-9 pl-9 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {currentClass?.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr} (معامل {s.coefficient})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-navy/50" />
              </label>
              <label className="relative min-w-40 flex-1">
                <span className="sr-only">الفصل الدراسي</span>
                <select
                  value={termId}
                  onChange={(e) => setTermId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-md border border-navy/10 bg-surface px-9 pl-9 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {portfolio?.terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-navy/50" />
              </label>
            </div>

            {!currentSubject ? (
              <p className="mt-6 rounded-xl bg-bg-subtle px-4 py-6 text-center text-sm text-navy/60">
                لم تُحدد مواد لهذا الفصل موكلة إليك بعد — يمكن للإدارة ربط المادة بك من خلال لوحة إدارة المواد.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/10 text-start text-xs font-bold text-navy/70">
                      <th className="px-2 py-2 text-start">الطالب</th>
                      <th className="px-2 py-2 text-start">العلامة</th>
                      <th className="px-2 py-2 text-start">النقاط</th>
                      <th className="px-2 py-2 text-start">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const value = drafts[student.id] ?? "";
                      const st = status[student.id] ?? "idle";
                      const points =
                        value.trim() !== "" && Number.isFinite(Number(value))
                          ? weightedPoints(Number(value), currentSubject.maxScore, currentSubject.coefficient)
                          : null;
                      return (
                        <tr key={student.id} className="border-b border-navy/5">
                          <td className="px-2 py-2">
                            <p className="font-semibold">{student.nameAr}</p>
                            <p className="text-xs text-navy/50">{student.nameFr}</p>
                          </td>
                          <td className="w-28 px-2 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={currentSubject.maxScore}
                                step="0.5"
                                value={value}
                                onChange={(e) => {
                                  setDrafts((prev) => ({ ...prev, [student.id]: e.target.value }));
                                  setStatus((prev) => ({ ...prev, [student.id]: "idle" }));
                                  setSaveError(null);
                                }}
                                placeholder="—"
                                className="h-10 w-full rounded-md border border-navy/10 bg-surface px-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <span className="text-xs text-navy/50">/ {currentSubject.maxScore}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-xs text-navy/70">
                            {points !== null ? points.toFixed(2) : "—"}
                          </td>
                          <td className="px-2 py-2">
                            {st === "saving" ? (
                              <Loader2 className="size-4 animate-spin text-gold" />
                            ) : st === "saved" ? (
                              <Badge tone="ok">تم الحفظ</Badge>
                            ) : st === "error" ? (
                              <Badge tone="bad">خطأ في الحفظ</Badge>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-6 text-center text-sm text-navy/50">
                          لا يوجد طلاب مسجلون في هذا الفصل.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-navy/50">
                  <Save className="size-3.5" />
                  تُحفظ العلامات تلقائياً بعد كل تعديل. الدرجات من 0 إلى {currentSubject.maxScore}.
                </p>
              </div>
            )}
            </section>
          )}
          </>
        )}
      </main>
    </div>
  );
}