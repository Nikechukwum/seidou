import { urlFor } from "@/lib/sanity/client";
import { HomeProduct, ProductVariant, Slug, Vendor } from "@/types";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { ChatBubbleOvalLeftIcon, HeartIcon, ShareIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./Modal";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { Button } from "./Button";

type Props = {
    productDetails: HomeProduct
    priority?: boolean
}
export const ProductContainer = ({productDetails, priority}: Props) => {
    const [likes, setLikes] = useState({ likeCount: 5, likeState: false });
    const [modal, setModal] = useState(false)
    const router = useRouter();
    return (
        <div className="bg-white mb-6 w-full mx-auto overflow-hidden first:mt-25 rounded-b-2xl">

            <Modal isActive={modal} setIsActive={setModal}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-18 h-18 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <WrenchScrewdriverIcon className="w-8 h-8 text-black" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Under Construction
                    </h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        We are working hard to bring this feature to life. It will be available in a future update.
                    </p>

                    <Button text="Got it" classname="w-full py-3.5" onClick={()=>{setModal(false)}}/>
                </div>
            </Modal>

            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center">
                    <Image
                        className="vendorImage"
                        placeholder="blur"
                        blurDataURL="/placeholder.png"
                        width={50}
                        height={50}
                        src={urlFor(productDetails.vendor.logo).url()}
                        alt={productDetails.title}
                        onClick={() => {
                            router.push(`/vendor/${productDetails.vendor._id}`);
                        }}
                    />
                    <span className="ml-5 font-semibold">{productDetails.vendor.title}</span>
                </div>
                <button className="material-symbols-outlined text-2xl! p-2">
                    more_horiz
                </button>
            </div>
            <div className="w-full h-80 relative overflow-hidden">
                <Image
                    priority={priority}
                    placeholder="blur"
                    blurDataURL={productDetails.defaultProductVariant?.images[0]?.lqip}
                    className="object-cover"
                    fill
                    src={productDetails.defaultProductVariant?.images[0]?.url}
                    alt="Product Image"
                    sizes="(max-width: 768px) 500px, 500px"
                    onClick={() => {
                        router.push(`?id=${productDetails._id}`, { scroll: false });
                    }}
                />
            </div>
            <div className="flex justify-between items-center py-3.5 px-4 text-black/85">
                <div className="flex gap-x-4 items-center">
                    <HeartIcon className="size-7" onClick={()=>{setModal(true)}}/>
                    <ChatBubbleOvalLeftIcon className="size-7" onClick={()=>{setModal(true)}}/>
                    <ShareIcon className="size-7" onClick={()=>{setModal(true)}}/>
                </div>
                <div>
                    <BookmarkIcon className="size-7" onClick={()=>{setModal(true)}}/>
                </div>
            </div>
        </div>
    );
}