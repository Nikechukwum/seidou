import { PageLayout } from "@/components/PageLayout";

import { SubscribedVideosSection } from "../sections/subscribed-videos-section";

export const SubscribedView = () => {
  return (
    <PageLayout pageTitle="Subscribed" className="bg-white">
      <div className="flex flex-col gap-6">
        <SubscribedVideosSection />
      </div>
    </PageLayout>
  );
};
