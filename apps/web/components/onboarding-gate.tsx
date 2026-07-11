"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type OnboardingGateProps = {
  hasCompletedOnboarding: boolean;
  children: ReactNode;
};

const ONBOARDING_PATH = "/onboarding";
// Settings is reachable mid-onboarding on purpose: the "connect a health provider" step links
// here (Strava/Health Connect/Samsung Health OAuth are real flows, not worth re-embedding inside
// the wizard), and a user should be able to detour into Settings and come back without the gate
// bouncing them straight back to step one.
const EXEMPT_PATH_PREFIXES = [ONBOARDING_PATH, "/settings"];

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
