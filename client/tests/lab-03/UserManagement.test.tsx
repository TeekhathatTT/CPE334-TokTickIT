import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserManagementPage } from "../../src/pages/admin/UserManagementPage";
import { UserList } from "../../src/components/admin/UserList";
import { UserFormDrawer } from "../../src/components/admin/UserFormDrawer";
import * as api from "../../src/api";

vi.mock("../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    id: 99,
    name: "Alice Admin",
    email: "alice.admin@example.com",
    role: "ADMINISTRATOR",
    isActive: true,
    mustChangePassword: false,
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function user(id: number, overrides: Partial<api.AdminUser> = {}): api.AdminUser {
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    role: "REQUESTER",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    ...overrides,
  };
}

describe("Lab 3 UserManagement list", () => {
  it("renders Name, Email, Role, Status, and Edit actions", async () => {
    vi.spyOn(api, "listAdminUsers").mockResolvedValue([
      user(11, { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER", isActive: true }),
      user(21, { name: "Priya Patel", email: "priya.patel@example.com", role: "IT_STAFF", isActive: false }),
    ]);
    render(<UserManagementPage />);

    expect((await screen.findAllByText("Jennifer Anderson")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("jennifer.anderson@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requester").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IT Staff").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /edit jennifer anderson/i }).length).toBeGreaterThan(0);
  });

  it("passes search input and role filter through to the API", async () => {
    const loader = vi.spyOn(api, "listAdminUsers").mockResolvedValue([]);
    render(<UserManagementPage />);
    await screen.findByText(/no users yet/i);

    fireEvent.change(screen.getByLabelText(/search users/i), { target: { value: "priya" } });
    await waitFor(() => {
      expect(loader).toHaveBeenCalledWith(expect.objectContaining({ search: "priya" }));
    });

    fireEvent.change(screen.getByLabelText(/role filter/i), { target: { value: "IT_STAFF" } });
    await waitFor(() => {
      expect(loader).toHaveBeenCalledWith(expect.objectContaining({ role: "IT_STAFF" }));
    });
  });

  it("shows loading, empty, no-results, forbidden, and failure states", async () => {
    const loader = vi.spyOn(api, "listAdminUsers").mockResolvedValue([user(11)]);
    const { unmount } = render(<UserManagementPage />);
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
    expect((await screen.findAllByText("User 11")).length).toBeGreaterThan(0);
    unmount();

    loader.mockResolvedValue([]);
    render(<UserManagementPage />);
    expect(await screen.findByText(/no users yet/i)).toBeInTheDocument();
  });

  it("renders forbidden and safe-failure errors with retry", async () => {
    const loader = vi
      .spyOn(api, "listAdminUsers")
      .mockRejectedValueOnce(new api.ApiError(403, "FORBIDDEN", "You are not allowed to perform this action."))
      .mockResolvedValue([user(11)]);
    render(<UserManagementPage />);

    expect((await screen.findAllByText(/not allowed/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect((await screen.findAllByText("User 11")).length).toBeGreaterThan(0);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("Lab 3 UserList", () => {
  it("labels the current admin row and keeps Edit available", () => {
    const onEdit = vi.fn();
    const onReset = vi.fn();
    render(
      <UserList
        users={[user(99, { name: "Alice Admin", role: "ADMINISTRATOR" }), user(11)]}
        currentUserId={99}
        onEdit={onEdit}
        onResetPassword={onReset}
      />,
    );

    expect(screen.getAllByText(/alice admin \(you\)/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /edit alice admin/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
  });
});

describe("Lab 3 UserFormDrawer validation", () => {
  it("blocks empty name, bad email, and weak password on create", async () => {
    const create = vi.spyOn(api, "createAdminUser");
    render(<UserFormDrawer mode="create" currentUserId={99} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText(/initial password/i), { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/does not meet all rules/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("disables the deactivate control on the admin's own row", async () => {
    vi.spyOn(api, "listAdminUsers").mockResolvedValue([
      user(99, { name: "Alice Admin", role: "ADMINISTRATOR" }),
    ]);
    render(<UserManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: /edit alice admin/i }));

    const toggle = (await screen.findByLabelText(/active/i)) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByText(/cannot deactivate your own account/i)).toBeInTheDocument();
  });

  it("surfaces duplicate-email conflict from the API", async () => {
    vi.spyOn(api, "listAdminUsers").mockResolvedValue([user(11)]);
    vi.spyOn(api, "createAdminUser").mockRejectedValue(
      new api.ApiError(409, "CONFLICT", "A user with this email already exists.", {
        email: "A user with this email already exists.",
      }),
    );
    render(<UserManagementPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create user/i }))[0]);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Clash" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText(/initial password/i), { target: { value: "Password123!" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^create user$/i }));

    expect((await screen.findAllByText("A user with this email already exists.")).length).toBeGreaterThan(0);
  });

  it("keeps password reset separate from the edit save", async () => {
    vi.spyOn(api, "listAdminUsers").mockResolvedValue([user(11, { name: "Jennifer Anderson" })]);
    const reset = vi.spyOn(api, "setAdminInitialPassword").mockResolvedValue(user(11));
    const update = vi.spyOn(api, "updateAdminUser").mockResolvedValue(user(11));
    render(<UserManagementPage />);

    // Edit flow has no password field — saving never resets the password.
    fireEvent.click(await screen.findByRole("button", { name: /edit jennifer anderson/i }));
    expect(await screen.findByText(/saving here never resets the password/i)).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).queryByLabelText(/initial password/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Reset flow is a distinct action with its own password fields.
    fireEvent.click(screen.getByRole("button", { name: /set new password for jennifer anderson/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/new initial password/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/new initial password/i), {
      target: { value: "Newpass123!" },
    });
    fireEvent.change(within(dialog).getByLabelText(/confirm new password/i), {
      target: { value: "Newpass123!" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /set new password/i }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith(11, "Newpass123!"));
    expect(update).not.toHaveBeenCalled();
  });
});
