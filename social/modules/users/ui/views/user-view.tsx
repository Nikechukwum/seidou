import { Header } from "@/components/Header";

import { UserSection } from "../sections/user-section";
import { VideosSection } from "../sections/videos-section";

interface UserViewProps {
  userId: string;
}

/**
 * Renders Header directly rather than going through PageLayout.
 *
 * PageLayout pads the page with py-20 (80px) while Header is h-16 (64px), so
 * content starts 16px below the header. That is right for a page of text, but
 * it left a gap of page background above the banner, which should sit flush
 * against the header like a cover image.
 */
export const UserView = ({ userId }: UserViewProps) => {
  return (
    <div className="min-h-lvh bg-white pt-16 pb-20">
      <Header pageTitle="Channel" />
      <div className="flex flex-col gap-6">
        <UserSection userId={userId} />
        <VideosSection userId={userId} />
      </div>
    </div>
  );
};
