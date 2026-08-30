import { SocialProfileView } from "@/social/modules/home/ui/views/social-profile-view";

export const dynamic = "force-dynamic";

// No prefetch: every entry is a link, and the viewer's identity is resolved
// client-side from the Supabase session.
const SocialProfilePage = () => <SocialProfileView />;

export default SocialProfilePage;
