/**
 * In-app notifications: super_admin composer + per-user read state.
 *
 * Targets are stored declaratively; visibility is resolved at query time for
 * the requesting account, so newly created users immediately receive broadcasts.
 *
 * Server-only module — never import from client code.
 */
import { getDb } from "./db";
import { ApiError } from "./http";
import { uid } from "./auth";
import { getUserBranchScope, isAllScope } from "./scope";
import type { SafeUser } from "@/lib/auth/types";

export type NotificationTarget =
  | "one_staff"
  | "all_staff"
  | "one_teacher"
  | "all_teachers"
  | "one_student"
  | "all_students"
  | "one_class";

export type NotificationType = "general" | "fees" | "exam" | "news";

const TARGETS = new Set<NotificationType | NotificationTarget>([
  "one_staff",
  "all_staff",
  "one_teacher",
  "all_teachers",
  "one_student",
  "all_students",
  "one_class",
]);

export type NotificationComposeInput = {
  title?: unknown;
  body?: unknown;
  type?: unknown;
  target?: unknown;
  userId?: unknown;
  classId?: unknown;
  branchIds?: unknown;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  target: NotificationTarget;
  userId?: string;
  classId?: string;
  createdAt: string;
  read: boolean;
};

export type ComposedNotification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  target: NotificationTarget;
  userId?: string;
  classId?: string;
  recipientName?: string;
  createdByName?: string;
  createdAt: string;
};

function cleanStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isTarget(v: unknown): v is NotificationTarget {
  return typeof v === "string" && TARGETS.has(v as NotificationTarget);
}

function isType(v: unknown): v is NotificationType {
  return typeof v === "string" && ["general", "fees", "exam", "news"].includes(v);
}

/**
 * Resolves the app-level target hint to the stored (target, userId/classId).
 * One-user targets must carry a concrete recipient account id.
 */
function normalizeTarget(
  target: NotificationTarget,
  userId: unknown,
  classId: unknown,
): { target: NotificationTarget; userId: string | null; classId: string | null } {
  const oneUser = target === "one_staff" || target === "one_teacher" || target === "one_student";
  if (oneUser) {
    const id = cleanStr(userId);
    if (!id) throw new ApiError("حدد المستلم لهذا الإشعار (مستخدم واحد)");
    return { target, userId: id, classId: null };
  }
  if (target === "one_class") {
    const id = cleanStr(classId);
    if (!id) throw new ApiError("حدد الصف المستلم لهذا الإشعار");
    return { target, userId: null, classId: id };
  }
  return { target, userId: null, classId: null };
}

