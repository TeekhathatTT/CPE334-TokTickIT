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

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface PublicComment {
  id: number;
  ticketId: number;
  author: { id: number; name: string; role: string };
  content: string;
  createdAt: string;
}

export interface ProblemResolvedSignal {
  ticketId: number;
  problemAppearsResolvedAt: string;
}

/**
 * Carries the server's safe error envelope (status + code) so UI can branch
 * on cases like PASSWORD_CHANGE_REQUIRED without parsing messages.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

async function requestJson<T>(path: string, init?: RequestInit, unwrapData = true): Promise<T> {
  // BR-03: the session cookie identifies the caller — requester identity is
  // never sent as a header or query parameter anymore.
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    let code = "REQUEST_FAILED";
    let fields: Record<string, string> | undefined;

    try {
      const payload = (await response.json()) as ErrorEnvelope;
      if (payload?.error?.message) message = payload.error.message;
      if (payload?.error?.code) code = payload.error.code;
      if (payload?.error?.fields) fields = payload.error.fields;
    } catch {
      // Ignore JSON parse failures and fall back to the status message.
    }

    throw new ApiError(response.status, code, message, fields);
  }

  const payload = (await response.json()) as T | { data?: T };
  if (unwrapData && payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Authentication (api-spec.md §1).
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<{ user: CurrentUser }> {
  return requestJson<{ user: CurrentUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await requestJson<void>("/api/auth/logout", { method: "POST" });
}

export async function getCurrentUser(): Promise<{ user: CurrentUser }> {
  return requestJson<{ user: CurrentUser }>("/api/auth/me");
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ user: CurrentUser }> {
  return requestJson<{ user: CurrentUser }>("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// Authenticated Lab 2 continuation (api-spec.md §2). Ownership derives from
// the session; there is no requesterId parameter anywhere.
// ---------------------------------------------------------------------------

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
  return requestJson<{ data: TicketListRow[]; meta: TicketListMeta }>(`/api/tickets${query ? `?${query}` : ""}`, undefined, false);
}

export async function getTicket(ticketId: number): Promise<Ticket> {
  return requestJson<Ticket>(`/api/tickets/${ticketId}`);
}

export async function addAttachment(ticketId: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return requestJson<{ id: number; originalFilename: string; sizeBytes: number; uploadedAt: string }>(`/api/tickets/${ticketId}/attachments`, { method: "POST", body });
}

export async function downloadAttachment(attachmentId: number): Promise<Blob> {
  // Session cookie travels via credentials:include (no identity header).
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    credentials: "include",
  });
  if (!response.ok) throw new ApiError(response.status, "REQUEST_FAILED", `Download failed: ${response.status}`);
  return response.blob();
}

export async function removeAttachment(attachmentId: number, reason: string) {
  return requestJson<{ id: number; removedAt: string; removalReason: string }>(`/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

// ---------------------------------------------------------------------------
// Requester collaboration (api-spec.md §4).
// ---------------------------------------------------------------------------

export async function getComments(ticketId: number): Promise<PublicComment[]> {
  return requestJson<PublicComment[]>(`/api/tickets/${ticketId}/comments`);
}

export async function postComment(ticketId: number, content: string): Promise<PublicComment> {
  return requestJson<PublicComment>(`/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function markProblemAppearsResolved(ticketId: number): Promise<ProblemResolvedSignal> {
  return requestJson<ProblemResolvedSignal>(`/api/tickets/${ticketId}/problem-appears-resolved`, {
    method: "POST",
  });
}
