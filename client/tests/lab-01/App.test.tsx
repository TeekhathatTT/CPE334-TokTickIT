import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

const requester = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: false,
};

function unauthenticated() {
  vi.spyOn(api, "getCurrentUser").mockRejectedValue(
    new api.ApiError(401, "UNAUTHENTICATED", "Authentication is required."),
  );
}

describe("App authentication boot (Lab 3 successor to requester selection)", () => {
  it("renders the login screen when there is no session", async () => {
    unauthenticated();

    render(<App />);

    // The Development Requester selector is gone; login is the entry point.
    expect(await screen.findByRole("heading", { name: /log in to toktickit/i })).toBeInTheDocument();
    expect(screen.queryByText(/select development requester/i)).not.toBeInTheDocument();
  });

  it("renders the authenticated shell with the user's name and role", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: requester });
    vi.spyOn(api, "getTickets").mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, isEmpty: true, isNoResults: false },
    });
    vi.spyOn(api, "getCategories").mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /my tickets/i })).toBeInTheDocument();
    expect(screen.queryByText(/change requester/i)).not.toBeInTheDocument();
  });
});
