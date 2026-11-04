import { apiFetch, apiRequest, friendlyApiError, getStoredToken } from "@/services/api";

export interface TeacherResourceItem {
  id: number;
  teacher_id: number;
  teacher_name: string;
  title: string;
  description?: string | null;
  subject: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  is_published: boolean;
  created_at: string;
}

export interface ResourceUploadResponse {
  resource: TeacherResourceItem;
  message: string;
  notifications_sent: number;
}

export async function uploadTeacherResource(
  file: File,
  title: string,
  description: string = "",
  subject: string = "General",
  is_published: boolean = true
): Promise<ResourceUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("description", description);
  form.append("subject", subject);
  form.append("is_published", String(is_published));

  const res = await apiRequest("/api/resources/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json();
}

export async function listResources(
  subject?: string,
  search?: string
): Promise<TeacherResourceItem[]> {
  const params = new URLSearchParams();
  if (subject && subject !== "All") params.append("subject", subject);
  if (search) params.append("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<TeacherResourceItem[]>(`/api/resources${query}`);
}

export async function downloadResource(
  id: number,
  fallbackFilename: string
): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`/api/resources/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function updateResource(
  id: number,
  data: {
    title?: string;
    description?: string;
    subject?: string;
    is_published?: boolean;
  }
): Promise<TeacherResourceItem> {
  const res = await apiRequest(`/api/resources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json();
}

export async function deleteResource(id: number): Promise<void> {
  const res = await apiRequest(`/api/resources/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
}

