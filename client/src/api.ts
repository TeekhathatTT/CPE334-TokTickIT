import type { Category, Requester } from "./types/ticket";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);

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
  if (payload && typeof payload === "object" && "data" in payload) {
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

  return requestJson<{ data: unknown }>("/api/tickets", {
    method: "POST",
    headers: {
      "x-requester-id": String(input.requesterId),
    },
    body: formData,
  });
}
