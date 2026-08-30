import { SocialFeedHeader } from "@/social/components/social-feed-header";

import { TrendingVideosSection } from "../sections/trending-videos-section";

export const TrendingView = () => {
  return (
    <div className="min-h-lvh bg-white">
      {/* Trending is ranked by view count, so a category filter would be
          misleading — the chips are hidden rather than shown inert. */}
      <SocialFeedHeader title="Trending" showCategories={false} />
      <div className="pt-20 pb-20">
        <TrendingVideosSection />
      </div>
    </div>
  );
};
