import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateTicketPage from "../../src/pages/CreateTicketPage";
import * as api from "../../src/api";

describe("Create Ticket", () => {
  it("renders the ticket form", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);

    render(<CreateTicketPage requesterId={1} />);

    expect(await screen.findByRole("heading", { name: /create ticket/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/summary/i)).toBeInTheDocument();
  });

  it("shows validation messages on submit", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);

    render(<CreateTicketPage requesterId={1} />);

    fireEvent.click(await screen.findByRole("button", { name: /create ticket/i }));

    expect(await screen.findByText(/summary must be between 5 and 120 characters/i)).toBeInTheDocument();
  });
});
