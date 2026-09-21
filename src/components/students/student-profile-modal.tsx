import { useEffect, useState } from "react";
import { KeyRound, Pencil, UserRound, Users } from "lucide-react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  getStudentDetails,
  getStudentLoginStatus,
  type BranchStudent,
  type BranchStudentDetails,
  type StudentLoginStatus,
} from "@/lib/branches";
import { GENDER_AR } from "@/lib/print";
import { money } from "@/lib/school";
import { cn } from "@/lib/utils";

type StudentProfileModalProps = {
  open: boolean;
  onClose: () => void;
  /** List item (immediate paint); full record loads from the server. */
  student: BranchStudent | null;
  onEdit: (s: BranchStudent) => void;
  onCredentials: (s: BranchStudent) => void;
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 px-3 py-2.5 text-sm">
      <span className="shrink-0 font-semibold text-navy/55">{k}</span>
      <span className="min-w-0 truncate text-start font-bold text-navy">{v}</span>
    </div>
  );
}

/**
 * Read-only student file for the branch portal: full record + account
 * status (login emails only — passwords are never stored nor re-exposed)
 * with shortcuts to the existing edit and login-account flows.
 */
export function StudentProfileModal({ open, onClose, student, onEdit, onCredentials }: StudentProfileModalProps) {
  const [details, setDetails] = useState<BranchStudentDetails | null>(null);
  const [logins, setLogins] = useState<StudentLoginStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !student) {
      setDetails(null);
      setLogins(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getStudentDetails(student.id), getStudentLoginStatus(student.id)])
      .then(([d, l]) => {
        if (cancelled) return;
        setDetails(d);
        setLogins(l);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل ملف الطالب");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, student]);

  const name = details?.nameAr ?? student?.nameAr ?? "";
  const klass = details?.klass || student?.klass || "";

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader>
        <h3 className="flex items-center gap-2 font-display text-xl font-bold text-navy">
          <UserRound className="size-5 text-gold" />
          ملف الطالب
        </h3>
        <p className="mt-1 truncate text-sm text-navy/60">{name}</p>
      </ModalHeader>
      <ModalContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-navy/55">جارٍ تحميل ملف الطالب…</p>
        ) : error ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {klass ? <Badge tone="brand">فصل {klass}</Badge> : null}
              {details?.branchNameAr ? <Badge>فرع {details.branchNameAr}</Badge> : null}
              {details?.gender ? <Badge>{GENDER_AR[details.gender as keyof typeof GENDER_AR] ?? details.gender}</Badge> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row k="الاسم باللاتينية" v={details?.nameFr || "—"} />
              <Row k="تاريخ الميلاد" v={details?.dob || "—"} />
              <Row k="ولي الأمر" v={details?.parentAr || "—"} />
              <Row k="الهاتف" v={details?.phone || "—"} />
              <Row k="تاريخ القيد" v={details?.enrolled || "—"} />
              <Row k="الرسوم السنوية" v={details?.annualFee !== undefined ? money(details.annualFee) : "—"} />
            </div>
            <div className={cn("rounded-xl bg-cream-subtle p-3")}>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy">
                <KeyRound className="size-4 text-gold" />
                حسابات الدخول
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-navy/60">حساب الطالب</span>
                  <span dir="ltr" className="truncate font-bold text-navy">{logins?.student?.email ?? "لا يوجد حساب"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-navy/60">حساب ولي الأمر</span>
                  <span dir="ltr" className="truncate font-bold text-navy">{logins?.parent?.email ?? "لا يوجد حساب"}</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-navy/55">
                كلمات المرور تُعرض مرة واحدة لحظة الإنشاء فقط ولا تُحفظ في أي مكان — لاسترجاع حساب استخدم «حساب دخول».
              </p>
            </div>
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-navy/15 px-4 py-2 text-sm font-bold text-navy hover:bg-cream"
          onClick={() => {
            if (student) {
              onClose();
              onEdit(student);
            }
          }}
          disabled={!student}
        >
          <Pencil className="size-4" />
          تعديل
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-navy/15 px-4 py-2 text-sm font-bold text-navy hover:bg-cream"
          onClick={() => {
            if (student) {
              onClose();
              onCredentials(student);
            }
          }}
          disabled={!student}
        >
          <Users className="size-4" />
          حساب دخول
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy"
          onClick={onClose}
        >
          إغلاق
        </button>
      </ModalFooter>
    </Modal>
  );
}
