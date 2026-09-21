import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserManagementPage from "../src/pages/UserManagementPage";
import { createUser, getUsers, setInitialPassword, updateUser } from "../src/api";

vi.mock("../src/api", () => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), setInitialPassword: vi.fn() }));

const user = { id: 2, name: "Taylor Smith", email: "taylor@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getUsers).mockResolvedValue([user]); });
afterEach(cleanup);

describe("UserManagementPage", () => {
  it("renders list, server search, and role filter", async () => {
    vi.mocked(getUsers).mockResolvedValue([user]); render(<UserManagementPage currentUserId={1} />);
    expect((await screen.findAllByText("Taylor Smith")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "taylor" } });
    await waitFor(() => expect(getUsers).toHaveBeenLastCalledWith({ search: "taylor", role: undefined }));
    fireEvent.change(screen.getByLabelText("Role", { selector: "#user-role" }), { target: { value: "IT_STAFF" } });
    await waitFor(() => expect(getUsers).toHaveBeenLastCalledWith({ search: "taylor", role: "IT_STAFF" }));
  });
  it("shows empty, no-results, and API failure feedback", async () => {
    vi.mocked(getUsers).mockResolvedValue([]); const { unmount } = render(<UserManagementPage currentUserId={1} />); expect(await screen.findByText(/no users in the system/i)).toBeInTheDocument(); unmount();
    vi.mocked(getUsers).mockRejectedValue(new Error("Forbidden")); render(<UserManagementPage currentUserId={1} />); expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });
  it("creates, edits, resets passwords, and disables self-deactivation", async () => {
    vi.mocked(createUser).mockResolvedValue(user); vi.mocked(updateUser).mockResolvedValue(user); vi.mocked(setInitialPassword).mockResolvedValue(user);
    render(<UserManagementPage currentUserId={2} />); await screen.findAllByText("Taylor Smith");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New User" } }); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } }); fireEvent.change(document.getElementById("managed-initial-password")!, { target: { value: "ValidPass1!" } }); fireEvent.click(screen.getByRole("button", { name: "Save user" })); await waitFor(() => expect(createUser).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]); fireEvent.click(screen.getByRole("button", { name: "Save user" })); await waitFor(() => expect(updateUser).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "Set initial password" })[0]); fireEvent.change(screen.getByLabelText("New initial password"), { target: { value: "ResetPass1!" } }); fireEvent.click(screen.getByRole("button", { name: "Set password" })); await waitFor(() => expect(setInitialPassword).toHaveBeenCalled());
    expect(screen.getAllByRole("button", { name: "Deactivate" })[0]).toBeDisabled();
  });
});
