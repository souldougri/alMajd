import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  ClipboardList,
  Crown,
  GraduationCap,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { ConfirmDialog, Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { DUTY_LABELS, type SafeUser, type StaffDuty } from "@/lib/auth/types";
import { getUsers } from "@/lib/auth/users";
import {
  addBranchDuty,
  addBranchMember,
  addBranchTeacher,
  assignBranchFinancialOfficer,
  assignBranchHead,
  createBranch,
  getBranchDuties,
  getBranchFinancialOfficer,
  getBranchHead,
  getBranchMembers,
  getBranchTeachers,
  getBranches,
  removeBranchDuty,
  removeBranchFinancialOfficer,
  removeBranchHead,
  removeBranchMember,
  removeBranchTeacher,
  updateBranch,
  type Branch,
  type BranchDuty,
  type BranchFinancialOfficer,
  type BranchHead,
  type BranchMember,
  type BranchTeacher,
} from "@/lib/branches";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";
const labelCls = "mb-1 block text-sm font-semibold text-navy";
const selectCls = `${inputCls} min-h-11`;

type Details = {
  head: BranchHead | null;
  members: BranchMember[];
  teachers: BranchTeacher[];
  fo: BranchFinancialOfficer | null;
  duties: BranchDuty[];
};

const emptyDetails: Details = { head: null, members: [], teachers: [], fo: null, duties: [] };

type ConfirmState = { kind: "head" | "member" | "teacher" | "fo" | "duty"; id: string; label: string };

export function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ nameAr: "", nameFr: "", nameEn: "", address: "", phone: "", active: true });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [headUserId, setHeadUserId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [foUserId, setFoUserId] = useState("");
  const [dutyUserId, setDutyUserId] = useState("");
  const [dutyCode, setDutyCode] = useState<StaffDuty>("registrar");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshBranches(selectId?: string) {
    const list = await getBranches();
    setBranches(list);
    if (selectId !== undefined) {
      setSelectedId(selectId);
    } else if (selectedId && !list.some((b) => b.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }

  async function refreshDetails(branchId: string) {
    setDetailsLoading(true);
    try {
      const [head, members, teachers, fo, duties] = await Promise.all([
        getBranchHead(branchId),
        getBranchMembers(branchId),
        getBranchTeachers(branchId),
        getBranchFinancialOfficer(branchId),
        getBranchDuties(branchId),
      ]);
      setDetails({ head, members, teachers, fo, duties });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshAll(selectId?: string) {
    setLoading(true);
    setError("");
    try {
      const [list, allUsers] = await Promise.all([getBranches(), getUsers()]);
      setBranches(list);
      setUsers(allUsers);
      const target = selectId !== undefined ? selectId : (selectedId ?? list[0]?.id ?? null);
      setSelectedId(target);
      if (target) await refreshDetails(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الفروع");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => branches.find((b) => b.id === selectedId) ?? null, [branches, selectedId]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const staffOptions = useMemo(() => users.filter((u) => u.role === "staff" && u.active), [users]);
  const teacherOptions = useMemo(() => users.filter((u) => u.role === "teacher" && u.active), [users]);

  function userName(id: string): string {
    return userById.get(id)?.nameAr ?? "—";
  }

  async function runAction(fn: () => Promise<void>, okMessage: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refreshDetails(selected.id);
      setMessage(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ nameAr: "", nameFr: "", nameEn: "", address: "", phone: "", active: true });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({
      nameAr: branch.nameAr,
      nameFr: branch.nameFr ?? "",
      nameEn: branch.nameEn ?? "",
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      active: branch.active,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function submitBranch(e: FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      setFormError("يرجى إدخال اسم الفرع بالعربية");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        nameAr: form.nameAr.trim(),
        nameFr: form.nameFr.trim() || undefined,
        nameEn: form.nameEn.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        active: form.active,
      };
      if (editing) {
        const updated = await updateBranch(editing.id, payload);
        await refreshBranches(updated.id);
        await refreshDetails(updated.id);
        setMessage("تم حفظ بيانات الفرع بنجاح");
      } else {
        const created = await createBranch(payload);
        await refreshBranches(created.id);
        await refreshDetails(created.id);
        setMessage("تم إنشاء الفرع بنجاح");
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "تعذر حفظ الفرع");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!confirm || !selected) return;
    const target = confirm;
    setConfirm(null);
    const labels: Record<ConfirmState["kind"], string> = {
      head: "تم إلغاء مدير الفرع",
      member: "تمت إزالة الموظف من الفرع",
      teacher: "تمت إزالة المعلم من الفرع",
      fo: "تم إلغاء المسؤول المالي",
      duty: "تم إلغاء المسؤولية",
    };
    await runAction(async () => {
      if (target.kind === "head") await removeBranchHead(selected.id);
      else if (target.kind === "member") await removeBranchMember(selected.id, target.id);
      else if (target.kind === "teacher") await removeBranchTeacher(selected.id, target.id);
      else if (target.kind === "fo") await removeBranchFinancialOfficer(selected.id);
      else await removeBranchDuty(selected.id, target.id);
    }, labels[target.kind]);
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-navy/60">جارٍ تحميل الفروع…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">إدارة الفروع</h1>
          <p className="mt-1 text-sm text-navy/60">
            الهيكل التنظيمي للمجمع: الفروع، النُّظار، الموظفون، المعلمون، والمسؤول المالي.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-gold"
        >
          <Plus className="size-4" />
          فرع جديد
        </button>
      </div>

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{message}</p> : null}

      {branches.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
            <Building2 className="size-7" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-navy">لا توجد فروع بعد</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy/60">
            أنشئ الفرع الأول (مثلًا: الفرع الرئيسي)، ثم عيّن له ناظرًا وموظفين ومعلمين ومسؤولًا ماليًا.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={cn("space-y-2", selected && "max-lg:hidden")} aria-label="قائمة الفروع">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedId(b.id);
                  setMessage("");
                  setError("");
                  void refreshDetails(b.id);
                }}
                className={cn(
                  "w-full rounded-2xl border bg-white p-4 text-start shadow-sm transition-colors",
                  selectedId === b.id ? "border-gold" : "border-navy/10 hover:border-navy/25",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-navy">
                    <Building2 className="size-4 text-gold" />
                    {b.nameAr}
                  </span>
                  <span className="flex gap-1">
                    {b.isDefault ? <Badge tone="brand">رئيسي</Badge> : null}
                    <Badge tone={b.active ? "ok" : "muted"}>{b.active ? "نشط" : "مغلق"}</Badge>
                  </span>
                </div>
                {(b.address || b.phone) && (
                  <p className="mt-1 text-xs text-navy/55">
                    {[b.address, b.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </button>
            ))}
          </section>

          <section className={cn("space-y-4 lg:col-span-2", !selected && "max-lg:hidden")} aria-label="تفاصيل الفرع">
            {!selected ? (
              <p className="rounded-2xl border border-navy/10 bg-white p-8 text-center text-sm text-navy/55">
                اختر فرعًا من القائمة لعرض تفاصيله وإدارته.
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="mb-2 text-xs font-bold text-navy/55 underline underline-offset-4 lg:hidden"
                      >
                        → رجوع إلى قائمة الفروع
                      </button>
                      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy">
                        <Building2 className="size-5 text-gold" />
                        {selected.nameAr}
                      </h2>
                      <p className="mt-1 text-xs text-navy/55">
                        {[selected.nameFr, selected.nameEn, selected.address, selected.phone].filter(Boolean).join(" · ") || "بدون تفاصيل إضافية"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(selected)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 py-2 text-sm font-bold text-navy hover:bg-cream"
                    >
                      <Pencil className="size-4" />
                      تعديل
                    </button>
                  </div>
                </div>

                {detailsLoading ? (
                  <p className="py-6 text-center text-sm text-navy/60">جارٍ تحميل تفاصيل الفرع…</p>
                ) : (
                  <>
                    <HeadCard
                      head={details.head}
                      userName={userName}
                      staffOptions={staffOptions}
                      headUserId={headUserId}
                      setHeadUserId={setHeadUserId}
                      busy={busy}
                      onAssign={() =>
                        runAction(async () => {
                          if (!headUserId) throw new Error("اختر الموظف المراد تعيينه ناظرًا");
                          await assignBranchHead(selected.id, headUserId);
                          setHeadUserId("");
                        }, "تم تعيين ناظر الفرع بنجاح")
                      }
                      onRemove={() =>
                        details.head &&
                        setConfirm({ kind: "head", id: details.head.userId, label: userName(details.head.userId) })
                      }
                    />

                    <OfficerCard
                      fo={details.fo}
                      userName={userName}
                      staffOptions={staffOptions}
                      foUserId={foUserId}
                      setFoUserId={setFoUserId}
                      busy={busy}
                      onAssign={() =>
                        runAction(async () => {
                          if (!foUserId) throw new Error("اختر الموظف المراد تعيينه مسؤولًا ماليًا");
                          await assignBranchFinancialOfficer(selected.id, foUserId);
                          setFoUserId("");
                        }, "تم تعيين المسؤول المالي بنجاح")
                      }
                      onRemove={() =>
                        details.fo &&
                        setConfirm({ kind: "fo", id: details.fo.userId, label: userName(details.fo.userId) })
                      }
                    />

                    <MembersCard
                      members={details.members}
                      userName={userName}
                      staffOptions={staffOptions}
                      memberUserId={memberUserId}
                      setMemberUserId={setMemberUserId}
                      busy={busy}
                      onAdd={() =>
                        runAction(async () => {
                          if (!memberUserId) throw new Error("اختر الموظف المراد إلحاقه بالفرع");
                          await addBranchMember(selected.id, memberUserId);
                          setMemberUserId("");
                        }, "تم إلحاق الموظف بالفرع")
                      }
                      onRemove={(m) => setConfirm({ kind: "member", id: m.userId, label: userName(m.userId) })}
                    />

                    <TeachersCard
                      teachers={details.teachers}
                      userName={userName}
                      teacherOptions={teacherOptions}
                      teacherUserId={teacherUserId}
                      setTeacherUserId={setTeacherUserId}
                      busy={busy}
                      onAdd={() =>
                        runAction(async () => {
                          if (!teacherUserId) throw new Error("اختر المعلم المراد إلحاقه بالفرع");
                          await addBranchTeacher(selected.id, teacherUserId);
                          setTeacherUserId("");
                        }, "تم إلحاق المعلم بالفرع")
                      }
                      onRemove={(t) => setConfirm({ kind: "teacher", id: t.teacherUserId, label: userName(t.teacherUserId) })}
                    />

                    <DutiesCard
                      duties={details.duties}
                      userName={userName}
                      staffOptions={staffOptions}
                      dutyUserId={dutyUserId}
                      setDutyUserId={setDutyUserId}
                      dutyCode={dutyCode}
                      setDutyCode={setDutyCode}
                      busy={busy}
                      onAdd={() =>
                        runAction(async () => {
                          if (!dutyUserId) throw new Error("اختر الموظف المراد تفويضه");
                          await addBranchDuty(selected.id, dutyUserId, dutyCode);
                          setDutyUserId("");
                        }, "تم تفويض المسؤولية بنجاح")
                      }
                      onRemove={(d) => setConfirm({ kind: "duty", id: d.id, label: `${userName(d.userId)} — ${DUTY_LABELS[d.dutyCode as StaffDuty]?.ar ?? d.dutyCode}` })}
                    />

                    <AuthorityExplainer />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {formOpen ? (
        <Modal open={formOpen} onClose={() => setFormOpen(false)} size="md">
          <ModalHeader>
            <h3 className="font-display text-xl font-bold text-navy">{editing ? "تعديل الفرع" : "إنشاء فرع جديد"}</h3>
          </ModalHeader>
          <ModalContent>
            <form id="branch-form" onSubmit={submitBranch} className="space-y-4">
              <div>
                <label className={labelCls}>اسم الفرع بالعربية *</label>
                <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>الاسم بالفرنسية</label>
                  <input className={inputCls} value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>الاسم بالإنجليزية</label>
                  <input className={inputCls} dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>العنوان</label>
                <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>الهاتف</label>
                <input className={inputCls} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              {editing ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  الفرع نشط
                </label>
              ) : null}
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </form>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              className="min-h-11 rounded-full border border-navy/15 px-5 py-2.5 text-sm text-navy hover:bg-cream"
              onClick={() => setFormOpen(false)}
            >
              إلغاء
            </button>
            <button
              type="submit"
              form="branch-form"
              disabled={saving}
              className="min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </ModalFooter>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title="تأكيد الإزالة"
        description={confirm ? `هل أنت متأكد من إزالة «${confirm.label}»؟` : undefined}
        confirmLabel="نعم، إزالة"
        cancelLabel="إلغاء"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Users;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <Icon className="size-4 text-gold" />
        {title}
      </h3>
      <p className="mt-1 text-xs text-navy/55">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PersonRow({
  name,
  sub,
  onRemove,
}: {
  name: string;
  sub?: string;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-navy/10 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-navy">{name}</p>
        {sub ? <p className="truncate text-xs text-navy/55">{sub}</p> : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`إزالة ${name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

function AssignRow({
  label,
  selectLabel,
  options,
  value,
  onChange,
  onAdd,
  busy,
  note,
}: {
  label: string;
  selectLabel: string;
  options: Array<{ id: string; name: string; hint?: string }>;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  busy: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-cream-subtle p-3">
      <p className="mb-2 text-sm font-bold text-navy">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={selectLabel}
          className={cn(selectCls, "min-w-0 flex-1")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{selectLabel}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.hint ? ` — ${o.hint}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAdd}
          disabled={busy || !value}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50"
        >
          <Plus className="size-4" />
          إضافة
        </button>
      </div>
      {note ? <p className="mt-2 text-xs leading-relaxed text-navy/55">{note}</p> : null}
    </div>
  );
}

function HeadCard(props: {
  head: BranchHead | null;
  userName: (id: string) => string;
  staffOptions: SafeUser[];
  headUserId: string;
  setHeadUserId: (v: string) => void;
  busy: boolean;
  onAssign: () => void;
  onRemove: () => void;
}) {
  const { head } = props;
  const available = props.staffOptions.filter((u) => u.id !== head?.userId);
  return (
    <SectionCard icon={Crown} title="ناظر الفرع" hint="المدير المباشر للفرع — يُعيَّن من حسابات الموظفين، ويدير فرعه فقط.">
      {head ? (
        <ul className="space-y-2">
          <PersonRow name={props.userName(head.userId)} sub={head.userEmail} onRemove={props.onRemove} />
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لم يُعيَّن ناظر لهذا الفرع بعد.
        </p>
      )}
      <div className="mt-3">
        <AssignRow
          label={head ? "تغيير الناظر" : "تعيين الناظر"}
          selectLabel="اختر موظفًا…"
          options={available.map((u) => ({ id: u.id, name: u.nameAr, hint: u.email }))}
          value={props.headUserId}
          onChange={props.setHeadUserId}
          onAdd={props.onAssign}
          busy={props.busy}
        />
      </div>
    </SectionCard>
  );
}

function OfficerCard(props: {
  fo: BranchFinancialOfficer | null;
  userName: (id: string) => string;
  staffOptions: SafeUser[];
  foUserId: string;
  setFoUserId: (v: string) => void;
  busy: boolean;
  onAssign: () => void;
  onRemove: () => void;
}) {
  const { fo } = props;
  const available = props.staffOptions.filter((u) => u.id !== fo?.userId);
  return (
    <SectionCard
      icon={Wallet}
      title="المسؤول المالي"
      hint="مسؤول مالي واحد لكل فرع، يتبع المدير العام مباشرة (وليس الناظر)، وقد يغطي عدة فروع."
    >
      {fo ? (
        <ul className="space-y-2">
          <PersonRow name={props.userName(fo.userId)} sub={fo.userEmail} onRemove={props.onRemove} />
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا يوجد مسؤول مالي لهذا الفرع بعد.
        </p>
      )}
      <div className="mt-3">
        <AssignRow
          label={fo ? "تغيير المسؤول المالي" : "تعيين المسؤول المالي"}
          selectLabel="اختر موظفًا…"
          options={available.map((u) => ({ id: u.id, name: u.nameAr, hint: u.email }))}
          value={props.foUserId}
          onChange={props.setFoUserId}
          onAdd={props.onAssign}
          busy={props.busy}
        />
      </div>
    </SectionCard>
  );
}

function MembersCard(props: {
  members: BranchMember[];
  userName: (id: string) => string;
  staffOptions: SafeUser[];
  memberUserId: string;
  setMemberUserId: (v: string) => void;
  busy: boolean;
  onAdd: () => void;
  onRemove: (m: BranchMember) => void;
}) {
  const taken = new Set(props.members.map((m) => m.userId));
  return (
    <SectionCard icon={Users} title={`موظفو الفرع (${props.members.length})`} hint="الموظفون الملحقون بهذا الفرع — يعملون ضمن نطاق فرعهم فقط.">
      {props.members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا يوجد موظفون ملحقون بهذا الفرع بعد.
        </p>
      ) : (
        <ul className="space-y-2">
          {props.members.map((m) => (
            <PersonRow key={m.id} name={props.userName(m.userId)} onRemove={() => props.onRemove(m)} />
          ))}
        </ul>
      )}
      <div className="mt-3">
        <AssignRow
          label="إلحاق موظف"
          selectLabel="اختر موظفًا…"
          options={props.staffOptions.filter((u) => !taken.has(u.id)).map((u) => ({ id: u.id, name: u.nameAr, hint: u.email }))}
          value={props.memberUserId}
          onChange={props.setMemberUserId}
          onAdd={props.onAdd}
          busy={props.busy}
        />
      </div>
    </SectionCard>
  );
}

function TeachersCard(props: {
  teachers: BranchTeacher[];
  userName: (id: string) => string;
  teacherOptions: SafeUser[];
  teacherUserId: string;
  setTeacherUserId: (v: string) => void;
  busy: boolean;
  onAdd: () => void;
  onRemove: (t: BranchTeacher) => void;
}) {
  const taken = new Set(props.teachers.map((t) => t.teacherUserId));
  return (
    <SectionCard
      icon={GraduationCap}
      title={`معلمو الفرع (${props.teachers.length})`}
      hint="المعلم قد يدرّس في عدة فروع — إلحاقه هنا لا يلغي إلحاقه بفرع آخر."
    >
      {props.teachers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا يوجد معلمون ملحقون بهذا الفرع بعد.
        </p>
      ) : (
        <ul className="space-y-2">
          {props.teachers.map((t) => (
            <PersonRow key={t.id} name={props.userName(t.teacherUserId)} onRemove={() => props.onRemove(t)} />
          ))}
        </ul>
      )}
      <div className="mt-3">
        <AssignRow
          label="إلحاق معلم"
          selectLabel="اختر معلمًا…"
          options={props.teacherOptions.filter((u) => !taken.has(u.id)).map((u) => ({ id: u.id, name: u.nameAr, hint: u.email }))}
          value={props.teacherUserId}
          onChange={props.setTeacherUserId}
          onAdd={props.onAdd}
          busy={props.busy}
        />
      </div>
    </SectionCard>
  );
}

function DutiesCard(props: {
  duties: BranchDuty[];
  userName: (id: string) => string;
  staffOptions: SafeUser[];
  dutyUserId: string;
  setDutyUserId: (v: string) => void;
  dutyCode: StaffDuty;
  setDutyCode: (v: StaffDuty) => void;
  busy: boolean;
  onAdd: () => void;
  onRemove: (d: BranchDuty) => void;
}) {
  return (
    <SectionCard
      icon={ClipboardList}
      title={`المسؤوليات التشغيلية (${props.duties.length})`}
      hint="تفويض المهام داخل الفرع: أمين السجل، الشؤون الدراسية، المحاسبة، الإشراف."
    >
      {props.duties.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد مسؤوليات مفوَّضة في هذا الفرع بعد.
        </p>
      ) : (
        <ul className="space-y-2">
          {props.duties.map((d) => (
            <PersonRow
              key={d.id}
              name={props.userName(d.userId)}
              sub={DUTY_LABELS[d.dutyCode as StaffDuty]?.ar ?? d.dutyCode}
              onRemove={() => props.onRemove(d)}
            />
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">تفويض مسؤولية</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="الموظف" className={selectCls} value={props.dutyUserId} onChange={(e) => props.setDutyUserId(e.target.value)}>
            <option value="">اختر موظفًا…</option>
            {props.staffOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nameAr}
              </option>
            ))}
          </select>
          <select aria-label="المهمة" className={selectCls} value={props.dutyCode} onChange={(e) => props.setDutyCode(e.target.value as StaffDuty)}>
            {(Object.keys(DUTY_LABELS) as StaffDuty[]).map((d) => (
              <option key={d} value={d}>
                {DUTY_LABELS[d].ar}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={props.onAdd}
          disabled={props.busy || !props.dutyUserId}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          تفويض
        </button>
      </div>
    </SectionCard>
  );
}

function AuthorityExplainer() {
  const items = [
    { icon: ShieldCheck, title: "المدير العام", body: "أعلى سلطة: ينشئ الفروع والحسابات، ويعيّن النُّظار والمسؤولين الماليين." },
    { icon: Crown, title: "ناظر الفرع", body: "يدير فرعه فقط، ولا ينشئ حسابات نظام." },
    { icon: Wallet, title: "المسؤول المالي", body: "يتبع المدير العام مباشرة، واحد لكل فرع، وقد يغطي عدة فروع." },
    { icon: GraduationCap, title: "المعلم", body: "قد يدرَّس في عدة فروع عبر إلحاقات متعددة." },
  ];
  return (
    <section className="rounded-2xl border border-gold/25 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-navy">علاقات الصلاحيات والنطاق</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-xl bg-cream-subtle p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-gold">
              <item.icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-navy">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">{item.body}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
