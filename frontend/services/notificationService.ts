import { apiFetch, apiRequest, friendlyApiError } from "@/services/api";

export interface StudentNotificationItem {
  id: number;
  user_id: number;
  resource_id?: number | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: StudentNotificationItem[];
  unread_count: number;
}

export async function listNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>("/api/notifications");
}

export async function markNotificationRead(id: number): Promise<StudentNotificationItem> {
  const res = await apiRequest(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiRequest("/api/notifications/read-all", {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
}

