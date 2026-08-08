import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "../../src/App";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [{ id: 1, name: "Hardware" }],
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/system status:/i)).toBeInTheDocument();
    expect(screen.getByText(/online/i)).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("offline"));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to reach the backend api/i)).toBeInTheDocument();
  });
});

describe("checkSystem", () => {
  it("checks only the health endpoint for Issue 2", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", service: "TokTickIT API" }),
    });

    global.fetch = fetchMock;

    const { checkSystem } = await import("../../src/api");
    await expect(checkSystem()).resolves.toEqual({ online: true, categories: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/health");
  });
});
