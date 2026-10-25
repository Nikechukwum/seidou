/**
 * The categories shown on the interests step of onboarding and the Explore
 * grid, in display order.
 *
 * `name` must match categories.name in the database exactly — that is how a
 * slug in the URL resolves to a category row (see explore procedures) and how
 * the importer files a JSON video under one. Seed them with
 * `npm run social:seed-categories`.
 *
 * `image` is unset until the artwork is ready; the cards fall back to the
 * gradient alone. Drop a path under /public in here and the cards pick it up.
 */
export interface SocialCategory {
  name: string;
  slug: string;
  gradient: string;
  image?: string;
}

export const SOCIAL_CATEGORIES: SocialCategory[] = [
  { name: "Music", slug: "music", gradient: "linear-gradient(135deg, #ff2d8a 0%, #c2185b 100%)" },
  { name: "Gaming", slug: "gaming", gradient: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)" },
  { name: "News", slug: "news", gradient: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)" },
  { name: "Movies & Shows", slug: "movies-shows", gradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)" },
  { name: "Live", slug: "live", gradient: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)" },
  { name: "Sports", slug: "sports", gradient: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)" },
  { name: "Learning", slug: "learning", gradient: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)" },
  { name: "Fashion & Beauty", slug: "fashion-beauty", gradient: "linear-gradient(135deg, #f472b6 0%, #e11d48 100%)" },
  { name: "Podcasts", slug: "podcasts", gradient: "linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)" },
  { name: "Food", slug: "food", gradient: "linear-gradient(135deg, #facc15 0%, #f97316 100%)" },
  { name: "Comedy", slug: "comedy", gradient: "linear-gradient(135deg, #fde047 0%, #f59e0b 100%)" },
  { name: "People & Blogs", slug: "people-blogs", gradient: "linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)" },
  { name: "Travel", slug: "travel", gradient: "linear-gradient(135deg, #2dd4bf 0%, #0284c7 100%)" },
];

/** "Movies & Shows" -> "movies-shows". Also used for categories not listed above. */
export const toCategorySlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const findSocialCategory = (slug: string) =>
  SOCIAL_CATEGORIES.find((category) => category.slug === slug);

export const CATEGORY_TABS = ["all", "shorts", "videos", "channels"] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

export const CATEGORY_PAGE_SIZE = 10;
// Even, so the 2-column shorts grid never ends a page on a half row.
export const SHORTS_PAGE_SIZE = 12;

export const parseCategoryTab = (value?: string): CategoryTab =>
  CATEGORY_TABS.includes(value as CategoryTab) ? (value as CategoryTab) : "all";

/**
 * The explore.getVideos input for a tab. Shared by the server prefetch and the
 * client query: React Query keys on the exact input, so any difference between
 * the two would fetch every page twice.
 */
export const categoryVideosInput = (
  categoryId: string,
  tab: Exclude<CategoryTab, "channels">
) => {
  if (tab === "shorts") {
    return { categoryId, kind: "short" as const, limit: SHORTS_PAGE_SIZE };
  }
  if (tab === "videos") {
    return { categoryId, kind: "video" as const, limit: CATEGORY_PAGE_SIZE };
  }
  return { categoryId, limit: CATEGORY_PAGE_SIZE };
};
