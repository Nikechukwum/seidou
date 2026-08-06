'use client'
import { sanityClient } from '@/lib/sanity/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import useAuth from '@/hooks/useAuth';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { setActiveFilter } from '@/redux/feedSlice';

type Category = {
  _id: string;
  title: string;
  slug: string;
  imageUrl: string;
};

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { checkSession, user, saveInterests } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({});
  const [categoryTags, setCategoryTags] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [backRoute, setBackRoute] = useState<string>('/');
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      const init = async () => {
        await checkSession();
        setSessionChecked(true);
      };
      init();
    }
  }, [checkSession]);

  // Determine the back route based on query parameter
  useEffect(() => {
    const from = searchParams.get('from');
    if (from === 'profile') {
      setBackRoute('/profile');
    } else if (from === 'signup') {
      setBackRoute('/signup');
    } else if (from === 'signin') {
      setBackRoute('/signin');
    } else {
      // Default back to home
      setBackRoute('/');
    }
  }, [searchParams]);

  // Pre-populate interests if user has existing interests
  useEffect(() => {
    if (sessionChecked && user?.interests && user.interests.length > 0) {
      const categories: string[] = [];
      const tags: Record<string, string[]> = {};

      user.interests.forEach((interest) => {
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

      setSelectedCategories(categories);
      setSelectedTags(tags);
    }
  }, [sessionChecked, user?.interests]);

  useEffect(() => {
    const getAllCategories = async () => {
      try {
        const results = await sanityClient.fetch<Category[]>(
          `*[_type == 'category' && slug.current != null]{
            _id,
            title,
            "slug": slug.current,
            "imageUrl": images[0].asset->url
          }`
        );
        setCategories(results);
      } catch (e) {
        console.error('Error fetching categories:', e);
      } finally {
        setCategoriesLoading(false);
      }
    };
    getAllCategories();
  }, []);

  // Load tags for pre-selected categories
  useEffect(() => {
    const loadTagsForCategories = async () => {
      for (const catSlug of selectedCategories) {
        if (!categoryTags[catSlug]) {
          try {
            const products = await sanityClient.fetch<{ tags?: string[] }[]>(
              `*[
                _type == "product" &&
                category->slug.current == $slug
              ] | order(_id) {
                tags
              }`,
              { slug: catSlug }
            );

            const allTags = products
              .flatMap(product => product.tags || [])
              .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0);
            const uniqueTags = Array.from(new Set(allTags));

            setCategoryTags(prev => ({
              ...prev,
              [catSlug]: uniqueTags,
            }));
          } catch (e) {
            console.error("Error fetching tags for category:", catSlug, e);
            setCategoryTags(prev => ({
              ...prev,
              [catSlug]: [],
            }));
          }
        }
      }
    };

    if (selectedCategories.length > 0 && categoriesLoading === false) {
      loadTagsForCategories();
    }
  }, [selectedCategories, categoriesLoading]);

  const toggleCategory = async (slug: string) => {
    const isSelected = selectedCategories.includes(slug);

    if (isSelected) {
      setSelectedCategories(prev => prev.filter(s => s !== slug));

      setSelectedTags(prev => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });

      setCategoryTags(prev => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });

      return;
    }

    setSelectedCategories(prev => [...prev, slug]);

    if (!categoryTags[slug]) {
      setTagsLoading(true);

      try {
        const products = await sanityClient.fetch<{ tags?: string[] }[]>(
          `*[
          _type == "product" &&
          category->slug.current == $slug
        ] | order(_id) {
          tags
        }`,
          { slug }
        );

        const allTags = products
          .flatMap(product => product.tags || [])
          .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0);
        const uniqueTags = Array.from(new Set(allTags));

        console.log(`[Onboarding] Fetched ${products.length} products with ${uniqueTags.length} unique tags for category: ${slug}`, uniqueTags);

        setCategoryTags(prev => ({
          ...prev,
          [slug]: uniqueTags,
        }));
      } catch (e) {
        console.error("Error fetching tags for category:", slug, e);

        setCategoryTags(prev => ({
          ...prev,
          [slug]: [],
        }));
      } finally {
        setTagsLoading(false);
      }
    }
  };

  const toggleTag = (categorySlug: string, tag: string) => {
    setSelectedTags(prev => {
      const current = prev[categorySlug] || [];
      const isSelected = current.includes(tag);
      if (isSelected) {
        return { ...prev, [categorySlug]: current.filter(t => t !== tag) };
      } else {
        return { ...prev, [categorySlug]: [...current, tag] };
      }
    });
  };

  const handleContinue = async () => {
    if (selectedCategories.length < 1) return;
    setSaving(true);
    const interests = [
      ...selectedCategories,
      ...Object.entries(selectedTags).flatMap(([catSlug, tags]) =>
        tags.map(tag => `tag:${catSlug}:${tag}`)
      ),
    ];
    localStorage.setItem('seidou_interests', JSON.stringify(interests));
    const { error } = await saveInterests(interests);

    // Set the active filter to the first selected category
    dispatch(setActiveFilter(selectedCategories[0]));

    router.replace('/');
  };

  if (!sessionChecked || categoriesLoading) {
    return <FullScreenLoader isActive={true} />;
  }

  const canContinue = selectedCategories.length >= 1;
  const hasExistingInterests = user?.interests && user.interests.length > 0;

  return (
    <div className="flex flex-col bg-white px-6 py-8">
      <FullScreenLoader isActive={saving} />

      {/* Back Button */}
      <button onClick={() => router.push(backRoute)} className="mb-5 w-fit text-gray-900 transition-opacity hover:opacity-60">
        <span className="material-symbols-outlined text-[28px]!" aria-label="Back">arrow_back</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          {hasExistingInterests ? "Update your interests" : "Let's select your interests."}
        </h1>
        <p className="mt-2 text-gray-500 font-medium">
          {hasExistingInterests
            ? "Change or update the categories and tags you care about."
            : "Select a category, then choose the tags you care about."
          }
        </p>
      </div>

      {/* Categories Section */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Categories</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.slug);
            return (
              <button
                key={category.slug}
                onClick={() => toggleCategory(category.slug)}
                className={`
                  flex flex-col items-center gap-2 px-4 py-3 rounded-xl border w-28 h-28
                  ${isSelected
                    ? 'bg-gray-200 border-gray-300'
                    : 'bg-white border-gray-100 hover:border-gray-300'}
                `}
              >
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.title}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-[28px]! text-blue-500">
                    category
                  </span>
                )}
                <span className={`text-[13px] font-semibold text-center leading-tight ${isSelected ? 'text-gray-800' : 'text-gray-500'}`}>
                  {category.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags Section */}
      {selectedCategories.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Tags</h2>
          {tagsLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent border-l-transparent border-gray-400"></span>
              Loading tags...
            </div>
          )}
          {selectedCategories.map((catSlug) => {
            const tags = categoryTags[catSlug];
            const selected = selectedTags[catSlug] || [];
            const category = categories.find(c => c.slug === catSlug);
            if (!tags) return null;
            return (
              <div key={catSlug} className="mb-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">{category?.title}</h3>
                {tags.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No products in this category</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const isSelected = selected.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(catSlug, tag)}
                          className={`
                            px-4 py-2 rounded-full border text-sm font-medium
                            ${isSelected
                              ? 'bg-gray-200 border-gray-300 text-gray-800'
                              : 'bg-white border-gray-100 hover:border-gray-300 text-gray-500'}
                          `}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Spacer to push button down */}
      <div className="grow" />

      {/* Continue Button */}
      <div className="mt-10 mb-10">
        <button
          disabled={!canContinue || saving}
          onClick={handleContinue}
          className="w-full rounded-[28px] bg-black py-4 text-center font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-b-transparent border-l-transparent border-white"></span>
              Saving...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<FullScreenLoader isActive={true} />}>
      <OnboardingContent />
    </Suspense>
  );
}