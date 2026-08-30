import { SocialFeedHeader } from "@/social/components/social-feed-header";

import { HomeVideosSection } from "../sections/home-videos-section";

interface HomeViewProps {
  categoryId?: string;
}

/**
 * Uses SocialFeedHeader rather than PageLayout: the category chips live
 * inside the header so they collapse away on scroll, matching the games app.
 * That means the padding is set here (pt-28) instead of by PageLayout.
 */
export const HomeView = ({ categoryId }: HomeViewProps) => {
  return (
    <div className="min-h-lvh bg-white">
      <SocialFeedHeader title="Seidou Social" categoryId={categoryId} />
      <div className="pt-28 pb-20">
        <HomeVideosSection categoryId={categoryId} />
      </div>
    </div>
  );
};
