import { api } from "@/lib/api";

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.disable"
  | "user.enable"
  | "user.reset_password"
  | "user.delete"
  | "user.migrate";

export type AuditLog = {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
  createdAt: string;
};

/** Lists audit events (requires super_admin). */
export async function listAuditLogs(): Promise<AuditLog[]> {
  const res = await api.get<{ logs: AuditLog[] }>("/api/audit");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل سجل التدقيق");
  return res.data?.logs ?? [];
}