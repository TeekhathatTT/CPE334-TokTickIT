import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordPage } from "../../src/pages/ChangePasswordPage";
import { changePassword } from "../../src/api";

vi.mock("../../src/api", () => ({ changePassword: vi.fn() }));

const mockUser = { id: 1, name: "Alice", email: "alice@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ChangePasswordPage", () => {
  it("renders current, new, and confirm password fields with a save button", () => {
    render(<ChangePasswordPage onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/current or temporary password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save password/i })).toBeInTheDocument();
  });

  it("shows a validation error when new password does not meet the rules", async () => {
    render(<ChangePasswordPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current or temporary password/i), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "weak" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("shows a validation error when new and confirm passwords do not match", async () => {
    render(<ChangePasswordPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current or temporary password/i), { target: { value: "OldPass1!" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPass1!" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "DifferentPass1!" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("calls changePassword() and invokes onSuccess on a valid submission", async () => {
    vi.mocked(changePassword).mockResolvedValue({ user: mockUser });
    const onSuccess = vi.fn();
    render(<ChangePasswordPage onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText(/current or temporary password/i), { target: { value: "OldPass1!" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPass2@" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPass2@" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockUser));
  });

  it("shows the server error message when changePassword() rejects", async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error("Current password is incorrect."));
    render(<ChangePasswordPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current or temporary password/i), { target: { value: "WrongOld1!" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPass2@" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPass2@" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/current password is incorrect/i);
  });

  it("disables the save button while the request is in flight", async () => {
    let resolve!: (v: { user: typeof mockUser }) => void;
    vi.mocked(changePassword).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ChangePasswordPage onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current or temporary password/i), { target: { value: "OldPass1!" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPass2@" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPass2@" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    resolve({ user: mockUser });
  });
});
