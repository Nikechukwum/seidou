/**
 * The categories shown on the interests step of onboarding and the Explore
 * grid, in display order.
 *
 * `name` must match categories.name in the database exactly — that is how a
 * slug in the URL resolves to a category row (see explore procedures) and how
 * the importer files a JSON video under one. Seed them with
 * `npm run social:seed-categories`.
 *
 * `image` is artwork under public/social/categories/ with the category name
 * already lettered on it, so the card shows it without its own label.
 * Categories still waiting on artwork leave it unset and fall back to the
 * gradient with a text label.
 */
export interface SocialCategory {
  name: string;
  slug: string;
  gradient: string;
  image?: string;
}

export const SOCIAL_CATEGORIES: SocialCategory[] = [
  { name: "Music", slug: "music", gradient: "linear-gradient(135deg, #ff2d8a 0%, #c2185b 100%)", image: "/social/categories/music.jpg" },
  { name: "Gaming", slug: "gaming", gradient: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)", image: "/social/categories/gaming.jpg" },
  { name: "News", slug: "news", gradient: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)" },
  { name: "Movies & Shows", slug: "movies-shows", gradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)", image: "/social/categories/movies-shows.jpg" },
  { name: "Live", slug: "live", gradient: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)" },
  { name: "Sports", slug: "sports", gradient: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)", image: "/social/categories/sports.jpg" },
  { name: "Learning", slug: "learning", gradient: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)", image: "/social/categories/learning.jpg" },
  { name: "Fashion & Beauty", slug: "fashion-beauty", gradient: "linear-gradient(135deg, #f472b6 0%, #e11d48 100%)" },
  { name: "Entertainment", slug: "entertainment", gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", image: "/social/categories/entertainment.jpg" },
  { name: "Podcasts", slug: "podcasts", gradient: "linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)", image: "/social/categories/podcasts.jpg" },
  { name: "Food", slug: "food", gradient: "linear-gradient(135deg, #facc15 0%, #f97316 100%)" },
  { name: "Animation", slug: "animation", gradient: "linear-gradient(135deg, #fb923c 0%, #ef4444 100%)", image: "/social/categories/animation.jpg" },
  { name: "Comedy", slug: "comedy", gradient: "linear-gradient(135deg, #fde047 0%, #f59e0b 100%)", image: "/social/categories/comedy.jpg" },
  { name: "People & Blogs", slug: "people-blogs", gradient: "linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)", image: "/social/categories/people-blogs.jpg" },
  { name: "Travel", slug: "travel", gradient: "linear-gradient(135deg, #2dd4bf 0%, #0284c7 100%)", image: "/social/categories/travel.jpg" },
];

/**
 * The interests step of onboarding picks from ten of the categories above —
 * five even rows in the two-column grid, so the screen reads as a complete
 * set instead of ending on a single orphaned card.
 *
 * Explore still shows every category and the server still accepts any of them
 * as an interest, so this only narrows the picker. Live is a stream format
 * rather than a topic; News, Food and Fashion & Beauty gave way to Podcasts,
 * Animation and Entertainment, which have artwork; Travel is the narrowest
 * vertical.
 */
const ONBOARDING_EXCLUDED_SLUGS = new Set([
  "live",
  "news",
  "travel",
  "food",
  "fashion-beauty",
]);

export const ONBOARDING_CATEGORIES = SOCIAL_CATEGORIES.filter(
  (category) => !ONBOARDING_EXCLUDED_SLUGS.has(category.slug)
);

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
