"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type OnboardingGateProps = {
  hasCompletedOnboarding: boolean;
  children: ReactNode;
};

// The setup wizard now lives inside the Settings hub (Settings -> Setup tab) rather than a
// standalone /onboarding route, so both the redirect target and the exemption are just
// "/settings" - a user can detour into any Settings tab (e.g. to connect a health provider via
// Integrations) mid-onboarding without the gate bouncing them back to step one.
const ONBOARDING_PATH = "/settings/setup";
const EXEMPT_PATH_PREFIXES = ["/settings"];

export function OnboardingGate({ hasCompletedOnboarding, children }: OnboardingGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const onExemptRoute = EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const shouldRedirect = !hasCompletedOnboarding && !onExemptRoute;

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(ONBOARDING_PATH);
    }
  }, [shouldRedirect, router]);

  // Render nothing while redirecting rather than flashing dashboard content that's about to be
  // replaced - the redirect happens client-side (preferences aren't known until the shell layout
  // fetches them), so there's a brief window where children would otherwise be visible.
  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}
