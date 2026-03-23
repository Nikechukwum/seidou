'use client'
import useAuth from "@/hooks/useAuth";
import useCart from "@/hooks/useCart";
import { createClient } from "@/lib/supabase/client";
import { AddToCart, ToggleCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { sanityClient, urlFor } from "@/sanity/lib/client";
import { formatCurrency } from "@/utils/helpers";
import { CheckIcon } from "@heroicons/react/24/outline";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

type Props = {
    // productId: string | null
}
export const ProductInfo = ({}: Props) => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const dispatch = useDispatch()
    const { checkSession } = useAuth()
    const { addToCart } = useCart()
    const productId = searchParams.get('productId')
    const [productDetails, setProductDetails] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [forcedLoader, setForcedLoader] = useState(false)
    const [modal, setModal] = useState(false)
    const selfRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    const { user } = useSelector(
        (state: RootState) => state.auth
    );

    const { products } = useSelector(
        (state: RootState) => state.cart
    );

    const handleClose = () => {
        setIsVisible(false);
        router.push('/', {scroll: false})
        setProductDetails(null)
    }

    const goToCheckout = () => {
        dispatch(ToggleCart(true))
        setModal(false)
    }

    const handleAddToBag = async () => {
        setLoading(true)
        const userId = await checkSession()
        if(!userId) return

        const newItem = {
            id: productDetails._id,
            title: productDetails.title,
            price: productDetails.defaultProductVariant?.price,
            image: urlFor(productDetails.defaultProductVariant.images[0]).url(),
            quantity: 1
        };

        const success = await addToCart(newItem)
        if(success) setModal(true)
        setLoading(false)
    }

    useEffect(()=>{
        setIsVisible(productId !== null)
        if(productId){
            const productFetch = async () => {
            const results = await sanityClient.fetch(`*[_type == 'product' && _id == $productId && !(_id in path('drafts.**'))] | order(_id)[0...3]{
                defaultProductVariant,
                _id,
                title,
                variants,
                slug,
                vendor->{
                title,logo,_id},
                'moreFromVendor':*[_type == 'product' && references(^.vendor->{_id}._id)&& ^._id != _id && !(_id in path('drafts.**'))]{
                    _id,
                    defaultProductVariant,
                    title,
                },
                'vendorProductCount':count(*[_type == 'product' && references(^.vendor->{_id}._id)&& ^._id != _id && !(_id in path('drafts.**'))]),
        
                }
                `,
            { productId });
            setTimeout(() => {
                setProductDetails(results[0])
                setForcedLoader(false)
            }, 200);
           }
            productFetch()
        }
    }, [productId])

    return ( 
        <>
            {modal && <div onClick={()=>{setModal(false)}} className="fixed h-dvh top-0 left-0 w-full z-20 bg-white/40 flex justify-center items-center touch-none">
                <div onClick={(e)=>{e.stopPropagation()}} className="bg-white border border-slate-200 p-7 rounded-3xl shadow-lg w-[95%] max-w-md flex flex-col items-center text-center">
                    <div className="w-18 h-18 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                        <CheckIcon className="w-8 h-8 text-emerald-500" strokeWidth={2} />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                        Added to Cart
                    </h2>
                    <p className="text-slate-500 mb-8">
                        Your item has been added to the cart
                    </p>

                    <div className="w-full space-y-3">
                        <button onClick={()=>{goToCheckout()}} className="w-full bg-[#0D1310] hover:bg-black text-white py-4 px-6 rounded-2xl font-semibold flex items-center justify-center transition-all shadow-lg active:scale-[0.98]">
                            View Cart
                            <ArrowRightIcon className="ml-2 w-5 h-5" />
                        </button>

                        <button onClick={()=>{setModal(false)}} className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 py-4 px-6 rounded-2xl font-semibold transition-all active:scale-[0.98]">
                            Continue Shopping
                        </button>
                    </div>
                </div>
            </div>}

            <AnimatePresence>
                {isVisible && 
                    <section ref={selfRef} className="fixed max-w-md -translate-x-1/2 -translate-y-1/2 z-10 left-1/2 top-1/2 h-dvh w-full overflow-y-scroll overscroll-none">
                        <motion.div initial={{y: '10%', opacity: 0}} animate={{y: 0, opacity: 1, transition:{duration: 0.3}}} exit={{y: '10%', opacity: 0, transition:{duration: 0.3}}}
                        onClick={(e)=>{e.stopPropagation()}}  className="min-h-screen w-full bg-white relative">
                            {/* Close btn */}
                            <button onClick={()=>{handleClose()}} className="absolute top-3 right-3 z-12 p-2 rounded-full bg-black/20 backdrop-blur-sm">
                                <X className="text-white"/>
                            </button>

                            {/* Loader */}
                            <AnimatePresence>
                                {(!productDetails || forcedLoader) &&
                                    <motion.div exit={{opacity: 0, transition:{duration: 0.3}}} className="absolute top-0 left-0 w-full bg-white h-screen z-10 grid place-content-center">
                                        <div className="animate-spin rounded-full h-16 w-16 border-11 border-b-transparent border-l-transparent border-zinc-500 mx-auto" />
                                    </motion.div>
                                }
                            </AnimatePresence>

                            {productDetails && 
                            <>
                                {/* Product Image Header */}
                                <div className="w-full h-80 relative overflow-hidden">
                                    <Image
                                        placeholder="blur"
                                        blurDataURL="/placeholder.png"
                                        className="object-cover"
                                        fill
                                        src={urlFor(productDetails.defaultProductVariant.images[0]).url()}
                                        alt="Product Image"
                                        onClick={() => {
                                            // setLoading(true);
                                        }}
                                        sizes="(max-width: 768px) 600px, 680px"
                                    />
                                </div>

                                {/* Product Info */}
                                <div className="px-5 py-6">
                                    <h1 className="font-semibold leading-[1.4] text-lg">{productDetails.title}</h1>
                                    <p className="font-medium mt-1">{formatCurrency(productDetails.defaultProductVariant?.price)}</p>

                                    <div className="flex gap-4 mt-8">
                                        <button className="flex-1 py-3 border-[1.5px] border-black rounded-lg font-bold text-center hover:opacity-90 transition">
                                            Share
                                        </button>
                                        <button disabled={loading} onClick={()=>{
                                            handleAddToBag()
                                        }} className="flex-1 py-3 bg-[#0aad53] text-white rounded-lg font-bold text-center hover:bg-gray-50 transition">
                                            {loading? 
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent border-l-transparent border-white mx-auto" />
                                                :
                                                'Add to Bag'
                                            }
                                        </button>
                                    </div>

                                    {/* Accordion Section */}
                                    <div className="mt-8 border-t border-gray-100">
                                    {["Product Description", "Size Guide", "Shipping Info"].map((item, index) => (
                                        <details key={item} className="group border-b border-gray-100">
                                            <summary className="flex justify-between items-center py-5 cursor-pointer">
                                                <span className="font-bold">{item}</span>
                                                <ChevronDown className="group-open:rotate-180 text-gray-400 duration-300"/>
                                                {/* <svg 
                                                    xmlns="http://www.w3.org/2000/svg" 
                                                    className="h-5 w-5 text-gray-400 transition-transform duration-300" 
                                                    fill="none" 
                                                    viewBox="0 0 24 24" 
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg> */}
                                            </summary>
                                            
                                            <div className="pb-5 text-gray-600 leading-relaxed text-sm duration-300">
                                                -
                                            </div>
                                        </details>
                                    ))}
                                    </div>

                                    {/* Vendor Section */}
                                    <div className="mt-10 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-2xl font-bold tracking-tight">{productDetails.vendor?.title ?? 'Nil'}</h2>
                                            <p className="text-gray-400 font-medium">
                                                {`${productDetails.vendorProductCount} Product${
                                                productDetails.vendorProductCount == 1 ? "" : "s"
                                                } Available`}
                                            </p>
                                        </div>
                                        <div className="w-fit h-fit">
                                            <Image
                                                placeholder="blur"
                                                blurDataURL="/placeholder.png"
                                                className="vendorImage"
                                                width={50}
                                                height={50}
                                                src={urlFor(productDetails.vendor.logo).url()}
                                                alt={productDetails.title}
                                                onClick={() => {
                                                    router.push(`/vendor/${productDetails.vendor._id}`);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* More from Vendor */}
                                    <div className="mt-12 mb-8">
                                        <h3 className="text-xl font-bold mb-6">More from this vendor</h3>
                                        <div className="flex overflow-x-scroll snap-x snap-proximity gap-5">
                                            {productDetails?.moreFromVendor?.map((item: any, i: number) => (
                                                <Link
                                                    href={`?productId=${item._id}`}
                                                    scroll={false}
                                                    key={i}
                                                    onClick={()=>{setForcedLoader(true), setProductDetails(null), selfRef.current?.scrollTo(0,0)}}
                                                    className="shrink-0 w-48 snap-center"
                                                >
                                                    <div className="w-full h-56 relative overflow-hidden rounded-xl">
                                                        <Image
                                                            placeholder="blur"
                                                            blurDataURL="/placeholder.png"
                                                            className="object-cover"
                                                            fill
                                                            src={urlFor(item.defaultProductVariant.images[0]).url()}
                                                            alt="Product Image"
                                                            sizes="(max-width: 768px) 200px, 200px"
                                                            quality={65}
                                                        />
                                                    </div>
                                                    <div className="p-2">
                                                        <p className="mb-1 font-bold leading-[1.3] line-clamp-2">{item.title}</p>
                                                        <h2 className="font-medium">
                                                            {formatCurrency(item.defaultProductVariant.price)}
                                                        </h2>
                                                    </div>
                                                </Link>
                                            ))}
                                            <div className="shrink-0 snap-start w-full h-64 flex items-center">
                                                That's all from this vendor <br />for now...
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                            }
                        </motion.div>
                    </section>
                }
            </AnimatePresence>
        
        </>
    );
}