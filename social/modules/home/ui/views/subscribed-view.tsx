import { SocialFeedHeader } from "@/social/components/social-feed-header";

import { SubscribedVideosSection } from "../sections/subscribed-videos-section";

export const SubscribedView = () => {
  return (
    <div className="min-h-lvh bg-white">
      <SocialFeedHeader title="Subscribed" showCategories={false} />
      <div className="pt-20 pb-20">
        <SubscribedVideosSection />
      </div>
    </div>
  );
};
