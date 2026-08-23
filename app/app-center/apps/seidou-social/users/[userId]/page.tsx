import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { UserView } from "@/social/modules/users/ui/views/user-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

const UserPage = async ({ params }: PageProps) => {
  const { userId } = await params;

  // Resolved before rendering: getOne throws NOT_FOUND for a channel that
  // does not exist, and a rejected fire-and-forget prefetch aborts the
  // streamed render and leaves a blank shell.
  try {
    await trpc.users.getOne({ id: userId });
  } catch {
    notFound();
  }

  void trpc.users.getOne.prefetch({ id: userId });
  void trpc.videos.getMany.prefetchInfinite({ userId, limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <UserView userId={userId} />
    </HydrateClient>
  );
};

export default UserPage;
