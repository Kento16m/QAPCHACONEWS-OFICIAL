// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getNowPlaying } from "./now-playing.mjs";

const stats = (fields) =>
  new Response(JSON.stringify({ streamstatus: 1, currentlisteners: 7, songtitle: "", ...fields }));
const call = async (response) => {
  const http = vi.fn().mockResolvedValue(response);
  const result = await getNowPlaying(http);
  return { result, body: await result.json(), http };
};

describe("getNowPlaying", () => {
  it("splits artist and title on the first separator", async () => {
    const { result, body } = await call(stats({ songtitle: "Los Ojeda - Polca - En vivo" }));
    expect(body).toEqual({
      title: "Polca - En vivo",
      artist: "Los Ojeda",
      listeners: 7,
      online: true,
    });
    expect(result.headers.get("cache-control")).toBe("public, max-age=10");
  });

  it("keeps a song without separator as the title", async () => {
    const { body } = await call(stats({ songtitle: "Noticiero del mediodía" }));
    expect(body).toMatchObject({ title: "Noticiero del mediodía", artist: "" });
  });

  it("treats an empty separator as no song", async () => {
    const { body } = await call(stats({ songtitle: " - " }));
    expect(body).toMatchObject({ title: "", artist: "" });
  });

  it("reports the stream as off the air", async () => {
    const { body } = await call(stats({ streamstatus: 0 }));
    expect(body).toMatchObject({ online: false, title: "", artist: "" });
  });

  it("caps text coming from the radio server", async () => {
    const { body } = await call(stats({ songtitle: "x".repeat(900) }));
    expect(body.title).toHaveLength(200);
  });

  it("answers 502 without caching when the radio server fails", async () => {
    const { result, body } = await call(new Response("down", { status: 500 }));
    expect(result.status).toBe(502);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ message: "No se pudo consultar la radio." });
  });

  it("answers 502 when the radio server is unreachable", async () => {
    const result = await getNowPlaying(vi.fn().mockRejectedValue(new Error("timeout")));
    expect(result.status).toBe(502);
  });
});
