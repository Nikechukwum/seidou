import { PageLayout } from "@/components/PageLayout";

import { VideosSection } from "../sections/videos-section";
import { StudioUploadModal } from "../components/studio-upload-modal";

export const StudioView = () => {
  return (
    <PageLayout
      pageTitle="Your videos"
      className="bg-white"
      extraButton={<StudioUploadModal />}
    >
      <VideosSection />
    </PageLayout>
  );
};
