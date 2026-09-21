import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getStudent, removeStudent, updateStudent } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

type Body = {
  [key: string]: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/students/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const student = await getStudent(params.id, user);
          return jsonOk({ student });
        } catch (err) {
          return handle(err);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const student = await updateStudent(
            params.id,
            {
              nameAr: str(body.nameAr),
              nameFr: str(body.nameFr),
              gender: str(body.gender),
              klass: str(body.klass),
              classId: str(body.classId),
              dob: str(body.dob),
              placeOfBirth: str(body.placeOfBirth),
              parentAr: str(body.parentAr),
              phone: str(body.phone),
              enrolled: str(body.enrolled),
              annualFee: num(body.annualFee),
              photo: str(body.photo),
              email: str(body.email),
            },
            user,
          );
          return jsonOk({ student });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeStudent(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});