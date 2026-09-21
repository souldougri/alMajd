import { useMemo, useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceFrame } from "@/components/workspaces/workspace-frame";
import { todayIso } from "@/lib/school";
import { useSchool } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";

const STATUS_UI: { key: AttendanceStatus | null; label: string; cls: string }[] = [
  { key: "present", label: "حاضر", cls: "bg-success text-white" },
  { key: "late", label: "متأخر", cls: "bg-warn text-white" },
  { key: "absent", label: "غائب", cls: "bg-danger text-white" },
];

export function SupervisorPage() {
  return (
    <WorkspaceFrame ws="supervisor">
      <div className="am-card p-4 shadow-sm sm:p-6">
        <SupervisorAttendance />
      </div>
    </WorkspaceFrame>
  );
}

export function SupervisorAttendance() {
  const classes = useSchool((s) => s.classes);
  const students = useSchool((s) => s.students);
  const attendance = useSchool((s) => s.attendance);
  const mark = useSchool((s) => s.mark);
  const [date, setDate] = useState(todayIso());
  const [classId, setClassId] = useState("");

  const day = attendance[date] ?? {};
  const list = useMemo(
    () => students.filter((s) => !classId || s.classId === classId).sort((a, b) => a.klass.localeCompare(b.klass) || a.nameAr.localeCompare(b.nameAr)),
    [students, classId],
  );

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, marked: 0 };
    for (const s of list) {
      const st = day[s.id];
      if (st) {
        c[st] += 1;
        c.marked += 1;
      }
    }
    return c;
  }, [list, day]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
            <CalendarCheck2 className="size-6 text-gold" />
            سجل الحضور والغياب
          </h1>
          <p className="mt-1 text-sm text-navy/55">سجل حضور الطلاب حسب الصف والتاريخ</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-navy/10 bg-cream p-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label>التاريخ</Label>
          <Input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>الصف</Label>
          <select className={inputCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">كل الصفوف</option>
            {classes
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
          </select>
        </div>
        <div className="grid items-end">
          <p className="rounded-xl bg-navy/5 px-4 py-2.5 text-sm text-navy/70">
            تم تسجيل <b className="text-navy">{counts.marked}</b> من <b className="text-navy">{list.length}</b> طالبًا — حاضر{" "}
            <b className="text-success">{counts.present}</b> · متأخر <b className="text-warn">{counts.late}</b> · غائب{" "}
            <b className="text-danger">{counts.absent}</b>
          </p>
        </div>
      </div>

      <div className="am-table-wrap">
        <table className="am-table">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">الطالب</th>
              <th className="px-4 py-3 font-bold">الصف</th>
              <th className="px-4 py-3 text-center font-bold">حالة الحضور</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-navy/50">
                  لا يوجد طلاب في هذا الصف.
                </td>
              </tr>
            ) : (
              list.map((s) => {
                const st = day[s.id] ?? null;
                return (
                  <tr key={s.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy">{s.nameAr}</td>
                    <td className="px-4 py-3 text-navy/70">{s.klass}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {STATUS_UI.map((opt) => (
                          <button
                            key={opt.key ?? "clear"}
                            type="button"
                            onClick={() => mark(date, s.id, opt.key!)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                              st === opt.key ? opt.cls : "bg-cream-subtle text-navy/55 hover:bg-navy/10 hover:text-navy",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {counts.marked > 0 ? (
        <Button variant="outline" size="sm" onClick={() => setDate(todayIso())}>
          الرجوع لتاريخ اليوم
        </Button>
      ) : null}
    </div>
  );
}