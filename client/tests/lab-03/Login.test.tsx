import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../src/pages/LoginPage";
import { login } from "../../src/api";

vi.mock("../../src/api", () => ({ login: vi.fn() }));

const mockUser = { id: 1, name: "Alice Admin", email: "alice@example.com", role: "ADMINISTRATOR" as const, isActive: true, mustChangePassword: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("LoginPage", () => {
  it("renders the email and password fields with a sign-in button", () => {
    render(<LoginPage onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows a validation message when email or password is blank", async () => {
    render(<LoginPage onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/email and password are required/i);
    expect(login).not.toHaveBeenCalled();
  });

  it("calls login() and invokes onSuccess on valid credentials", async () => {
    vi.mocked(login).mockResolvedValue({ user: mockUser });
    const onSuccess = vi.fn();
    render(<LoginPage onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TokTickit1!" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockUser));
  });

  it("shows a generic error message on invalid credentials (no hint about which field)", async () => {
    vi.mocked(login).mockRejectedValue(new Error("AUTHENTICATION_FAILED"));
    render(<LoginPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "BadPass1!" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // The exact text must be generic — must NOT reveal which field was wrong
    const alertText = screen.getByRole("alert").textContent ?? "";
    expect(alertText).not.toMatch(/email.*not found|email.*does not exist|email.*is incorrect|unknown email|wrong email|invalid email address/i);
  });

  it("disables the submit button while the login request is in flight (busy state)", async () => {
    let resolve!: (v: { user: typeof mockUser }) => void;
    vi.mocked(login).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<LoginPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "TokTickit1!" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    // Clean up the pending promise
    resolve({ user: mockUser });
  });
});
