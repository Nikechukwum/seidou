import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { ImportView } from "@/social/modules/youtube-videos/ui/views/import-view";

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

  if (access === "signed-out") redirect("/signin");
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
