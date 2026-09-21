import { useMemo, useState } from "react";
import { CalendarDays, Users, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TeacherPortfolio } from "@/lib/teacher";

const DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SLOTS = ["الفترة 1", "الفترة 2", "الفترة 3", "الفترة 4", "الفترة 5", "الفترة 6"];

/**
 * Timetable + «الفصول المسؤول عنها» for a teacher.
 *
 * All data is already restricted server-side to the teacher's own classes and
 * subjects — a weekly planner only ever shows their own periods, never a
 * colleague's slot, and each class marked as head-of-class is one where this
 * teacher is the المعلم المسؤول (head teacher).
 */
export function TeacherSchedule({ portfolio }: { portfolio: TeacherPortfolio | null }) {
  const [classId, setClassId] = useState("");
  const selected = useMemo(
    () => portfolio?.classes.find((c) => c.id === classId) ?? null,
    [portfolio, classId],
  );

  const headClasses = portfolio?.classes.filter((c) => c.isHeadOfClass) ?? [];
  const subjectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const cls of portfolio?.classes ?? []) {
      for (const s of cls.subjects) m.set(s.id, s.nameAr);
    }
    return m;
  }, [portfolio]);

  if (!portfolio || portfolio.classes.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
          <CalendarDays className="size-7" />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold">لا يوجد جدول حواجز أو فصول مسؤول عنها بعد</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-navy/60">
          عند إنشاء حسابك كمعلم، يكفي أن يوكّلك مدير النظام بالمواد والفصول من خلال حقل «المعلم المسؤول»
          في الفصل أو حقل «المعلم» في المادة، ويضبط الجدول الزمني. ستظهر حصصك هنا تلقائياً.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      {/* الفصول المسؤول عنها — head-of-class classes */}
      <div className="am-card p-4">
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          <UserRoundCheck className="size-5 text-gold" />
          الفصول المسؤول عنها
        </h3>
        {headClasses.length === 0 ? (
          <p className="mt-3 rounded-lg bg-cream-subtle px-4 py-3 text-sm text-navy/55">
            أنت لست معلّماً مسؤولاً عن أي فصل حالياً. توكيلك يفعل من خلال حقل «المعلم المسؤول» في صفحة الفصل.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {headClasses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-navy/10 px-4 py-3"
              >
                <span className="font-semibold text-navy">{c.nameAr}</span>
                <Badge tone="brand">
                  <Users className="size-3.5" />
                  {c.students.length} طالب
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Weekly timetable — restricted to this teacher's own subjects */}
      <div className="am-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <CalendarDays className="size-5 text-gold" />
            جدول حصصك
          </h3>
          <select
            value={classId || (portfolio.classes[0]?.id ?? "")}
            onChange={(e) => setClassId(e.target.value)}
            className="h-10 w-auto rounded-md border border-navy/10 bg-surface px-3 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {portfolio.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>

        {selected && selected.timetable.length === 0 ? (
          <p className="mt-4 rounded-lg bg-cream-subtle px-4 py-4 text-center text-sm text-navy/55">
            لا توجد حصص موكلة إليك في هذا الفصل ضمن الجدول الزمني الحالي.
          </p>
        ) : selected ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-navy">
                  <th className="px-2 py-2 text-start text-xs font-bold text-navy/60">اليوم</th>
                  {SLOTS.map((s) => (
                    <th key={s} className="px-2 py-2 text-center text-xs font-bold text-navy/60">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => (
                  <tr key={day} className="border-b border-navy/5">
                    <td className="whitespace-nowrap px-2 py-2 font-semibold text-navy">{day}</td>
                    {SLOTS.map((_, si) => {
                      const e = selected.timetable.find((t) => t.day === di && t.slot === si);
                      const subject = e ? subjectMap.get(e.subjectId) : undefined;
                      return (
                        <td key={si} className="px-2 py-2 text-center">
                          {subject ? (
                            <span className="inline-block rounded-lg bg-gold/20 px-2.5 py-1 text-xs font-bold text-navy">
                              {subject}
                            </span>
                          ) : (
                            <span className="text-navy/25">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-navy/50">
              لا تُعرض إلا حصص موادك أنت فقط — حصص الزملاء غير ظاهرة.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
