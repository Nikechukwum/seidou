import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { socialPath } from "@/social/constants";

/**
 * "My channel" without needing to know your own id — used by links that want
 * to point at the signed-in user's page.
 */
export const GET = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  redirect(socialPath(`/users/${user.id}`));
};
