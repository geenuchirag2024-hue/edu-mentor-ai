import { apiFetch, apiRequest, friendlyApiError } from "@/services/api";

export interface DocumentItem {
  id: number;
  doc_uuid: string;
  filename: string;
  file_size: number;
  page_count: number;
  chunk_count: number;
  status: "uploaded" | "extracting_text" | "generating_embeddings" | "ready" | "failed";
  error_message?: string | null;
  subject: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadResponse {
  document: DocumentItem;
  message: string;
  reused: boolean;
}

export interface DocumentAskResponse {
  answer: string;
  document_id: number;
  filename: string;
  sources: number[];
  sources_text: string;
  retrieval_latency_ms: number;
  generation_latency_ms: number;
  total_latency_ms: number;
}

export interface DocumentMessageItem {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: number[];
  created_at: string;
}

export interface DocumentHistoryResponse {
  document_id: number;
  filename: string;
  messages: DocumentMessageItem[];
}

export async function uploadDocument(
  file: File,
  subject: string = "General"
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("subject", subject);

  const res = await apiRequest("/api/documents/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json();
}

export async function listDocuments(): Promise<DocumentItem[]> {
  return apiFetch<DocumentItem[]>("/api/documents");
}

export async function getDocument(id: number): Promise<DocumentItem> {
  return apiFetch<DocumentItem>(`/api/documents/${id}`);
}

export async function askDocument(
  id: number,
  question: string,
  language: string = "en"
): Promise<DocumentAskResponse> {
  const res = await apiRequest(`/api/documents/${id}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, language }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json();
}

export async function getDocumentHistory(
  id: number
): Promise<DocumentHistoryResponse> {
  return apiFetch<DocumentHistoryResponse>(`/api/documents/${id}/history`);
}

export async function clearDocumentHistory(id: number): Promise<void> {
  const res = await apiRequest(`/api/documents/${id}/history`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await apiRequest(`/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
}

export async function retryDocument(id: number): Promise<void> {
  const res = await apiRequest(`/api/documents/${id}/retry`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
}
