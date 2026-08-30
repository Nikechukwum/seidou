import { YouView } from "@/social/modules/home/ui/views/you-view";

export const dynamic = "force-dynamic";

// No prefetch: every entry is a link, and the viewer's identity is resolved
// client-side from the Supabase session.
const YouPage = () => <YouView />;

export default YouPage;
