import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";
import { socialPath } from "@/social/constants";

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
        <Link
          prefetch
          href={socialPath("/studio")}
          className="text-sm font-semibold"
        >
          Studio
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <CategoriesSection categoryId={categoryId} />
        <HomeVideosSection categoryId={categoryId} />
      </div>
    </PageLayout>
  );
};
