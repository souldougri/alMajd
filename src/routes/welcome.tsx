import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PortalLanding } from "@/components/portal/landing";
import { isPortalMode } from "@/lib/mode";

/**
 * Alias for the portal welcome splash.
 * In portal mode it renders the full-page welcome; on the marketing site it
 * redirects to `/` so the route stays out of the public URLs.
 */
export const Route = createFileRoute("/welcome")({
  component: WelcomeRoute,
  head: () => ({
    meta: [{ title: "مجمع المجد التعليمي العربي — بوابة الدخول" }],
  }),
});

function WelcomeRoute() {
  const navigate = useNavigate();
  const portal = isPortalMode();

  useEffect(() => {
    if (!portal) void navigate({ to: "/", replace: true });
  }, [portal, navigate]);

  if (!portal) return null;
  return <PortalLanding />;
}