export async function composeNotification(
  input: NotificationComposeInput,
  actor: SafeUser,
): Promise<ComposedNotification> {
  if (!isTarget(input.target)) {
    throw new ApiError("وجهة الإشعار غير صالحة");
  }
  const title = cleanStr(input.title);
  if (!title) throw new ApiError("عنوان الإشعار مطلوب");
  const { target, userId, classId } = normalizeTarget(input.target, input.userId, input.classId);
  const type = isType(input.type) ? input.type : "general";
  const now = new Date().toISOString();
  const id = uid("not");

  const branchIds = await resolveBranchIds(input.branchIds, actor);

  await (
    await getDb()
  ).query(
    `INSERT INTO notifications (id, title, body, type, target, user_id, class_id, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, title, cleanStr(input.body), type, target, userId, classId, actor.id, now],
  );

  if (target === "all_staff" || target === "all_teachers" || target === "all_students") {
    for (const bid of branchIds) {
      await (await getDb()).query(
        "INSERT INTO notification_branches (notification_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id, bid],
      );
    }
  }

  const sent = await findNotification(id);
  return {
    id: sent.id,
    title: sent.title,
    body: sent.body,
    type: sent.type,
    target: sent.target,
    userId: sent.userId,
    classId: sent.classId,
    createdByName: actor.nameAr,
    createdAt: sent.createdAt,
  };
}

/**
 * Validates branch scoping for broadcast targets: non-super-admins may only
 * target branches inside their own scope. Returns the resolved branch list
 * (empty means all branches).
 */
export async function resolveBranchIds(branchIds: unknown, actor: SafeUser): Promise<string[]> {
  if (branchIds === undefined || branchIds === null) return [];
  const requested = Array.isArray(branchIds)
    ? branchIds.filter((b): b is string => typeof b === "string" && b.length > 0)
    : typeof branchIds === "string" && branchIds
      ? [branchIds]
      : [];
  if (requested.length === 0) return [];
  const extra = requested.filter((id) => id.startsWith("branch:"));
  const norm = requested.filter((id) => !id.startsWith("branch:"));
  const all = [...norm, ...extra.map((id) => id.slice("branch:".length))];
  const scope = await getUserBranchScope(actor);
  if (!isAllScope(scope)) {
    const allowed = new Set(scope);
    const denied = all.filter((id) => !allowed.has(id));
    if (denied.length > 0) {
      throw new ApiError("لا يمكنك إرسال إشعارات لفرع خارج صلاحياتك", 403);
    }
  }
  return [...new Set(all)];
}

async function findNotification(id: string): Promise<NotificationRow> {
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title, body, type, target, user_id, class_id, created_at
     FROM notifications WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    type: String(row.type) as NotificationType,
    target: String(row.target) as NotificationTarget,
    userId: row.user_id ? String(row.user_id) : undefined,
    classId: row.class_id ? String(row.class_id) : undefined,
    createdAt: String(row.created_at),
    read: false,
  };
}

/** Class ids relevant to a user (teacher → assigned classes, student → own class). */
async function userClassIds(user: SafeUser): Promise<Set<string>> {
  const ids = new Set<string>();
  const db = await getDb();
  if (user.role === "student" && user.studentId) {
    const enrolled = await db.query(
      "SELECT class_id FROM student_class_enrollments WHERE student_id = $1 AND status = 'enrolled' AND is_current = true",
      [user.studentId],
    );
    for (const r of enrolled.rows) ids.add(String(r.class_id));
    return ids;
  }
  if (user.role === "teacher") {
    const classes = await db.query(
      `SELECT c.id FROM classes c WHERE c.head_teacher_user_id = $1 AND c.active = true
       UNION
       SELECT ta.class_id FROM teaching_assignments ta WHERE ta.teacher_user_id = $1`,
      [user.id],
    );
    for (const r of classes.rows) ids.add(String(r.id));
  }
  return ids;
}

/** Branch ids a broadcast notification is restricted to ([] = all branches). */
async function notificationBranchIds(notificationId: string): Promise<string[]> {
  const result = await (
    await getDb()
  ).query("SELECT branch_id FROM notification_branches WHERE notification_id = $1", [notificationId]);
  return result.rows.map((r) => String(r.branch_id));
}

/**
 * Whether an account shares at least one branch with a broadcast. True when
 * there is no restriction ([]) or the scopes intersect.
 */
async function branchTouchesUser(branchIds: string[], user: SafeUser): Promise<boolean> {
  if (branchIds.length === 0) return true;
  const userScope = await getUserBranchScope(user);
  if (isAllScope(userScope)) return true;
  const userBranches = new Set(userScope);
  return branchIds.some((bid) => userBranches.has(bid));
}

/** Whether an alert applies to the given account. */
export async function notificationAppliesTo(alert: NotificationRow, user: SafeUser): Promise<boolean> {
  switch (alert.target) {
    case "all_students":
      return user.role === "student";
    case "all_teachers":
      return user.role === "teacher";
    case "all_staff":
      return user.role === "staff" || user.role === "super_admin";
    case "one_staff":
    case "one_teacher":
    case "one_student":
      return alert.userId === user.id;
    case "one_class": {
      if (user.role !== "teacher" && user.role !== "student") return false;
      if (!alert.classId) return false;
      const ids = await userClassIds(user);
      return ids.has(alert.classId);
    }
  }
}

/**
 * Returns the notifications visible to the requesting account with their read
 * state and the unread count.
 */
export async function listNotificationsForUser(user: SafeUser): Promise<{
  unreadCount: number;
  notifications: NotificationRow[];
}> {
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title, body, type, target, user_id, class_id, created_by_user_id, created_at
     FROM notifications ORDER BY created_at DESC, id DESC LIMIT 100`,
  );

  const rows: Array<{ not: NotificationRow; createdByName?: string }> = [];
  for (const r of result.rows) {
    rows.push({
      not: {
        id: String(r.id),
        title: String(r.title),
        body: String(r.body),
        type: String(r.type) as NotificationType,
        target: String(r.target) as NotificationTarget,
        userId: r.user_id ? String(r.user_id) : undefined,
        classId: r.class_id ? String(r.class_id) : undefined,
        createdAt: String(r.created_at),
        read: false,
      },
      createdByName: r.created_by_user_id ? String(r.created_by_user_id) : undefined,
    });
  }

  const visible: NotificationRow[] = [];
  for (const { not } of rows) {
    if (await notificationAppliesTo(not, user)) {
      if (not.target === "all_staff" || not.target === "all_teachers" || not.target === "all_students") {
        const branchIds = await notificationBranchIds(not.id);
        if (!(await branchTouchesUser(branchIds, user))) continue;
      }
      visible.push(not);
    }
  }
  if (visible.length === 0) return { unreadCount: 0, notifications: [] };

  const readResult = await (
    await getDb()
  ).query(
    `SELECT notification_id, read_at FROM notification_reads WHERE user_id = $1 AND notification_id = ANY($2::text[])`,
    [user.id, visible.map((n) => n.id)],
  );
  const readMap = new Map(readResult.rows.map((r) => [String(r.notification_id), r.read_at ? String(r.read_at) : ""]));

  let unreadCount = 0;
  for (const n of visible) {
    const wasRead = readMap.has(n.id);
    n.read = wasRead;
    if (!wasRead) unreadCount += 1;
  }
  return { unreadCount, notifications: visible };
}

