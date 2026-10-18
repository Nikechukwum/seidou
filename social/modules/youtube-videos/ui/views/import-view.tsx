import { PageLayout } from "@/components/PageLayout";

import { ImportSection } from "../sections/import-section";
import { RecentSection } from "../sections/recent-section";

export const ImportView = () => {
  return (
    <PageLayout pageTitle="Import YouTube videos" className="bg-white">
      <div className="space-y-8 px-4">
        <ImportSection />

        <div className="space-y-4">
          <p className="text-sm font-semibold">Last 10 imported</p>
          <RecentSection />
        </div>
      </div>
    </PageLayout>
  );
};
