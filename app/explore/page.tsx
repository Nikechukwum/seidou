'use client'
import ExploreSearchBar from "@/components/ExploreSearchBar";
import { sanityClient } from "@/lib/sanity/client";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ProductInfo } from "@/components/ProductInfo";

const ExplorePage = () => {

    const [rootCategories, setRootCategories] = useState<{
        _id: string,
        title: string,
        slug: string,
        imageUrl: string
    }[]>([])

    useEffect(() => {
        const getRootCategories = async () => {
        const results = await sanityClient.fetch(`*[_type == 'category' && isRootCategory == true]{
            _id,
            title,
            "slug": slug.current,
            "imageUrl": images[0].asset->url
        }`);
            setRootCategories(results);
        }
        getRootCategories();
    }, []);

    return (
    <div className="pt-5 pb-20">

        <ExploreSearchBar />
        <div className="relative z-60">
            <Suspense>
                <ProductInfo />
            </Suspense>
        </div>

        <div className="grid grid-cols-2 gap-4 px-4">
            {rootCategories.map((category)=>{
                return(
                    <Link 
                        key={category._id} 
                        href={`/explore/${category.slug}`}
                        className="w-full aspect-[1/1.6] overflow-hidden flex flex-col"
                    >
                        <div className="relative grow overflow-hidden rounded-2xl">
                            <Image
                                placeholder="blur"
                                blurDataURL="/placeholder.png"
                                className="object-cover"
                                fill
                                src={category.imageUrl || '/placeholder.png'}
                                alt="Product Image"
                                sizes="(max-width: 768px) 200px, 500px"
                            />
                        </div>
                        <div className="shrink-0 p-2 text-sm font-medium">
                            {category.title}
                        </div>
                    </Link>
                )
            })}
        </div>
    </div>
    );
}

export default ExplorePage;