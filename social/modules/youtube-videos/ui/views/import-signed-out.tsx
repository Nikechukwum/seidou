"use client";

import { useRouter } from "next/navigation";

/**
 * Shown on /import when the server sees no signed-in session.
 *
 * Deliberately NOT an automatic redirect: if the session cookie is not
 * reaching the server, bouncing to /signin and back would loop forever. The
 * button saves /import as the place to come back to — the sign-in page
 * returns to the path stored under `userNav` — and then goes to sign in.
 */
export const ImportSignedOut = () => {
  const router = useRouter();

  const signIn = () => {
    try {
      sessionStorage.setItem("userNav", "/import");
    } catch {
      // storage blocked: sign-in falls back to the home page
    }
    router.push("/signin");
  };

  return (
    <div className="mx-auto flex min-h-lvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-gray-900">Sign in to import videos</h1>
      <p className="mt-2 text-sm text-gray-500">
        Importing writes to the video library, so it needs the admin account. You&apos;ll come
        straight back here after signing in.
      </p>
      <button
        type="button"
        onClick={signIn}
        className="mt-6 w-full rounded-full bg-black py-3.5 text-sm font-bold text-white active:bg-black/70"
      >
        Sign in
      </button>
    </div>
  );
};
