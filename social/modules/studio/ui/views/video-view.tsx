import { PageLayout } from "@/components/PageLayout";

import { FormSection } from "../sections/form-section";

interface VideoViewProps {
  videoId: string;
}

export const VideoView = ({ videoId }: VideoViewProps) => {
  return (
    <PageLayout pageTitle="Edit video" className="bg-white">
      <FormSection videoId={videoId} />
    </PageLayout>
  );
};
