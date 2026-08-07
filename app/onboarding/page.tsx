'use client'
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import useAuth from '@/hooks/useAuth';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { setActiveFilter } from '@/redux/feedSlice';
import { Check, ChevronRight } from 'lucide-react';

type SectionItem = {
  label: string;
  slug: string;
};

type Section = {
  id: string;
  title: string;
  items: SectionItem[];
};

const SECTIONS: Section[] = [
  {
    id: 'mens_fashion',
    title: "Men's Fashion",
    items: [
      { label: 'Polo Shirts', slug: 'polo-shirts' },
      { label: 'Oxford Shirts', slug: 'oxford-shirts' },
      { label: 'Long Sleeve Shirts', slug: 'long-sleeve-shirts' },
      { label: 'T-Shirts', slug: 't-shirts' },
      { label: 'Jorts', slug: 'jorts' },
      { label: 'chinos shorts', slug: 'chinos-shorts' },
      { label: 'cargo shorts', slug: 'cargo-shorts' },
      { label: 'cargo trousers', slug: 'cargo-trousers' },
      { label: 'trousers and chinos', slug: 'trousers-and-chinos' },
      { label: 'jeans', slug: 'jeans3' },
      { label: 'Loafers', slug: 'loafers' },
      { label: 'Oxfords', slug: 'oxfords' },
      { label: 'Brogues', slug: 'brogues' },
      { label: 'Sneakers', slug: 'sneakers' },
      { label: 'Sliders', slug: 'sliders' },
      { label: 'Sunglasses', slug: 'sunglasses' },
      { label: 'Belts', slug: 'belts' },
    ],
  },
  {
    id: 'womens_fashion',
    title: "Women's Fashion",
    items: [
      { label: 'Tops', slug: 'women-s-tops' },
      { label: 'Dresses', slug: 'dresses' },
      { label: 'Bottoms', slug: 'women-s-bottoms' },
      { label: 'Footwear', slug: 'footwear-w' },
      { label: 'Bags', slug: 'women-s-bags' },
      { label: 'Accessories', slug: 'women-s-accessories' },
    ],
  },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { checkSession, user, saveInterests } = useAuth();

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<string | null>('mens_fashion');
  const [saving, setSaving] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [backRoute, setBackRoute] = useState<string>('/');
  const [continueRoute, setContinueRoute] = useState<string>('/');
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
      setContinueRoute('/profile');
    } else if (from === 'signup') {
      setBackRoute('/signup');
      setContinueRoute('/');
    } else if (from === 'signin') {
      setBackRoute('/signin');
      setContinueRoute('/');
    } else {
      // Default back to home
      setBackRoute('/');
      setContinueRoute('/');
    }
  }, [searchParams]);

  // Pre-select existing interests (supports real category slugs and legacy tag entries)
  useEffect(() => {
    if (!sessionChecked || !user?.interests || user.interests.length === 0) return;

    const slugToItem = new Map<string, { sectionId: string; label: string }>();
    SECTIONS.forEach((section) =>
      section.items.forEach((item) =>
        slugToItem.set(item.slug, { sectionId: section.id, label: item.label })
      )
    );

    const selected = new Set<string>();
    user.interests.forEach((interest) => {
      if (interest.startsWith('tag:')) {
        const parts = interest.slice(4).split(':');
        if (parts.length < 2) return;
        const sectionId = parts[0];
        const label = parts.slice(1).join(':');
        const section = SECTIONS.find((s) => s.id === sectionId);
        const item = section?.items.find((i) => i.label === label);
        if (item) selected.add(item.slug);
      } else if (slugToItem.has(interest)) {
        selected.add(interest);
      }
    });
    setSelectedSlugs(Array.from(selected));
  }, [sessionChecked, user?.interests]);

  const toggleItem = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const totalSelected = selectedSlugs.length;
  const canContinue = totalSelected >= 1;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);

    const interests = [...selectedSlugs];
    localStorage.setItem('seidou_interests', JSON.stringify(interests));

    const { error } = await saveInterests(interests);
    if (error) {
      console.error('Error saving interests:', error.message);
    }

    // Set the active filter to the first selected category
    dispatch(setActiveFilter(selectedSlugs[0]));

    router.replace(continueRoute);
  };

  if (!sessionChecked) {
    return <FullScreenLoader isActive={true} />;
  }

  return (
    <div className="flex min-h-full flex-col bg-white px-6 py-8">
      <FullScreenLoader isActive={saving} />

      {/* Back Button */}
      <button
        onClick={() => router.push(backRoute)}
        className="mb-5 w-fit text-gray-900 transition-opacity hover:opacity-60"
        aria-label="Back"
      >
        <span className="material-symbols-outlined text-[28px]!">arrow_back</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Update your interests
        </h1>
        <p className="mt-2 text-gray-500 font-medium">
          Change or update the categories and tags you care about.
        </p>
      </div>

      {/* Categories Section */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Categories</h2>

        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className="mb-3 overflow-hidden rounded-2xl border border-gray-100"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="flex w-full items-center justify-between px-5 py-4"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-gray-900">{section.title}</span>
                <ChevronRight
                  className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {section.items.map((item) => {
                    const isSelected = selectedSlugs.includes(item.slug);
                    return (
                      <button
                        key={item.slug}
                        onClick={() => toggleItem(item.slug)}
                        className={`flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors ${
                          isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-500'}>
                          {item.label}
                        </span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-black" strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spacer to push sticky footer to bottom on short pages */}
      <div className="grow" />

      {/* Footer */}
      <div className="sticky bottom-0 -mx-6 mt-10 bg-white px-6 py-4">
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
