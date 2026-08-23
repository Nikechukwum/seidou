import { PageLayout } from "@/components/PageLayout";

import { UserSection } from "../sections/user-section";
import { VideosSection } from "../sections/videos-section";

interface UserViewProps {
  userId: string;
}

export const UserView = ({ userId }: UserViewProps) => {
  return (
    <PageLayout pageTitle="Channel" className="bg-white">
      <div className="flex flex-col gap-6">
        <UserSection userId={userId} />
        <VideosSection userId={userId} />
      </div>
    </PageLayout>
  );
};
