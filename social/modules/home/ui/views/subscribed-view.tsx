import { PageLayout } from "@/components/PageLayout";

import { SocialTabs } from "@/social/components/social-tabs";
import { SubscribedVideosSection } from "../sections/subscribed-videos-section";

export const SubscribedView = () => {
  return (
    <PageLayout pageTitle="Subscribed" className="bg-white">
      <div className="flex flex-col gap-6">
        <SocialTabs />
        <SubscribedVideosSection />
      </div>
    </PageLayout>
  );
};
