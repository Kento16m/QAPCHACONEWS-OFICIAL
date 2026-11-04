import { describe, expect, it } from "vitest";
import { readFunctionError } from "@/lib/function-error";

const failure = (body: string, status = 400) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(body, { status }),
});

describe("readFunctionError", () => {
  it("returns the message the function sent", async () => {
    expect(await readFunctionError(failure('{"error":"Tu comentario no es apto."}'))).toEqual({
      message: "Tu comentario no es apto.",
      status: 400,
    });
  });

  it("keeps the status for rate limits", async () => {
    expect((await readFunctionError(failure('{"error":"Límite"}', 429)))?.status).toBe(429);
  });

  it("returns no message when the body is not JSON", async () => {
    expect(await readFunctionError(failure("<html>Bad gateway</html>", 502))).toEqual({ message: null, status: 502 });
  });

  it("handles network errors with no response", async () => {
    expect(await readFunctionError({ message: "Failed to fetch" })).toEqual({ message: null, status: null });
  });
});
