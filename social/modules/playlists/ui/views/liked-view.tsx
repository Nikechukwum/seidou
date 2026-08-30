import { PageLayout } from "@/components/PageLayout";

import { LikedVideosSection } from "../sections/liked-videos-section";

export const LikedView = () => (
  <PageLayout pageTitle="Liked videos" className="bg-white">
    <LikedVideosSection />
  </PageLayout>
);
