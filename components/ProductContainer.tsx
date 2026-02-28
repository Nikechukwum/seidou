import { urlFor } from "@/sanity/lib/client";
import { ProductVariant, Slug, Vendor } from "@/types";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
    productDetails: {
        defaultProductVariant: ProductVariant;
        slug: Slug;
        title: string;
        vendor: Vendor;
        _id: string;
  };
}
export const ProductContainer = ({productDetails}: Props) => {
    const [likes, setLikes] = useState({ likeCount: 5, likeState: false });
    const router = useRouter();
    return (
        <div className="bg-white mb-6 w-full mx-auto overflow-hidden first:mt-25 rounded-b-2xl">
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center">
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
                    <span className="ml-5 font-semibold">{productDetails.vendor.title}</span>
                </div>
                <button className="material-symbols-outlined text-2xl! p-2">
                    more_horiz
                </button>
            </div>
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
                        // console.log(productDetails.slug)
                        router.push(`?productId=${productDetails._id}`, { scroll: false });
                    }}
                />
            </div>
            <div className="flex justify-between items-center py-3 px-4 text-black/85">
                <div className="flex gap-x-5 items-center">
                    <button className="material-symbols-outlined text-3xl! font-light!">
                        favorite
                    </button>
                    <button className="material-symbols-outlined text-3xl! font-light!">
                        chat_bubble
                    </button>
                    <button className="material-symbols-outlined text-3xl! font-light!">
                        share
                    </button>
                </div>
                <div>
                    <button className="material-symbols-outlined text-3xl! font-light!">
                        bookmark
                    </button>
                </div>
            </div>
        </div>
    );
}