'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sanityClient } from '@/lib/sanity/client';
import { Header } from '@/components/Header';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { ChevronRightIcon } from '@heroicons/react/20/solid';

interface Category {
    _id: string;
    title: string;
    slug: string;
    children: {
        _id: string, 
        title: string, 
        slug: string,
        hasChildren: boolean
    }[]
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [category, setCategory] = useState<Category | null>(null);
  const subCategories = category?.children
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!slug) return;

      try {
        const parentCategory = await sanityClient.fetch<Category>(
          `*[_type == 'category' && slug.current == $slug][0]{
            _id,
            title,
            children[]->{
                _id,
                title,
                "hasChildren": count(children) > 0,
                "slug": slug.current
            },
          }`,
          { slug }
        );
        setCategory(parentCategory)
      } catch (error) {
        console.error('Error fetching subcategories:', error);
      } finally {
        setIsLoading(false)
      }
    };

    fetchSubCategories();
  }, [slug, router]);

  const handleRouting = (slug: string, hasChildren: boolean) => {
    console.log(subCategories)
    if(hasChildren){
        router.push(`/explore/${slug}`)
    } else {
        router.push(`/explore/${slug}/products`);
    }
  }

  return (
    <div className="py-20">
        <FullScreenLoader isActive={isLoading}/>
        <Header pageTitle={category?.title || ''}/>
        {subCategories?.map((subCategory) => {
            const { slug, hasChildren, title } = subCategory
            return(
                <button
                key={subCategory._id}
                onClick={()=>{handleRouting(slug, hasChildren)}}
                className="w-full h-16 px-5 border-b border-b-gray-200 flex items-center justify-between"
                >
                    {title}
                    <ChevronRightIcon className="size-5 text-[#b5b6b8]" />
                </button>
            )
        })}
    </div>
  );
}