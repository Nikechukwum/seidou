'use client'
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import InfiniteScroll from "react-infinite-scroll-component";
import { sanityClient } from "../lib/sanity/client";
import { Suspense, useEffect, useRef, useState } from "react";
import { HomeProduct } from "@/types";
import { PRODUCT_QUERY, SEARCH_FILTERS } from "@/utils/defaults";
import { ProductContainer } from "@/components/ProductContainer";
import WelcomeModal from "@/components/WelcomeModal";
import { ProductInfo } from "@/components/ProductInfo";
import { Cart } from "@/components/Cart";

export default function Home() {
  const [productData, setProductData] = useState<HomeProduct>([]);
  const [hasMore, setHasMore] = useState(true);
  const [userLikedProducts, setUserLikedProducts] = useState();
  const [userSavedProducts, setUserSavedProducts] = useState();
  const lastId = useRef<string | null>('');
  const initialLoad = useRef(true);
  const [activeFilter, setActiveFilter] = useState<keyof typeof SEARCH_FILTERS>("All");
  const LOCAL_DISABLE_KEY = "seidou_welcome_disabled";

   async function fetchNextPage() {
      const { current } = lastId;
      if (current === null) {
         setHasMore(false);
      }
      const tagFilter = SEARCH_FILTERS[activeFilter].length
         ? `count(tags[@ in $selectedTags]) > 0 &&`
         : "";
      const data = await sanityClient.fetch(
         `*[_type == "product" && _id > $current && 
         ${tagFilter}
         true
         ] | order(_id) [0...3] {
         defaultProductVariant,
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
         tagFilter: tagFilter,
         }
      );
      if (data.length > 0) {
         lastId.current = data[data.length - 1]._id;
         setProductData((prev) => [...prev, ...data]);
      } else {
         lastId.current = null; // Reached the end
         setHasMore(false);
      }
   }

   useEffect(()=>{
    const initialFetch = async () => {
    const results = await sanityClient.fetch(PRODUCT_QUERY);
    setProductData(results)
    lastId.current = results[results.length - 1]._id
   }
    initialFetch()
   }, [])

   useEffect(() => {
    async function filteredNewFetch() {
      const tagFilter = SEARCH_FILTERS[activeFilter].length
        ? `count(tags[@ in $selectedTags]) > 0 &&`
        : "";
      setHasMore(true);
      const data = await sanityClient.fetch(
        `*[_type == "product" &&
            ${tagFilter}
            true
            ] | order(_id) [0...3] {
          defaultProductVariant,
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
          selectedTags: SEARCH_FILTERS[activeFilter],
          tagFilter: tagFilter,
        }
      );
      if (data.length > 0) {
        lastId.current = data[data.length - 1]._id;
        setProductData(data);
      } else {
        setProductData([]);
        setHasMore(false);
      }
      window.scrollTo(0,0)
    }

    if (!initialLoad.current) {
      filteredNewFetch();
    } else {
      initialLoad.current = false;
    }
  }, [activeFilter]);

  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const permanentlyDisabled = localStorage.getItem(LOCAL_DISABLE_KEY) === "true";

    if (permanentlyDisabled) {
      setShowWelcome(false); // user opted out permanently
      return;
    }

    setShowWelcome(true);
    }, []);

    const handleWelcomeClose = (opts?: { permanentlyDisabled?: boolean }) => {
      if (opts?.permanentlyDisabled) {
        localStorage.setItem(LOCAL_DISABLE_KEY, "true");
      }
      setShowWelcome(false);
    };

    const handleWelcomeStart = () => {
      // whatever you want to do when user hits Start
      // e.g., open an inline player, navigate, or just close
      setShowWelcome(false);
    };

  return (
    <div className="min-h-dvh">
      <Header activeFilter={activeFilter} setActiveFilter={setActiveFilter}/>
      <WelcomeModal
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
        onStart={handleWelcomeStart}
      />
      <InfiniteScroll
        dataLength={productData.length}
        next={fetchNextPage}
        hasMore={hasMore}
        loader={<div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-b-transparent border-l-transparent border-black/90 my-1 mx-auto" />}
        endMessage={
          <p className="text-center my-7">
            <b>That's all for now</b>
          </p>
        }
        scrollableTarget="parent"
        className="flex flex-col items-center pt-2 pb-20"
      >
        {productData.map((product) => {
          if (product.vendor && product.vendor.logo)
            return (
              <ProductContainer
                productDetails={product}
                // setLoading={setLoading}
                // userLikedProducts={userLikedProducts}
                // userSavedProducts={userSavedProducts}
                key={product._id}
              />
            );
        })}
      </InfiniteScroll>

      <Suspense>
        <ProductInfo />
      </Suspense>

      <Cart />
    </div>
  );
}
