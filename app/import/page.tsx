import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { ImportView } from "@/social/modules/youtube-videos/ui/views/import-view";
import { ImportSignedOut } from "@/social/modules/youtube-videos/ui/views/import-signed-out";

export const dynamic = "force-dynamic";

const ImportPage = async () => {
  // youtubeVideos.getRecent is admin-only, so awaiting it is the access check
  // — see the note in studio/page.tsx on why this cannot be a fire-and-forget
  // prefetch.
  //
  // redirect() and notFound() throw control-flow signals, so they must sit
  // outside the catch or they would be swallowed.
  let access: "granted" | "signed-out" | "not-admin" = "granted";
  try {
    await trpc.youtubeVideos.getRecent();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      access = "signed-out";
    } else if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      access = "not-admin";
    } else {
      throw error;
    }
  }

  // Signed out: offer a sign-in that comes back here, instead of redirecting
  // straight to /signin — an automatic redirect is what produced the
  // sign-in -> /import -> sign-in loop when the session did not reach the
  // server. Log which case it is so the next one is quick to triage.
  if (access === "signed-out") {
    const supabaseCookies = (await cookies()).getAll().filter((c) => c.name.startsWith("sb-"));
    console.warn("[import] no signed-in session on the server:",
      supabaseCookies.length
        ? "a Supabase session cookie was sent but is invalid or expired"
        : "the browser sent no Supabase session cookie");
    return <ImportSignedOut />;
  }
  // A 404 rather than a "forbidden" page: non-admins are not told it exists.
  if (access === "not-admin") notFound();

  void trpc.youtubeVideos.getRecent.prefetch();

  return (
    <HydrateClient>
      <ImportView />
    </HydrateClient>
  );
};

export default ImportPage;
