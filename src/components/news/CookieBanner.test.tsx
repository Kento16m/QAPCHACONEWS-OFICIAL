import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-ga4", () => ({ default: { initialize: vi.fn(), send: vi.fn(), event: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

import { CookieBanner } from "@/components/news/CookieBanner";
import { getCookieConsent, reopenCookieConsent, setCookieConsent } from "@/lib/analytics";

beforeEach(() => {
  window.localStorage.clear();
});

describe("CookieBanner", () => {
  it("asks when there is no decision and links to the policy", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("region", { name: "Preferencias de cookies" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Política de Cookies" })).toHaveAttribute("href", "/cookies");
  });

  it("stores acceptance and closes", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(getCookieConsent()).toBe("accepted");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stores rejection and closes", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(getCookieConsent()).toBe("rejected");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays closed after a decision", () => {
    setCookieConsent("rejected");
    render(<CookieBanner />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("opens again from the footer link", () => {
    setCookieConsent("accepted");
    render(<CookieBanner />);

    act(() => reopenCookieConsent());

    expect(screen.getByRole("region", { name: "Preferencias de cookies" })).toBeInTheDocument();
  });
});
