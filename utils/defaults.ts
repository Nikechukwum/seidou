const PRODUCT_QUERY = `*[_type == 'product'] | order(_id)[0...5]{
        defaultProductVariant,
        _id,
        title,
        slug,
        vendor->{
        title,
        logo,
        _id,
        },
        likes
    }`;

const SEARCH_FILTERS = {
        All: [],
        Tops: ["blouse", "tee", "shirt"],
        Bags: ["bag"],
        Skirts: ["skirt"],
        Shoes: ["shoes"],
        Jeans: ["jeans"],
        Shades: ["sunglasses"],
        Headwear: ["hat", "cap"],
        Foods: ["burger", "meal", "rice", "chicken", "ice cream"],
};

const INTEREST_TAGS: Record<string, string[]> = {
        aviation: ["aviation", "airplane", "jet", "flight"],
        art: ["art", "painting", "canvas", "sculpture"],
        crypto: ["crypto", "bitcoin", "ethereum", "blockchain", "nft"],
        baking: ["burger", "meal", "rice", "chicken", "ice cream", "bread", "cake", "pastry"],
        botany: ["plant", "flower", "garden", "botany"],
        cars: ["cars", "automotive", "auto"],
        realestate: ["realestate", "interior", "furniture", "decor"],
        tech: ["tech", "gadget", "smartphone", "laptop", "electronics"],
        mens_fashion: ["shirt", "tee", "jeans", "shoes"],
        womens_fashion: ["blouse", "skirt", "bag", "sunglasses", "hat", "cap"],
        dogs: ["dog", "pet"],
};

type FilterMap = Record<string, string[]>;

interface CategoryFilter {
        categories: string[];
        tags: Record<string, string[]>;
        labels: Record<string, string>;
        expandedByCategory: Record<string, string[]>;
}

const INTEREST_LABELS: Record<string, string> = {
        aviation: "Aviation",
        art: "Art",
        crypto: "Crypto",
        baking: "Baking",
        botany: "Botany",
        cars: "Cars",
        realestate: "Real Estate",
        tech: "Technology",
        mens_fashion: "Men's Fashion",
        womens_fashion: "Women's Fashion",
        dogs: "Dogs",
};

function parseInterests(interests: string[]): { categories: string[]; tags: Record<string, string[]> } {
        const categories: string[] = [];
        const tags: Record<string, string[]> = {};

        interests.forEach(interest => {
                if (interest.startsWith('tag:')) {
                        const parts = interest.slice(4).split(':');
                        if (parts.length >= 2) {
                                const catSlug = parts[0];
                                const tag = parts.slice(1).join(':');
                                if (!tags[catSlug]) {
                                        tags[catSlug] = [];
                                }
                                tags[catSlug].push(tag);
                        }
                } else {
                        categories.push(interest);
                }
        });

        return { categories, tags };
}

function expandCategorySlugs(slug: string, tree: Record<string, string[]>): string[] {
        const children = tree[slug];
        if (!children || children.length === 0) return [slug];
        return children.flatMap((child) => expandCategorySlugs(child, tree));
}

function buildInterestFilters(
        interests: string[],
        categoryTitles: Record<string, string> = {},
        categoryTree: Record<string, string[]> = {}
): { filters: FilterMap; categoryFilter: CategoryFilter } {
        if (!interests || interests.length === 0) {
                return {
                        filters: { All: [] },
                        categoryFilter: { categories: [], tags: {}, labels: {}, expandedByCategory: {} },
                };
        }

        const { categories, tags } = parseInterests(interests);

        const filters: FilterMap = { All: [] };

        categories.forEach((catSlug) => {
                filters[catSlug] = [];
        });

        const labels = Object.fromEntries(
                categories.map((catSlug) => [catSlug, categoryTitles[catSlug] || INTEREST_LABELS[catSlug] || catSlug])
        );

        const expandedByCategory = Object.fromEntries(
                categories.map((catSlug) => [catSlug, expandCategorySlugs(catSlug, categoryTree)])
        );

        return {
                filters,
                categoryFilter: { categories, tags, labels, expandedByCategory },
        };
}

const FOOTER_LINKS = [
      {
         label: 'Home',
         icon: 'home',
         href: '/',
      },
      {
         label: 'Land Wars',
         icon: 'gavel',
         href: '/auction',
      },
      {
         label: 'App Center',
         icon: 'apps',
         href: '/app-center',
      },
      {
         label: 'Profile',
         icon: 'account_circle',
         href: '/profile',
      }
  ]

const INTERESTS = [
  { id: 'aviation', label: 'Aviation', icon: 'flight', color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'art', label: 'Art', icon: 'palette', color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' },
  { id: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-200' },
  { id: 'baking', label: 'Baking', icon: 'bakery_dining', color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  { id: 'botany', label: 'Botany', icon: 'potted_plant', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
  { id: 'cars', label: 'Cars', icon: 'directions_car', color: 'text-red-500', bg: 'bg-red-100', border: 'border-red-200' },
  { id: 'realestate', label: 'Real Estate', icon: 'home_work', color: 'text-purple-600', bg: 'bg-purple-200', border: 'border-purple-300' },
  { id: 'tech', label: 'Technology', icon: 'stay_current_portrait', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'mens_fashion', label: "Men's Fashion", icon: 'checkroom', color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'womens_fashion', label: "Women's Fashion", icon: 'styler', color: 'text-pink-600', bg: 'bg-pink-100', border: 'border-pink-200' },
  { id: 'dogs', label: 'Dogs', icon: 'pets', color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' },
];


export {PRODUCT_QUERY, SEARCH_FILTERS, FOOTER_LINKS, INTERESTS, INTEREST_TAGS, buildInterestFilters}
export type {FilterMap, CategoryFilter}