import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../src/pages/auth/LoginPage";
import { AuthProvider } from "../../src/hooks/useAuth";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderLogin() {
  vi.spyOn(api, "getCurrentUser").mockRejectedValue(
    new api.ApiError(401, "UNAUTHENTICATED", "Authentication is required."),
  );
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

const requester = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: false,
};

describe("Lab 3 Login", () => {
  it("renders the email/password form with a busy-aware submit", async () => {
    renderLogin();

    expect(await screen.findByRole("heading", { name: /log in to toktickit/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled();
  });

  it("validates empty fields inline without calling the API", async () => {
    const login = vi.spyOn(api, "login");
    renderLogin();
    await screen.findByRole("heading", { name: /log in to toktickit/i });

    fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in successfully and disables the submit while busy", async () => {
    let resolveLogin!: (value: { user: typeof requester }) => void;
    const login = vi
      .spyOn(api, "login")
      .mockImplementation(() => new Promise((resolve) => { resolveLogin = resolve; }));
    renderLogin();
    await screen.findByRole("heading", { name: /log in to toktickit/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jennifer.anderson@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled());
    resolveLogin({ user: requester });
    await waitFor(() => expect(login).toHaveBeenCalledWith("jennifer.anderson@example.com", "Password123!"));
  });

  it("shows the same safe message for wrong credentials and inactive accounts", async () => {
    const login = vi
      .spyOn(api, "login")
      .mockRejectedValueOnce(new api.ApiError(401, "AUTHENTICATION_FAILED", "Invalid email or password."));
    renderLogin();
    await screen.findByRole("heading", { name: /log in to toktickit/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "david.brown@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(login).toHaveBeenCalledOnce();
    // The message never hints whether the email exists or is deactivated.
    expect(screen.queryByText(/not found|inactive|deactivat/i)).not.toBeInTheDocument();
  });
});
