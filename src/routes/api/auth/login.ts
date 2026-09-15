import { createFileRoute } from "@tanstack/react-router";
import { createSessionToken, loginUser } from "@/server/auth";
import { handle, jsonError, jsonOk, withSessionCookie } from "@/server/http";

type CredentialsBody = { email?: unknown; password?: unknown };

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as CredentialsBody;
          if (typeof body.email !== "string" || typeof body.password !== "string") {
            return jsonError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
          }
          const user = await loginUser(body.email, body.password);
          const { token } = await createSessionToken(user.id);
          return withSessionCookie(jsonOk({ user }), token);
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});