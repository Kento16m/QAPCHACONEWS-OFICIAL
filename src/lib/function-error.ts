// supabase-js only reports "non-2xx status code"; the function's own message is in the response.
export const readFunctionError = async (error: unknown) => {
  const response = (error as { context?: unknown } | null)?.context;
  if (!(response instanceof Response)) return { message: null, status: null };

  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const message = typeof body?.error === "string" ? body.error : null;
  return { message, status: response.status };
};
