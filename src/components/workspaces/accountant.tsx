import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ReceiptText, Wallet } from "lucide-react";
import { FeesView } from "@/components/desk/ops";
import { PrintProvider } from "@/components/desk/print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceFrame } from "@/components/workspaces/workspace-frame";
import { money, todayIso } from "@/lib/school";
import { useSchool } from "@/lib/store";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";

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

export function AccountantPage() {
  return (
    <WorkspaceFrame ws="accountant">
      <div className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm sm:p-6">
        <PrintProvider>
          <AccountantTabs />
        </PrintProvider>
      </div>
    </WorkspaceFrame>
  );
}

function AccountantTabs() {
  const [tab, setTab] = useState<"payments" | "outstanding" | "feeTypes" | "expenses">("payments");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
          <ReceiptText className="size-4" />
          الدفعات
        </TabButton>
        <TabButton active={tab === "outstanding"} onClick={() => setTab("outstanding")}>
          <Wallet className="size-4" />
          المستحقات
        </TabButton>
        <TabButton active={tab === "feeTypes"} onClick={() => setTab("feeTypes")}>
          <Wallet className="size-4" />
          أنواع الرسوم
        </TabButton>
        <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
          <Wallet className="size-4" />
          سجل الإنفاق
        </TabButton>
      </div>

      {tab === "payments" ? <FeesView /> : null}
      {tab === "outstanding" ? <OutstandingPanel /> : null}
      {tab === "feeTypes" ? <FeeTypesPanel /> : null}
      {tab === "expenses" ? <ExpensesPanel /> : null}
    </div>
  );
}

function OutstandingPanel() {
  const students = useSchool((s) => s.students);
  const paidOf = useSchool((s) => s.paidOf);

  const rows = useMemo(() => {
    return students
      .map((s) => {
        const paid = paidOf(s.id);
        return {
          student: s,
          paid,
          remaining: Math.max(0, s.annualFee - paid),
        };
      })
      .filter((r) => r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [students, paidOf]);

  const totals = useMemo(
    () => ({
      due: students.reduce((n, s) => n + s.annualFee, 0),
      paid: students.reduce((n, s) => n + paidOf(s.id), 0),
      remaining: students.reduce((n, s) => n + Math.max(0, s.annualFee - paidOf(s.id)), 0),
    }),
    [students, paidOf],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="مستحق (الرسوم السنوية)" value={money(totals.due)} />
        <StatCard label="المحصّل" value={money(totals.paid)} tone="ok" />
        <StatCard label="المتبقي" value={money(totals.remaining)} tone={totals.remaining > 0 ? "warn" : "ok"} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-navy/10">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">الطالب</th>
              <th className="px-4 py-3 font-bold">الصف</th>
              <th className="px-4 py-3 font-bold">الرسوم السنوية</th>
              <th className="px-4 py-3 font-bold">المحصّل</th>
              <th className="px-4 py-3 font-bold">الباقي</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy/50">
                  جميع الرسوم مسددة بالكامل.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.student.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy">{r.student.nameAr}</td>
                  <td className="px-4 py-3 text-navy/70">{r.student.klass}</td>
                  <td className="px-4 py-3">{money(r.student.annualFee)}</td>
                  <td className="px-4 py-3">{money(r.paid)}</td>
                  <td className="px-4 py-3 font-bold text-warn">{money(r.remaining)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-cream p-4">
      <p className="text-xs font-semibold text-navy/55">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold", tone === "ok" ? "text-success" : tone === "warn" ? "text-warn" : "text-navy")}>
        {value}
      </p>
    </div>
  );
}

const EXPENSE_CATEGORIES = ["قرطاسية", "صيانة", "كهرباء وماء", "مواصلات", "ملابس مدرسية", "أخرى"];

function FeeTypesPanel() {
  const feeTypes = useSchool((s) => s.feeTypes);
  const addFeeType = useSchool((s) => s.addFeeType);
  const deleteFeeType = useSchool((s) => s.deleteFeeType);
  const [nameAr, setNameAr] = useState("");
  const [amount, setAmount] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    addFeeType({ nameAr: nameAr.trim(), amount: Number(amount) || 0, active: true });
    setNameAr("");
    setAmount("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-navy/10 bg-cream p-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label>اسم نوع الرسوم</Label>
          <Input className={inputCls} value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: رسوم الفصل الأول" required />
        </div>
        <div className="grid gap-1">
          <Label>المبلغ</Label>
          <Input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div className="flex items-end">
          <Button type="submit">إضافة نوع</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-navy/10">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">نوع الرسوم</th>
              <th className="px-4 py-3 font-bold">المبلغ</th>
              <th className="px-4 py-3 text-center font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {feeTypes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-navy/50">
                  لا توجد أنواع رسوم بعد. أضف النوع الأول أعلاه.
                </td>
              </tr>
            ) : (
              feeTypes.map((ft) => (
                <tr key={ft.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy">{ft.nameAr}</td>
                  <td className="px-4 py-3">{money(ft.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger hover:text-white"
                      onClick={() => deleteFeeType(ft.id)}
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

function ExpensesPanel() {
  const expenses = useSchool((s) => s.expenses);
  const addExpense = useSchool((s) => s.addExpense);
  const deleteExpense = useSchool((s) => s.deleteExpense);
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");

  const total = useMemo(() => expenses.reduce((n, e) => n + e.amount, 0), [expenses]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (amt <= 0) return;
    addExpense({
      date,
      category,
      amount: amt,
      vendor: vendor.trim() || undefined,
      note: note.trim() || "—",
    });
    setAmount("");
    setVendor("");
    setNote("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-navy/10 bg-cream p-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label>التاريخ</Label>
          <Input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label>التصنيف</Label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label>المبلغ</Label>
          <Input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" required />
        </div>
        <div className="grid gap-1">
          <Label>المورّد (اختياري)</Label>
          <Input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="اسم المحل/المزوّد" />
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <Label>البيان</Label>
          <Input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="وصف العملية (فاتورة إنفاق)…" />
        </div>
        <div className="flex items-end">
          <Button type="submit">تسجيل الإنفاق</Button>
        </div>
      </form>

      <p className="text-sm text-navy/60">
        إجمالي الإنفاق المسجل: <b className="text-navy">{money(total)}</b>
      </p>

      <div className="overflow-x-auto rounded-2xl border border-navy/10">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">التاريخ</th>
              <th className="px-4 py-3 font-bold">التصنيف</th>
              <th className="px-4 py-3 font-bold">المورّد</th>
              <th className="px-4 py-3 font-bold">البيان</th>
              <th className="px-4 py-3 font-bold">المبلغ</th>
              <th className="px-4 py-3 text-center font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-navy/50">
                  لا توجد عمليات إنفاق مسجلة بعد.
                </td>
              </tr>
            ) : (
              expenses.map((ex) => (
                <tr key={ex.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3">{ex.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-cream-subtle px-2.5 py-0.5 text-xs font-semibold text-navy/70">{ex.category}</span>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{ex.vendor || "—"}</td>
                  <td className="px-4 py-3 text-navy/70">{ex.note}</td>
                  <td className="px-4 py-3 font-bold text-navy">{money(ex.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger hover:text-white"
                      onClick={() => deleteExpense(ex.id)}
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