import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { MarketingLayout } from "@/components/marketing/layout";
import { isPortalMode } from "@/lib/mode";

export const Route = createFileRoute("/_marketing")({
  component: MarketingRouteComponent,
});

function MarketingRouteComponent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const portal = isPortalMode();

  useEffect(() => {
    if (portal && pathname !== "/") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [portal, pathname, navigate]);

  if (portal) {
    if (pathname !== "/") return null;
    // Portal build: no marketing chrome — `/` renders the welcome splash.
    return <Outlet />;
  }

  return <MarketingLayout />;
}
