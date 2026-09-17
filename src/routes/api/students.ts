import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listStudents, registerStudent, type CreateStudentInput } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

type Body = {
  [key: string]: unknown;
};

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export const Route = createFileRoute("/api/students")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const includeInactive = url.searchParams.get("includeInactive") === "1";
          const items = await listStudents(user, { branchId, includeInactive });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const input: CreateStudentInput = {
            id: str(body.id),
            nameAr: str(body.nameAr) ?? "",
            nameFr: str(body.nameFr),
            gender: str(body.gender) ?? "male",
            klass: str(body.klass),
            dob: str(body.dob),
            placeOfBirth: str(body.placeOfBirth),
            parentAr: str(body.parentAr),
            phone: str(body.phone),
            enrolled: str(body.enrolled),
            annualFee: num(body.annualFee),
            photo: str(body.photo),
            email: str(body.email),
            branchId: str(body.branchId) ?? "",
            loginEmail: str(body.loginEmail),
            loginPassword: str(body.loginPassword),
          };
          const student = await registerStudent(input, user);
          return jsonOk({ student });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});