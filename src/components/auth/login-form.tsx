import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, LogIn, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { ROLE_REDIRECTS, type Role } from "@/lib/auth/types";
import { SCHOOL } from "@/lib/school";

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";
const labelCls = "mb-1.5 block text-sm font-semibold text-navy";

export function LoginForm({ initialRedirect }: { initialRedirect?: string }) {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resolveRedirect(role: Role) {
    const fallback = ROLE_REDIRECTS[role];
    if (!initialRedirect || !initialRedirect.startsWith("/app")) return fallback;
    const allowed: Record<Role, string[]> = {
      super_admin: [
        "/app/admin",
        "/app/staff",
        "/app/registrar",
        "/app/accountant",
        "/app/academic",
        "/app/supervisor",
        "/app/teacher",
        "/app/student",
      ],
      staff: ["/app/staff", "/app/branch", "/app/registrar", "/app/accountant", "/app/academic", "/app/supervisor"],
      teacher: ["/app/teacher"],
      student: ["/app/student"],
    };
    if (allowed[role].includes(initialRedirect)) return initialRedirect;
    return fallback;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "فشل تسجيل الدخول");
      return;
    }
    const role = useAuth.getState().getRole();
    if (!role) {
      window.location.assign("/");
      return;
    }
    const redirectTo = resolveRedirect(role);
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div>
        <label className={labelCls}>البريد الإلكتروني</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy/40" />
          <input
            className={inputCls}
            dir="ltr"
            type="email"
            autoComplete="username"
            placeholder="admin@madjd.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>كلمة المرور</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy/40" />
          <input
            className={inputCls}
            dir="ltr"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-1 text-navy/50 hover:text-navy"
            aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 font-bold text-navy transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <LogIn className="size-4" />
        {submitting ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </button>

      <p className="pt-2 text-center text-xs leading-relaxed text-navy/55">
        {SCHOOL.nameAr} — نظام الإدارة المتكامل
      </p>
    </form>
  );
}