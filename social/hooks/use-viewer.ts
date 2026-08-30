"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

import { createClient } from "@/lib/supabase/client";
import type { RootState } from "@/redux/store";

/**
 * The single place Seidou Social reads "who is looking at this".
 *
 * The upstream project called Clerk's useAuth/useUser/useClerk directly in 9
 * components. Routing all of them through this hook meant the Clerk-to-Supabase
 * swap touched one file instead of nine.
 *
 * `viewerId` is auth.users.id, which is also public.users.id — so it compares
 * directly against `video.userId`, `comment.userId` and friends for ownership
 * checks. There is no separate identity column.
 */
export const useViewer = () => {
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Display name and avatar come from the Redux profile that useAuth already
  // populates for the commerce app, so social does not fetch them again.
  const profile = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // getSession reads the locally stored session — no network round-trip.
    // Trusting it here is fine: it only decides what the UI offers. Every
    // mutation is re-checked server-side in protectedProcedure.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setViewerId(data.session?.user?.id ?? null);
      setIsLoaded(true);
    });

    // Keeps the UI honest when the user signs in or out in another tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setViewerId(session?.user?.id ?? null);
      setIsLoaded(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Replaces Clerk's `openSignIn()` modal. Seidou has no auth modal — it
   * redirects to /signin and returns you afterwards via sessionStorage.
   *
   * Must be written as a PLAIN STRING: hooks/useAuth.tsx and app/signin read
   * `userNav` as a string, while components/Header.tsx parses it as a JSON
   * array. Writing an array here would break the sign-in return path.
   */
  const requireSignIn = useCallback(() => {
    sessionStorage.setItem(
      "userNav",
      `${window.location.pathname}${window.location.search}`
    );
    router.push("/signin");
  }, [router]);

  return {
    viewerId,
    isSignedIn: !!viewerId,
    isLoaded,
    /** Falls back to the email local-part so nothing ever renders blank. */
    displayName:
      profile?.display_name?.trim() ||
      profile?.email?.split("@")[0] ||
      "",
    avatarUrl: profile?.avatar_url || "",
    requireSignIn,
  };
};
