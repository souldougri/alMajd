import { useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, CalendarDays, ClipboardList, FileText, FolderOpen, Layers, Timer } from "lucide-react";
import { SchoolSeal } from "@/components/brand-mark";
import { ClassesView, GradesView, SubjectsView } from "@/components/desk/ops";
import { PrintProvider } from "@/components/desk/print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceFrame } from "@/components/workspaces/workspace-frame";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { SCHOOL, todayIso } from "@/lib/school";
import { printOrExportPdf } from "@/lib/print-export";
import { formatPrintDate } from "@/lib/print";
import { useSchool } from "@/lib/store";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";

const DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SLOTS = ["الفترة 1", "الفترة 2", "الفترة 3", "الفترة 4", "الفترة 5", "الفترة 6"];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
        active ? "bg-navy text-gold" : "bg-cream-subtle text-navy/60 hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

export function AcademicPage() {
  return (
    <WorkspaceFrame ws="academic">
      <div className="space-y-6">
        <div className="am-card p-4 shadow-sm sm:p-6">
          <PrintProvider>
            <AcademicTabs />
          </PrintProvider>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

type TabId = "classes" | "subjects" | "grades" | "terms" | "examSessions" | "timetable" | "documents";

function AcademicTabs() {
  const [tab, setTab] = useState<TabId>("classes");
  const classes = useSchool((s) => s.classes);
  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: "classes", label: "الفصول", icon: <Layers className="size-4" /> },
    { id: "subjects", label: "المواد", icon: <BookOpen className="size-4" /> },
    { id: "grades", label: "الدرجات", icon: <ClipboardList className="size-4" /> },
    { id: "terms", label: "الفترات", icon: <CalendarDays className="size-4" /> },
    { id: "examSessions", label: "الامتحانات", icon: <FileText className="size-4" /> },
    { id: "timetable", label: "الجدول الزمني", icon: <Timer className="size-4" /> },
    { id: "documents", label: "المستندات", icon: <FolderOpen className="size-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </TabButton>
        ))}
      </div>

      {tab === "classes" ? <ClassesView /> : null}
      {tab === "subjects" ? <SubjectsView /> : null}
      {tab === "grades" ? <GradesView /> : null}
      {tab === "terms" ? <TermsPanel /> : null}
      {tab === "examSessions" ? <ExamSessionsPanel /> : null}
      {tab === "timetable" ? <TimetablePanel /> : null}
      {tab === "documents" ? (
        <DocumentsPanel
          canUpload
          uploadMode="one_class"
          classes={classes.filter((c) => c.active).map((c) => ({ id: c.id, nameAr: c.nameAr }))}
        />
      ) : null}
    </div>
  );
}

