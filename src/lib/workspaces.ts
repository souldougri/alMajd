import type { Role, StaffDuty } from "@/lib/auth/types";

export type WorkspaceId = "registrar" | "academic" | "accountant" | "supervisor";

/** The staff duty that unlocks each workspace. */
export const WORKSPACE_DUTY: Record<WorkspaceId, StaffDuty> = {
  registrar: "registrar",
  academic: "academic",
  accountant: "accountant",
  supervisor: "supervisor",
};

export const WORKSPACE_LABELS: Record<WorkspaceId, { ar: string; fr: string; en: string; route: string; desc: string }> = {
  registrar: {
    ar: "التسجيل",
    fr: "Registraire",
    en: "Registrar",
    route: "/app/registrar",
    desc: "سجل الطلاب، القيد، تحويل الصف، حسابات الدخول.",
  },
  academic: {
    ar: "الشؤون الدراسية",
    fr: "Académique",
    en: "Academic",
    route: "/app/academic",
    desc: "الفصول، المواد، الفترات، الدرجات، الجدول الزمني.",
  },
  accountant: {
    ar: "المحاسبة",
    fr: "Comptable",
    en: "Finance",
    route: "/app/accountant",
    desc: "الرسوم، الدفعات، الإيصالات، سجل الإنفاق.",
  },
  supervisor: {
    ar: "الإشراف",
    fr: "Surveillant",
    en: "Supervision",
    route: "/app/supervisor",
    desc: "تحضير الحضور والغياب والتأخير بالصف والتاريخ.",
  },
};

/** Workspaces granted to an account: super_admin sees all, staff see their duties. */
export function allowedWorkspaces(role: Role, duties: StaffDuty[]): WorkspaceId[] {
  const ids = Object.keys(WORKSPACE_DUTY) as WorkspaceId[];
  if (role === "super_admin") return ids;
  if (role === "staff") {
    return ids.filter((ws) => duties.includes(WORKSPACE_DUTY[ws]));
  }
  return [];
}

export function canAccessWorkspace(role: Role, duties: StaffDuty[], ws: WorkspaceId): boolean {
  return allowedWorkspaces(role, duties).includes(ws);
}