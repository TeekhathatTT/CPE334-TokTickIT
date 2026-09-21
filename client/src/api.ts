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
  void requesterId;
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });

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

  if (response.status === 204) return undefined as T;

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
  });
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
  return requestJson<{ data: TicketListRow[]; meta: TicketListMeta }>(`/api/tickets${query ? `?${query}` : ""}`, undefined, undefined, false);
}

export async function getTicket(ticketId: number, requesterId: number): Promise<Ticket> {
  return requestJson<Ticket>(`/api/tickets/${ticketId}`);
}

export async function addAttachment(ticketId: number, requesterId: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return requestJson<{ id: number; originalFilename: string; sizeBytes: number; uploadedAt: string }>(`/api/tickets/${ticketId}/attachments`, { method: "POST", body });
}

export async function downloadAttachment(attachmentId: number, requesterId: number): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return response.blob();
}

export async function removeAttachment(attachmentId: number, requesterId: number, reason: string) {
  return requestJson<{ id: number; removedAt: string; removalReason: string }>(`/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export interface AuthUser { id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean; mustChangePassword: boolean; }
export async function login(email: string, password: string) { return requestJson<{ user: AuthUser }>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); }
export async function getCurrentUser() { return requestJson<{ user: AuthUser }>("/api/auth/me"); }
export async function logout() { await requestJson<never>("/api/auth/logout", { method: "POST" }, undefined, false); }
export async function changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) { return requestJson<{ user: AuthUser }>("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }

export type UserRole = AuthUser["role"];
export interface ManagedUser extends AuthUser { createdAt: string; updatedAt: string; }
export async function getUsers(filters: { search?: string; role?: UserRole } = {}) { const params = new URLSearchParams(); if (filters.search) params.set("search", filters.search); if (filters.role) params.set("role", filters.role); return requestJson<ManagedUser[]>(`/api/admin/users${params.size ? `?${params}` : ""}`); }
export async function createUser(input: { name: string; email: string; role: UserRole; isActive: boolean; initialPassword: string }) { return requestJson<ManagedUser>("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
export async function updateUser(id: number, input: Partial<Pick<ManagedUser, "name" | "email" | "role" | "isActive">>) { return requestJson<ManagedUser>(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
export async function setInitialPassword(id: number, initialPassword: string) { return requestJson<ManagedUser>(`/api/admin/users/${id}/initial-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initialPassword }) }); }

export interface PublicComment { id: number; ticketId: number; author: { id: number; name: string; role: string }; content: string; createdAt: string; }
export async function getPublicComments(ticketId: number) { return requestJson<PublicComment[]>(`/api/tickets/${ticketId}/comments`); }
export async function addPublicComment(ticketId: number, content: string) { return requestJson<PublicComment>(`/api/tickets/${ticketId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }); }
export async function markProblemAppearsResolved(ticketId: number) { return requestJson<{ ticketId: number; problemAppearsResolvedAt: string | null }>(`/api/tickets/${ticketId}/problem-appears-resolved`, { method: "POST" }); }
