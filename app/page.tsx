'use client'
import { Footer } from "@/components/Footer";
import { HomeHeader } from "@/components/HomeHeader";
import InfiniteScroll from "react-infinite-scroll-component";
import { sanityClient } from "../lib/sanity/client";
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { HomeProduct } from "@/types";
import { buildInterestFilters, FilterMap, CategoryFilter } from "@/utils/defaults";
import { ProductContainer } from "@/components/ProductContainer";
import WelcomeModal from "@/components/WelcomeModal";
import { ProductInfo } from "@/components/ProductInfo";
import { Cart } from "@/components/Cart";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { appendToFeed, clearFeed, resetFeed, setHasMore, setLastId, setActiveFilter } from "@/redux/feedSlice";
import { SmallLoader } from "@/components/SmallLoader";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function Home() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [feedShouldReset, setFeedShouldReset] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [userLikedProducts, setUserLikedProducts] = useState();
  const [userSavedProducts, setUserSavedProducts] = useState();
  const [showWelcome, setShowWelcome] = useState(false);
  const [categoryTitles, setCategoryTitles] = useState<Record<string, string>>({});

  const feed = useSelector((state: RootState) => state.feed.feed);
  const hasMore = useSelector((state: RootState) => state.feed.hasMore);
  const lastIdFromStore = useSelector((state: RootState) => state.feed.lastId);
  const activeFilter = useSelector((state: RootState) => state.feed.activeFilter) as string;
  const LOCAL_DISABLE_KEY = "seidou_welcome_disabled";
  const SCROLL_POSITION_KEY = "seidou_feed_scroll_position";
  const { checkSession, user } = useAuth();
  const { filters: dynamicFilters, categoryFilter } = useMemo(
    () => buildInterestFilters(user?.interests || [], categoryTitles),
    [user?.interests, categoryTitles]
  );

  const lastId = useRef<string | null>(lastIdFromStore);
  const currentFetchTotal = useRef(feed.length);
  const checkedRef = useRef(false);
  const loadedFilterRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      const verify = async () => {
        await checkSession(false);
        setAuthReady(true);
      };
      verify();
    }
  }, [checkSession]);

  useEffect(() => {
    const getCategoryTitles = async () => {
      try {
        const results = await sanityClient.fetch<{ title: string; slug: string }[]>(
          `*[_type == 'category' && slug.current != null]{
            title,
            "slug": slug.current
          }`
        );

        const nextCategoryTitles = results.reduce((acc, category) => {
          acc[category.slug] = category.title;
          return acc;
        }, {} as Record<string, string>);

        setCategoryTitles(nextCategoryTitles);
      } catch (error) {
        console.error('Error fetching category titles:', error);
      }
    };

    getCategoryTitles();
  }, []);

  // Sync ref when Redux lastId changes (e.g., after filter change)
  useEffect(() => {
    lastId.current = lastIdFromStore;
  }, [lastIdFromStore]);

  /**
   * Fetches the next page of products based on the current lastId and active filter.
   * If shouldReset is true, it will ignore lastId and fetch the first page of results for the new filter.
   * It constructs the query dynamically based on whether it's a reset and the active filter's tags.
   */
  const fetchNextPage = useCallback(async (shouldReset: boolean = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (shouldReset) {
      setFeedLoading(true);
    }
    const current = lastId.current;
    const nextSetQuery = shouldReset ? '' : `_id > $current &&`;
    
    const categoryFilterQuery = categoryFilter.categories.length
      ? activeFilter === "All"
        ? `category->slug.current in $selectedCategories &&`
        : `category->slug.current == $activeCategory &&`
      : "";

    try {
      const data = await sanityClient.fetch(
        `*[_type == "product" && ${nextSetQuery}
        ${categoryFilterQuery}
        true
        ] | order(_id) [0...5] {
        defaultProductVariant{
          "images": images[]{
              "url": asset->url,
              "lqip": asset->metadata.lqip
          }
        },
        _id,
        title,
        slug,
        category,
        vendor->{
           title,
           logo,
           _id
        },
      }`,
        {
          current: current,
          selectedCategories: categoryFilter.categories,
          activeCategory: activeFilter === "All" ? null : activeFilter,
        }
      );
      if (data.length > 0) {
        lastId.current = data[data.length - 1]._id;
        shouldReset ? dispatch(resetFeed(data)) : dispatch(appendToFeed(data));
        dispatch(setLastId(lastId.current));
      } else {
        lastId.current = null;
        dispatch(setLastId(null));
        dispatch(setHasMore(false));
      }
      currentFetchTotal.current += data.length;
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      fetchingRef.current = false;
      setFeedLoading(false);
    }
  }, [activeFilter, categoryFilter, dispatch]);

   const handleFilterChange = useCallback((newFilter: string) => {
      setFeedShouldReset(true);
      dispatch(setActiveFilter(newFilter));
    }, [dispatch]);

  useEffect(() => {
    if (!authReady) return;
    if (loadedFilterRef.current === activeFilter && !feedShouldReset && feed.length > 0) return;

    loadedFilterRef.current = activeFilter;
    setFeedShouldReset(false);
    dispatch(clearFeed());
    lastId.current = null;
    fetchNextPage(true);
  }, [feedShouldReset, activeFilter, authReady, feed.length, dispatch, fetchNextPage]);

  useEffect(() => {
    const permanentlyDisabled = localStorage.getItem(LOCAL_DISABLE_KEY) === "true";

    if (permanentlyDisabled) {
      setShowWelcome(false);
      return;
    }

    setShowWelcome(true);
  }, []);



  // Restore scroll position on mount
  useEffect(() => {
    const mainElement = document.getElementById("main");
    if (mainElement) {
      const savedScrollPosition = localStorage.getItem(SCROLL_POSITION_KEY);
      if (savedScrollPosition !== null) {
        mainElement.scrollTop = parseInt(savedScrollPosition, 10);
      }
      localStorage.removeItem(SCROLL_POSITION_KEY);
    }
  }, []);

  // Also save scroll position in real-time during scrolling (debounced)
  useEffect(() => {
    const mainElement = document.getElementById("main");
    if (!mainElement) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        localStorage.setItem(SCROLL_POSITION_KEY, mainElement.scrollTop.toString());
      }, 100);
    };

    mainElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      mainElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleWelcomeClose = (opts?: { permanentlyDisabled?: boolean }) => {
    if (opts?.permanentlyDisabled) {
      localStorage.setItem(LOCAL_DISABLE_KEY, "true");
    }
    setShowWelcome(false);
  };

  const handleWelcomeStart = () => {
    setShowWelcome(false);
  };

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <SmallLoader color="border-black/90"/>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <HomeHeader
        filterAction={handleFilterChange}
        filters={dynamicFilters}
        filterLabels={categoryFilter.labels}
      />
      <WelcomeModal
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
        onStart={handleWelcomeStart}
      />

      {feedLoading? (
        <div className="h-screen flex items-center justify-center">
          <SmallLoader color="border-black/90"/>
        </div>
      ) : feed.length === 0 ? (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg font-medium">No products in this category</p>
          </div>
        </div>
      ) : (
        <InfiniteScroll
          dataLength={currentFetchTotal.current}
          next={fetchNextPage}
          hasMore={hasMore}
          loader={<div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-b-transparent border-l-transparent border-black/90 my-1 mx-auto" />}
          endMessage={
            <p className="text-center my-7">
              <b>That's all for now</b>
            </p>
          }
          scrollableTarget="main"
          className="flex flex-col items-center pt-2 pb-20"
        >
          {feed.map((product) => {
            if (product.vendor && product.vendor.logo)
              return (
                <ProductContainer
                  productDetails={product}
                  key={product._id}
                />
              );
          })}
        </InfiniteScroll>
      )}

      <Suspense>
        <ProductInfo />
      </Suspense>

      <Cart />
    </div>
  );
}
