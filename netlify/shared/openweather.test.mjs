// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { proxyWeather } from "./openweather.mjs";

const KEY = "secret-key-123";
const ok = (body = { temp: 30 }) => new Response(JSON.stringify(body), { status: 200 });
const call = (query, http = vi.fn().mockResolvedValue(ok()), key = KEY) =>
  proxyWeather(`https://site.test/api/clima?${query}`, key, http).then((response) => ({
    response,
    http,
  }));

describe("proxyWeather", () => {
  it("adds the key on the server and forwards the allowed parameters", async () => {
    const { response, http } = await call("endpoint=/weather&q=Asuncion,PY&units=metric&lang=es");
    const url = new URL(http.mock.calls[0][0]);

    expect(response.status).toBe(200);
    expect(url.origin + url.pathname).toBe("https://api.openweathermap.org/data/2.5/weather");
    expect(url.searchParams.get("appid")).toBe(KEY);
    expect(url.searchParams.get("q")).toBe("Asuncion,PY");
    expect(url.searchParams.get("units")).toBe("metric");
  });

  it("ignores a key or unknown parameter sent by the caller", async () => {
    const { http } = await call("endpoint=/weather&q=x&appid=attacker&foo=bar");
    const url = new URL(http.mock.calls[0][0]);

    expect(url.searchParams.getAll("appid")).toEqual([KEY]);
    expect(url.searchParams.has("foo")).toBe(false);
  });

  it.each(["/onecall", "//evil.test/x", "/../../secret", ""])(
    "refuses the endpoint %j",
    async (endpoint) => {
      const { response, http } = await call(`endpoint=${encodeURIComponent(endpoint)}&q=x`);

      expect(response.status).toBe(400);
      expect(http).not.toHaveBeenCalled();
    },
  );

  it("explains a missing key without calling the service", async () => {
    const { response, http } = await call("endpoint=/weather&q=x", vi.fn(), "");

    expect(response.status).toBe(500);
    expect((await response.json()).message).toContain("clima");
    expect(http).not.toHaveBeenCalled();
  });

  it("passes the service's status and lets browsers reuse good answers", async () => {
    const good = await call("endpoint=/weather&q=x");
    expect(good.response.headers.get("cache-control")).toBe("private, max-age=600");

    const limited = await call(
      "endpoint=/weather&q=x",
      vi.fn().mockResolvedValue(new Response('{"message":"limit"}', { status: 429 })),
    );
    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get("cache-control")).toBe("no-store");
  });

  it("never returns the key, even when the network error mentions the URL", async () => {
    const http = vi
      .fn()
      .mockRejectedValue(new Error(`failed https://api.openweathermap.org/?appid=${KEY}`));
    const { response } = await call("endpoint=/weather&q=x", http);

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(KEY);
  });
});
