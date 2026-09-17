import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { listAuditLogs, type AuditLog, type AuditAction } from "@/lib/audit";

const ACTION_LABELS: Record<AuditAction, string> = {
  "user.create": "إنشاء حساب",
  "user.update": "تعديل حساب",
  "user.disable": "تعطيل حساب",
  "user.enable": "تفعيل حساب",
  "user.reset_password": "إعادة تعيين كلمة مرور",
  "user.delete": "حذف حساب",
  "user.migrate": "ترحيل حساب قديم",
  "student.register": "تسجيل طالب جديد",
  "student.update": "تحديث سجل طالب",
  "student.delete": "حذف سجل طالب",
  "class.create": "إنشاء فصل",
  "class.update": "تعديل فصل",
  "class.delete": "حذف فصل",
  "class.transfer": "تحويل طالب بين الفصول",
  "subject.create": "إنشاء مادة",
  "subject.update": "تعديل مادة",
  "subject.delete": "حذف مادة",
  "grade.entry": "إدخال درجة",
  "term.create": "إضافة فصل دراسي",
  "term.update": "تعديل فصل دراسي",
  "term.delete": "حذف فصل دراسي",
  "payment.add": "تسجيل دفعة",
  "warning.add": "إصدار إنذار",
  "attendance.mark": "تسجيل حضور",
  "expense.add": "تسجيل إنفاق",
  "document.generate": "إصدار وثيقة",
  "bulletin.publish": "نشر النتائج",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AuditLogView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLogs(await listAuditLogs());
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h2 className="mb-5 flex items-center gap-2 font-display text-xl font-bold text-navy">
        <ShieldCheck className="size-5 text-gold" />
        سجل التدقيق (Audit Log)
      </h2>
      {loading ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center text-sm text-navy/55 shadow-sm">
          جارٍ تحميل سجل التدقيق…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center text-sm text-navy/55 shadow-sm">
          لا توجد أحداث مسجلة بعد. سيتم تسجيل إجراءات إدارة المستخدمين والعمليات المدرسية هنا.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white shadow-sm">
          <table className="w-full min-w-[620px] text-right text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
                <th className="px-4 py-3 font-bold">التاريخ</th>
                <th className="px-4 py-3 font-bold">الإجراء</th>
                <th className="px-4 py-3 font-bold">بواسطة</th>
                <th className="px-4 py-3 font-bold">المستهدف</th>
                <th className="px-4 py-3 font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-navy/5 last:border-0 hover:bg-cream">
                  <td className="px-4 py-3 text-navy/75">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-gold">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">{log.actorName}</td>
                  <td className="px-4 py-3 text-navy/75">{log.targetName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-navy/60">{log.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}