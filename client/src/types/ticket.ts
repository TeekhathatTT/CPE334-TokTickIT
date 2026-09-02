export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "PENDING";

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Attachment {
  id: number;
  originalFilename: string;
  sizeBytes: number;
  uploadedAt?: string;
  removedAt?: string | null;
  removalReason?: string | null;
  uploadFailed?: boolean;
  reason?: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
  attachments?: Attachment[];
}

export interface ApiListResponse<T> {
  data: T[];
}

export interface ApiSingleResponse<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
