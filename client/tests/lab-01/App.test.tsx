import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories, getCurrentUser, getTickets } from "../../src/api";
import App from "../../src/App";

vi.mock("../../src/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getTickets: vi.fn(),
  getCategories: vi.fn(),
}));

const mockRequester = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTickets).mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, isEmpty: true, isNoResults: false } });
  vi.mocked(getCategories).mockResolvedValue([]);
});
afterEach(cleanup);

describe("App entry", () => {
  it("renders the sign-in screen when there is no active session", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("no session"));

    render(<App />);

    expect(await screen.findByRole("heading", { name: /sign in to toktickit/i })).toBeInTheDocument();
  });

  it("renders the requester's ticket list after a session loads", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ user: mockRequester });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });
});