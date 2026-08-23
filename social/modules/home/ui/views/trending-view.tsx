import { PageLayout } from "@/components/PageLayout";

import { SocialTabs } from "@/social/components/social-tabs";
import { TrendingVideosSection } from "../sections/trending-videos-section";

export const TrendingView = () => {
  return (
    <PageLayout pageTitle="Trending" className="bg-white">
      <div className="flex flex-col gap-6">
        <SocialTabs />
        <TrendingVideosSection />
      </div>
    </PageLayout>
  );
};
