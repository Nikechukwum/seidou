'use client'
import { Footer } from "@/components/Footer";
import { HomeHeader } from "@/components/HomeHeader";
import InfiniteScroll from "react-infinite-scroll-component";
import { sanityClient } from "../lib/sanity/client";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { HomeProduct } from "@/types";
import { PRODUCT_QUERY, SEARCH_FILTERS } from "@/utils/defaults";
import { ProductContainer } from "@/components/ProductContainer";
import WelcomeModal from "@/components/WelcomeModal";
import { ProductInfo } from "@/components/ProductInfo";
import { Cart } from "@/components/Cart";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { appendToFeed, clearFeed, resetFeed, setHasMore, setLastId, setActiveFilter } from "@/redux/feedSlice";
import { SmallLoader } from "@/components/SmallLoader";
import useAuth from "@/hooks/useAuth";

export default function Home() {
  const dispatch = useDispatch();
  const [feedShouldReset, setFeedShouldReset] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [userLikedProducts, setUserLikedProducts] = useState();
  const [userSavedProducts, setUserSavedProducts] = useState();
  const [showWelcome, setShowWelcome] = useState(false);

  const feed = useSelector((state: RootState) => state.feed.feed);
  const hasMore = useSelector((state: RootState) => state.feed.hasMore);
  const lastIdFromStore = useSelector((state: RootState) => state.feed.lastId);
  const activeFilter = useSelector((state: RootState) => state.feed.activeFilter) as keyof typeof SEARCH_FILTERS;
  const LOCAL_DISABLE_KEY = "seidou_welcome_disabled";
  const SCROLL_POSITION_KEY = "seidou_feed_scroll_position";
  const { isLoading, checkSession } = useAuth();

  const lastId = useRef<string | null>(lastIdFromStore);
  const currentFetchTotal = useRef(feed.length);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      checkSession();
    }
  }, [checkSession]);

  // Sync ref when Redux lastId changes (e.g., after filter change)
  useEffect(() => {
    lastId.current = lastIdFromStore;
  }, [lastIdFromStore]);

  /**
   * Fetches the next page of products based on the current lastId and active filter.
   * If shouldReset is true, it will ignore lastId and fetch the first page of results for the new filter.
   * It constructs the query dynamically based on whether it's a reset and the active filter's tags.
   */
  async function fetchNextPage(shouldReset: boolean = false) {
    if(shouldReset){
      setFeedLoading(true);
    }
    const current = lastId.current;
    const nextSetQuery = shouldReset? '' : `_id > $current &&`
    const tagFilterQuery = SEARCH_FILTERS[activeFilter].length
      ? `count(tags[@ in $selectedTags]) > 0 &&`
      : "";
    const data = await sanityClient.fetch(
      `*[_type == "product" && ${nextSetQuery}
      ${tagFilterQuery}
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
        selectedTags: SEARCH_FILTERS[activeFilter],
        tagFilterQuery: tagFilterQuery,
        nextSetQuery: nextSetQuery,
      }
    );
    if (data.length > 0) {
      lastId.current = data[data.length - 1]._id;
      shouldReset? dispatch(resetFeed(data)) : dispatch(appendToFeed(data));
      dispatch(setLastId(lastId.current));
    } else {
      lastId.current = null;
      dispatch(setLastId(null));
      dispatch(setHasMore(false));
    }
    currentFetchTotal.current += data.length;
    setFeedLoading(false);
  }

   const handleFilterChange = useCallback((newFilter: keyof typeof SEARCH_FILTERS) => {
     setFeedShouldReset(true);
     dispatch(setActiveFilter(newFilter));
   }, [dispatch]);

  useEffect(() => {
    if(feed.length > 0 && !feedShouldReset) return
    fetchNextPage(true);
    setFeedShouldReset(false);
  }, [feedShouldReset, activeFilter]);

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

  return (
    <div className="min-h-dvh">
      <HomeHeader filterAction={handleFilterChange}/>
      <WelcomeModal
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
        onStart={handleWelcomeStart}
      />

      {feedLoading? (
        <div className="h-screen flex items-center justify-center">
          <SmallLoader color="border-black/90"/>
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