/** Marks notifications as read for the current user (all when no ids given). */
export async function markNotificationsRead(user: SafeUser, ids?: string[]): Promise<{ marked: number }> {
  const db = await getDb();
  const { notifications } = await listNotificationsForUser(user);
  const targetIds = ids && ids.length > 0 ? new Set(ids) : new Set(notifications.map((n) => n.id));
  if (targetIds.size === 0) return { marked: 0 };

  const now = new Date().toISOString();
  let marked = 0;
  for (const id of notifications) {
    if (!targetIds.has(id.id)) continue;
    if (id.read) continue;
    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [id.id, user.id, now],
    );
    marked += 1;
  }
  return { marked };
}

/** All notifications ever sent — super_admin console history. */
export async function listSentNotifications(): Promise<ComposedNotification[]> {
  const usersResult = await (await getDb()).query("SELECT id, name_ar FROM users");
  const nameById = new Map(usersResult.rows.map((r) => [String(r.id), String(r.name_ar + "")]));
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title, body, type, target, user_id, class_id, created_by_user_id, created_at
     FROM notifications ORDER BY created_at DESC, id DESC LIMIT 200`,
  );
  return result.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    body: String(r.body),
    type: String(r.type) as NotificationType,
    target: String(r.target) as NotificationTarget,
    userId: r.user_id ? String(r.user_id) : undefined,
    classId: r.class_id ? String(r.class_id) : undefined,
    recipientName: r.user_id ? nameById.get(String(r.user_id)) : undefined,
    createdByName: nameById.get(String(r.created_by_user_id)) ?? undefined,
    createdAt: String(r.created_at),
  }));
}