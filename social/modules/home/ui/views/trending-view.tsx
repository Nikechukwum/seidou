import { PageLayout } from "@/components/PageLayout";

import { TrendingVideosSection } from "../sections/trending-videos-section";

export const TrendingView = () => {
  return (
    <PageLayout pageTitle="Trending" className="bg-white">
      <div className="flex flex-col gap-6">
        <TrendingVideosSection />
      </div>
    </PageLayout>
  );
};
