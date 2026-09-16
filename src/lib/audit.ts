import { api } from "@/lib/api";

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.disable"
  | "user.enable"
  | "user.reset_password"
  | "user.delete"
  | "user.migrate"
  | "student.register"
  | "student.update"
  | "student.delete"
  | "class.create"
  | "class.update"
  | "class.delete"
  | "class.transfer"
  | "subject.create"
  | "subject.update"
  | "subject.delete"
  | "grade.entry"
  | "payment.add"
  | "warning.add"
  | "attendance.mark"
  | "expense.add"
  | "document.generate"
  | "bulletin.publish";

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

/**
 * Writes an audit event from the client. The server always resolves the actor
 * from the current session (never trusts the payload), and events that cannot
 * be recorded (e.g. offline) are swallowed so auditing never blocks the UI.
 */
export async function writeAuditEntry(input: {
  action: AuditAction;
  targetId?: string;
  targetName?: string;
  detail?: string;
}): Promise<void> {
  try {
    await api.post("/api/audit", input);
  } catch {
    // Auditing is best-effort from the client; never break the primary action.
  }
}