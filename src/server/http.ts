/**
 * Shared HTTP helpers for server routes (response + cookie helpers).
 * Server-only module — never import from client code.
 */
export const SESSION_COOKIE = "almajd_session";

export function sessionDurationSeconds(): number {
  const days = Number(process.env.ALMAJD_SESSION_DAYS ?? "30");
  return Number.isFinite(days) && days > 0 ? Math.round(days * 86400) : 30 * 86400;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function jsonOk(data: Record<string, unknown>) {
  return Response.json({ ok: true, ...data });
}

export function jsonError(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationSeconds()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function withSessionCookie(response: Response, token: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Set-Cookie", sessionCookie(token));
  return new Response(response.body, { status: response.status, headers });
}

export function withClearedSessionCookie(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Set-Cookie", clearSessionCookie());
  return new Response(response.body, { status: response.status, headers });
}

export function handle(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }
  console.error("[api] unhandled error:", error);
  if (process.env.NODE_ENV !== "production") {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    return jsonError(`حدث خطأ غير متوقع على الخادم: ${detail}`, 500);
  }
  return jsonError("حدث خطأ غير متوقع على الخادم", 500);
}