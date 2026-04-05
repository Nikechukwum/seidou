'use client'
import ExploreSearchBar from "@/components/ExploreSearchBar";
import { sanityClient } from "@/lib/sanity/client";
import Image from "next/image";
import { useEffect, useState } from "react";

const ExplorePage = () => {

    const [rootCategories, setRootCategories] = useState<{
        _id: string, 
        title: string, 
        imageUrl: string
    }[]>([])
    
    useEffect(() => {
        const getRootCategories = async () => {
        const results = await sanityClient.fetch(`*[_type == 'category' && isRootCategory == true]{
            _id,
            title,
            "imageUrl": images[0].asset->url
        }`);
            setRootCategories(results);
        }
        getRootCategories();
    }, []);

    return ( 
    <div className="py-20">

        <ExploreSearchBar />

        <div className="grid grid-cols-2 gap-4 px-4">
            {rootCategories.map((category)=>{
                return(
                    <div key={category._id} className="w-full aspect-[1/1.7] overflow-hidden flex flex-col">
                        <div className="relative grow overflow-hidden rounded-2xl">
                            <Image
                                placeholder="blur"
                                blurDataURL="/placeholder.png"
                                className="object-cover"
                                fill
                                src={category.imageUrl || '/placeholder.png'}
                                alt="Product Image"
                                sizes="(max-width: 768px) 500px, 500px"
                            />
                        </div>
                        <div className="shrink-0 p-2 text-sm font-medium">
                            {category.title}
                        </div>
                    </div>
                )
            })}
        </div>
    </div> 
    );
}
 
export default ExplorePage;