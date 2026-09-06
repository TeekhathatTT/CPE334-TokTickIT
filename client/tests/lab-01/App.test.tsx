import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Requester selection", () => {
  it("renders the requester selection screen and loads active requesters", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    ]);

    render(<App />);

    expect(screen.getByRole("heading", { name: /select development requester/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Jennifer Anderson" })).toBeInTheDocument();
  });

  it("enables continue only after a requester is selected", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    ]);

    render(<App />);

    const select = await screen.findByRole("combobox");
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.change(select, {
      target: { value: "1" },
    });

    await waitFor(() => expect(continueButton).toBeEnabled());
  });
});

