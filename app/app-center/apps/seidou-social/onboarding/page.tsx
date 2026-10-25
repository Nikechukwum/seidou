import { redirect } from "next/navigation";

import { trpc } from "@/social/trpc/server";
import { getCountryOptions } from "@/social/modules/social-profiles/countries";
import { OnboardingView } from "@/social/modules/social-profiles/ui/views/onboarding-view";

export const dynamic = "force-dynamic";

/**
 * Seidou Social onboarding: basic information -> interests -> personalizing.
 * The feed redirects here until it is finished (see ../page.tsx).
 */
const OnboardingPage = async () => {
  // Loaded up front so the form opens prefilled when someone comes back.
  // Throws UNAUTHORIZED when signed out — there is nothing to save then.
  const initial = await trpc.socialProfiles.getMine().catch(() => null);
  if (!initial) redirect("/signin");

  // Built here rather than in the client: Node and browsers ship different
  // Intl data, and names that differ ("Turkey"/"Türkiye") would fail hydration.
  const countries = getCountryOptions();

  return <OnboardingView initial={initial} countries={countries} />;
};

export default OnboardingPage;
