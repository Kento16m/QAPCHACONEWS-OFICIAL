import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast }));

import { SocialButtons } from "@/components/auth/SocialButtons";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SocialButtons", () => {
  it("offers Google and not Facebook", () => {
    render(<SocialButtons />);
    expect(screen.getByRole("button", { name: /Google/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Facebook/ })).not.toBeInTheDocument();
  });

  it("starts the Google sign-in", async () => {
    auth.signInWithGoogle.mockResolvedValue({});
    render(<SocialButtons />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it("explains a failed sign-in and lets the person retry", async () => {
    auth.signInWithGoogle.mockRejectedValue(new Error("down"));
    render(<SocialButtons />);

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Google/ })).toBeEnabled();
  });
});
