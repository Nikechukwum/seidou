import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { socialPath } from "@/social/constants";

import { SocialTabs } from "@/social/components/social-tabs";

import { CategoriesSection } from "../sections/categories-section";
import { HomeVideosSection } from "../sections/home-videos-section";

interface HomeViewProps {
  categoryId?: string;
}

/**
 * Uses Seidou's PageLayout/Header rather than the upstream sidebar shell.
 * PageLayout is a client component, but a server component may render it, so
 * the page above can still prefetch.
 */
export const HomeView = ({ categoryId }: HomeViewProps) => {
  return (
    <PageLayout
      pageTitle="Seidou Social"
      className="bg-white"
      extraButton={
        <div className="flex items-center gap-3">
          <Link
            prefetch
            href={socialPath("/search")}
            aria-label="Search"
            className="flex items-center"
          >
            <SearchIcon className="size-5" />
          </Link>
          <Link
            prefetch
            href={socialPath("/studio")}
            className="text-sm font-semibold"
          >
            Studio
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <SocialTabs />
        <CategoriesSection categoryId={categoryId} />
        <HomeVideosSection categoryId={categoryId} />
      </div>
    </PageLayout>
  );
};
