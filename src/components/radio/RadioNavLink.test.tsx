import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { RadioNavLink } from "./RadioNavLink";

const renderWith = (online: boolean) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ title: "", artist: "", listeners: 0, online })),
  );
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <RadioNavLink />
    </QueryClientProvider>,
  );
};

afterEach(() => vi.unstubAllGlobals());

describe("RadioNavLink", () => {
  it("on air: plays from the header and links to the radio page", async () => {
    renderWith(true);
    expect(await screen.findByText("En vivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir radio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Radio QAP/ })).toHaveAttribute("href", "/radio");
  });

  it("off air: shows the schedule and offers no play button that could only fail", async () => {
    renderWith(false);
    expect(await screen.findByText("de 17:00 a 19:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reproducir radio" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Radio QAP/ })).toHaveAttribute("href", "/radio");
  });
});