function TermsPanel() {
  const terms = useSchool((s) => s.terms);
  const addTerm = useSchool((s) => s.addTerm);
  const editTerm = useSchool((s) => s.editTerm);
  const deleteTerm = useSchool((s) => s.deleteTerm);
  const [nameAr, setNameAr] = useState("");
  const [order, setOrder] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    const nextOrder = Number(order) || terms.length + 1;
    addTerm({ nameAr: nameAr.trim(), order: nextOrder, active: true });
    setNameAr("");
    setOrder(String(nextOrder + 1));
  }

  const sorted = terms.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-navy/10 bg-cream p-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label>اسم الفترة</Label>
          <Input className={inputCls} value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: الفصل الأول" required />
        </div>
        <div className="grid gap-1">
          <Label>الترتيب</Label>
          <Input className={inputCls} value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" placeholder={String(terms.length + 1)} />
        </div>
        <div className="flex items-end">
          <Button type="submit">إضافة الفترة</Button>
        </div>
      </form>

      <div className="am-table-wrap">
        <table className="am-table">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">الفترة</th>
              <th className="px-4 py-3 font-bold">الترتيب</th>
              <th className="px-4 py-3 text-center font-bold">الحالة</th>
              <th className="px-4 py-3 text-center font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-navy/50">
                  لا توجد فترات دراسية بعد.
                </td>
              </tr>
            ) : (
              sorted.map((t) => (
                <tr key={t.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy">{t.nameAr}</td>
                  <td className="px-4 py-3 text-navy/70">{t.order}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => editTerm(t.id, { active: !t.active })}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-bold",
                        t.active ? "bg-success text-white" : "bg-cream-subtle text-navy/45",
                      )}
                    >
                      {t.active ? "نشطة" : "معطلة"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger hover:text-white"
                      onClick={() => {
                        try {
                          deleteTerm(t.id);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "تعذر حذف الفترة");
                        }
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamSessionsPanel() {
  const examSessions = useSchool((s) => s.examSessions);
  const terms = useSchool((s) => s.terms);
  const addExamSession = useSchool((s) => s.addExamSession);
  const deleteExamSession = useSchool((s) => s.deleteExamSession);
  const [name, setName] = useState("");
  const [termId, setTermId] = useState("");
  const [date, setDate] = useState(todayIso());

  const activeTerms = terms.filter((t) => t.active).sort((a, b) => a.order - b.order);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !termId) return;
    addExamSession({ name: name.trim(), termId, date });
    setName("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy/60">
        تُستخدم جلسات الامتحان كملصقات اختيارية على كشوف الدرجات عند إدخال درجات أكثر من امتحان في الفترة الواحدة.
      </p>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-navy/10 bg-cream p-4 sm:grid-cols-4">
        <div className="grid gap-1">
          <Label>اسم الجلسة</Label>
          <Input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: امتحان الفصل الأول 2026" required />
        </div>
        <div className="grid gap-1">
          <Label>الفترة</Label>
          <select className={inputCls} value={termId} onChange={(e) => setTermId(e.target.value)} required>
            <option value="">— اختر الفترة —</option>
            {activeTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label>التاريخ</Label>
          <Input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit">إضافة الجلسة</Button>
        </div>
      </form>

      <div className="am-table-wrap">
        <table className="am-table">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">الجلسة</th>
              <th className="px-4 py-3 font-bold">الفترة</th>
              <th className="px-4 py-3 font-bold">التاريخ</th>
              <th className="px-4 py-3 text-center font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {examSessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-navy/50">
                  لا توجد جلسات امتحانات مسجلة بعد.
                </td>
              </tr>
            ) : (
              examSessions.map((es) => (
                <tr key={es.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy">{es.name}</td>
                  <td className="px-4 py-3 text-navy/70">{terms.find((t) => t.id === es.termId)?.nameAr ?? "—"}</td>
                  <td className="px-4 py-3">{es.date}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger hover:text-white"
                      onClick={() => deleteExamSession(es.id)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimetablePanel() {
  const classes = useSchool((s) => s.classes);
  const subjects = useSchool((s) => s.subjects);
  const timetable = useSchool((s) => s.timetable);
  const setTimetableEntry = useSchool((s) => s.setTimetableEntry);
  const [classId, setClassId] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const cls = classes.find((c) => c.id === classId);
  const classSubjects = subjects.filter((s) => s.active && (!s.classId || s.classId === classId));
  const entryFor = (day: number, slot: number) => timetable.find((t) => t.classId === classId && t.day === day && t.slot === slot);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-navy/10 bg-cream p-4">
        <div className="grid min-w-52 flex-1 gap-1">
          <Label>الصف</Label>
          <select className={inputCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— اختر الصف —</option>
            {classes
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
          </select>
        </div>
        <Button disabled={!cls} onClick={() => setPrintOpen(true)}>
          طباعة الجدول الزمني
        </Button>
      </div>

      {!cls ? (
        <p className="rounded-2xl border border-dashed border-navy/15 p-8 text-center text-sm text-navy/50">
          اختر صفًا أعلاه لتحرير جدوله الزمني.
        </p>
      ) : (
        <div className="am-table-wrap">
          <table className="am-table min-w-[42rem]">
            <thead>
              <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
                <th className="px-4 py-3 font-bold">اليوم</th>
                {SLOTS.map((s) => (
                  <th key={s} className="px-2 py-3 text-center font-bold">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayName, di) => (
                <tr key={dayName} className="border-b border-navy/5 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-navy">{dayName}</td>
                  {SLOTS.map((_, si) => {
                    const e = entryFor(di, si);
                    return (
                      <td key={si} className="px-1.5 py-2">
                        <select
                          className="w-full rounded-lg border border-navy/10 bg-white px-1 py-1.5 text-xs text-navy outline-none focus:border-gold"
                          value={e?.subjectId ?? ""}
                          onChange={(ev) => setTimetableEntry(classId, di, si, ev.target.value || null)}
                          aria-label={`${dayName} ${SLOTS[si]}`}
                        >
                          <option value="">—</option>
                          {classSubjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {printOpen && cls ? (
        <div className="print-stage">
          <div className="no-print print-toolbar">
            <p className="text-sm font-medium">معاينة الجدول الزمني — {cls.nameAr}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPrintOpen(false)}>
                إغلاق
              </Button>
              <Button size="sm" onClick={() => void printOrExportPdf({ rootSelector: ".print-sheet", filename: "timetable.pdf" })}>
                طباعة
              </Button>
            </div>
          </div>
          <article className="print-sheet" dir="rtl">
            <header className="print-header">
              <SchoolSeal className="print-logo" />
              <div className="min-w-0 flex-1 text-center">
                <p className="print-school-ar">{SCHOOL.nameAr}</p>
                <p className="print-school-fr">{SCHOOL.nameFr}</p>
                <h1 className="print-title">الجدول الزمني — {cls.nameAr}</h1>
              </div>
              <div className="print-date-block">
                <p>التاريخ</p>
                <p>{formatPrintDate(todayIso())}</p>
              </div>
            </header>
            <table className="print-table">
              <thead>
                <tr>
                  <th>اليوم</th>
                  {SLOTS.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((dayName, di) => (
                  <tr key={dayName}>
                    <td>{dayName}</td>
                    {SLOTS.map((_, si) => {
                      const e = entryFor(di, si);
                      return <td key={si}>{subjects.find((s) => s.id === e?.subjectId)?.nameAr ?? ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      ) : null}
    </div>
  );
}