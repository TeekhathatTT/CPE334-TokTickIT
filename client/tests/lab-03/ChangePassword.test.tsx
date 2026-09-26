import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordPage } from "../../src/pages/auth/ChangePasswordPage";
import { AuthProvider } from "../../src/hooks/useAuth";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

const mustChangeUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: true,
};

const rotatedUser = { ...mustChangeUser, mustChangePassword: false };

function renderChangePassword() {
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: mustChangeUser });
  render(
    <AuthProvider>
      <ChangePasswordPage />
    </AuthProvider>,
  );
}

describe("Lab 3 ChangePassword", () => {
  it("renders the live password-rule checklist", async () => {
    renderChangePassword();

    expect(await screen.findByRole("heading", { name: /change your password/i })).toBeInTheDocument();
    for (const rule of [
      "At least 8 characters",
      "An upper-case letter",
      "A lower-case letter",
      "A number",
      "A special character",
    ]) {
      expect(screen.getByText(new RegExp(rule))).toBeInTheDocument();
    }
  });

  it("marks checklist rules as the password satisfies them", async () => {
    renderChangePassword();
    await screen.findByRole("heading", { name: /change your password/i });

    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "Password123!" } });

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i).textContent).toMatch(/\(met\)/);
    });
    expect(screen.getByText(/an upper-case letter/i).textContent).toMatch(/\(met\)/);
  });

  it("blocks mismatched confirmation inline without calling the API", async () => {
    const changePassword = vi.spyOn(api, "changePassword");
    renderChangePassword();
    await screen.findByRole("heading", { name: /change your password/i });

    fireEvent.change(screen.getByLabelText(/^current password/i), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "Newpass123!" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "Different123!" } });
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("saves successfully and surfaces a wrong current password inline", async () => {
    const changePassword = vi
      .spyOn(api, "changePassword")
      .mockRejectedValueOnce(new api.ApiError(401, "AUTHENTICATION_FAILED", "Current password is incorrect."))
      .mockResolvedValueOnce({ user: rotatedUser });
    // Refresh after rotation returns the cleared flag.
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: rotatedUser });
    render(
      <AuthProvider>
        <ChangePasswordPage />
      </AuthProvider>,
    );
    await screen.findByRole("heading", { name: /change your password/i });

    fireEvent.change(screen.getByLabelText(/^current password/i), { target: { value: "Wrongpass123!" } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "Newpass123!" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "Newpass123!" } });
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^current password/i), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenLastCalledWith({
        currentPassword: "Password123!",
        newPassword: "Newpass123!",
        confirmPassword: "Newpass123!",
      }),
    );
  });
});
