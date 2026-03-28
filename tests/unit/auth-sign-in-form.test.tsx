// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "@/components/auth/sign-in-form";

const replace = vi.fn();
const refresh = vi.fn();
const signInEmail = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    refresh,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: (...args: Parameters<typeof signInEmail>) => signInEmail(...args),
    },
  },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInEmail.mockReset();
  });

  it("submits credentials and redirects to a safe callback path", async () => {
    signInEmail.mockResolvedValue({ error: null, data: {} });

    const user = userEvent.setup();
    render(<SignInForm redirectTo="/quality" />);

    await user.type(screen.getByLabelText("Email"), "admin@eventpulse.local");
    await user.type(screen.getByLabelText("Password"), "changeme12345");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "admin@eventpulse.local",
        password: "changeme12345",
        rememberMe: true,
        callbackURL: "/quality",
      });
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/quality");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("falls back to the dashboard for unsafe redirect parameters", async () => {
    signInEmail.mockResolvedValue({ error: null, data: {} });

    const user = userEvent.setup();
    render(<SignInForm redirectTo="https://malicious.example" />);

    await user.type(screen.getByLabelText("Email"), "admin@eventpulse.local");
    await user.type(screen.getByLabelText("Password"), "changeme12345");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "admin@eventpulse.local",
        password: "changeme12345",
        rememberMe: true,
        callbackURL: "/",
      });
    });
  });

  it("shows the auth error when sign-in fails", async () => {
    signInEmail.mockResolvedValue({
      error: { message: "Invalid email or password" },
      data: null,
    });

    const user = userEvent.setup();
    render(<SignInForm redirectTo="/quality" />);

    await user.type(screen.getByLabelText("Email"), "admin@eventpulse.local");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
