import { PageLayout } from "@/components/PageLayout";

import { HistoryVideosSection } from "../sections/history-videos-section";

export const HistoryView = () => (
  <PageLayout pageTitle="History" className="bg-white">
    <HistoryVideosSection />
  </PageLayout>
);
