// The radio server sends no CORS headers, so browsers can only read it through this function.
const STATS_URL = "https://cdn.streaming.com.py:7136/stats?sid=1&json=1";
const MAX_TEXT = 200;

const json = (body, status, cacheControl) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });

const parseSong = (song) => {
  const text = String(song ?? "").trim();
  const separator = text.indexOf(" - ");
  const artist = separator === -1 ? "" : text.slice(0, separator).trim();
  const title = separator === -1 ? text : text.slice(separator + 3).trim();
  // A song reduced to its separator trims to "-".
  return text === "-"
    ? { title: "", artist: "" }
    : { title: title.slice(0, MAX_TEXT), artist: artist.slice(0, MAX_TEXT) };
};

export const getNowPlaying = async (http = fetch) => {
  try {
    const response = await http(STATS_URL, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const stats = await response.json();
    const online = stats.streamstatus === 1;
    return json(
      {
        ...(online ? parseSong(stats.songtitle) : { title: "", artist: "" }),
        listeners: Number(stats.currentlisteners) || 0,
        online,
      },
      200,
      "public, max-age=10",
    );
  } catch {
    return json({ message: "No se pudo consultar la radio." }, 502, "no-store");
  }
};
