import type { Category, Priority, Requester, Ticket, TicketStatus } from "./types/ticket";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface TicketListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  isEmpty: boolean;
  isNoResults: boolean;
}

export interface TicketListRow {
  id: number;
  ticketNumber: string;
  summary: string;
  category: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

async function requestJson<T>(path: string, init?: RequestInit, requesterId?: number, unwrapData = true): Promise<T> {
  const headers = new Headers(init?.headers);
  if (requesterId !== undefined) headers.set("x-requester-id", String(requesterId));
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Ignore JSON parse failures and fall back to the status-based message.
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as T | { data?: T };
  if (unwrapData && payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResp = await fetch(`${API_URL}/api/health`);
  if (!healthResp.ok) {
    throw new Error(`health check failed: ${healthResp.status}`);
  }

  const categories = await requestJson<Category[]>("/api/categories");
  return { online: true, categories };
}

export async function getRequesters(): Promise<Requester[]> {
  return requestJson<Requester[]>("/api/requesters");
}

export async function getCategories(): Promise<Category[]> {
  return requestJson<Category[]>("/api/categories");
}

export async function getRelatedSystems(): Promise<Array<{ id: number; name: string }>> {
  return requestJson<Array<{ id: number; name: string }>>("/api/related-systems");
}

export async function createTicket(input: {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  requesterId: number;
  attachments?: File[];
}) {
  const formData = new FormData();
  formData.append("categoryId", String(input.categoryId));
  formData.append("relatedSystemId", String(input.relatedSystemId));
  formData.append("summary", input.summary);
  formData.append("description", input.description);
  formData.append("requestedPriority", input.requestedPriority);

  if (input.attachments?.length) {
    input.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }

  return requestJson<Ticket>("/api/tickets", {
    method: "POST",
    body: formData,
  }, input.requesterId);
}

export async function getTickets(
  requesterId: number,
  filters: {
    search?: string;
    category?: string;
    requestedPriority?: string;
    itPriority?: string;
    status?: string;
    sort?: string;
    order?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ data: TicketListRow[]; meta: TicketListMeta }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "All") params.set(key, String(value));
  });
  const query = params.toString();
  return requestJson<{ data: TicketListRow[]; meta: TicketListMeta }>(`/api/tickets${query ? `?${query}` : ""}`, undefined, requesterId, false);
}

export async function getTicket(ticketId: number, requesterId: number): Promise<Ticket> {
  return requestJson<Ticket>(`/api/tickets/${ticketId}`, undefined, requesterId);
}

export async function addAttachment(ticketId: number, requesterId: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return requestJson<{ id: number; originalFilename: string; sizeBytes: number; uploadedAt: string }>(`/api/tickets/${ticketId}/attachments`, { method: "POST", body }, requesterId);
}

export async function downloadAttachment(attachmentId: number, requesterId: number): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    headers: { "x-requester-id": String(requesterId) },
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return response.blob();
}

export async function removeAttachment(attachmentId: number, requesterId: number, reason: string) {
  return requestJson<{ id: number; removedAt: string; removalReason: string }>(`/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  }, requesterId);
}
