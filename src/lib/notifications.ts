import { api } from "./api";

export type NotificationType = "general" | "fees" | "exam" | "news";

export type NotificationTarget =
  | "one_staff"
  | "all_staff"
  | "one_teacher"
  | "all_teachers"
  | "one_student"
  | "all_students"
  | "one_class";

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

export function fetchNotifications(): Promise<{ unreadCount: number; notifications: NotificationRow[] }> {
  return api
    .get<{ unreadCount: number; notifications: NotificationRow[] }>("/api/notifications")
    .then((res) =>
      res.ok
        ? { unreadCount: res.data?.unreadCount ?? 0, notifications: res.data?.notifications ?? [] }
        : { unreadCount: 0, notifications: [] },
    );
}

export async function markRead(ids?: string[]): Promise<void> {
  await api.post<void>("/api/notifications/read", { ids });
}

export function fetchComposedNotifications(): Promise<{ items: ComposedNotification[]; error?: string }> {
  return api
    .get<{ items: ComposedNotification[] }>("/api/notifications/sent")
    .then((res) => (res.ok ? { items: res.data?.items ?? [] } : { items: [], error: res.error }));
}

export function composeNotification(payload: {
  title: string;
  body?: string;
  type: NotificationType;
  target: NotificationTarget;
  userId?: string;
  classId?: string;
}): Promise<{ notification?: ComposedNotification; error?: string }> {
  return api
    .post<{ notification: ComposedNotification }>("/api/notifications", payload)
    .then((res) => (res.ok ? { notification: res.data?.notification } : { error: res.error }));
}