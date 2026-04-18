'use client';

import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { sanityClient } from '@/lib/sanity/client';
import Image from 'next/image';
import { formatCurrency } from '@/utils/helpers';
import { Header } from '@/components/Header';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { ProductInfo } from '@/components/ProductInfo';

interface Product {
  _id: string;
  title: string;
  imageUrl: string;
  price?: number;
  categoryTitle: string
}

export default function CategoryProductsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        const productsData = await sanityClient.fetch<Product[]>(
          `*[_type == "product" && category->slug.current == $slug]{
            _id,
            title,
            "imageUrl": defaultProductVariant.images[0].asset->url,
            "price": defaultProductVariant.price,
            "categoryTitle": category->title
          }`,
          { slug }
        );

        setProducts(productsData);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [slug]);

  return (
    <div className="py-20">
      <FullScreenLoader isActive={isLoading}/>
      {products.length > 0 ? (
        <>
          <Header pageTitle={products[0].categoryTitle || ''} />
          <Suspense>
            <ProductInfo />
          </Suspense>
          <div className="grid grid-cols-2 gap-4 px-4">
            {products.map((product) => (
              <div
                key={product._id}
                className="w-full overflow-hidden"
                onClick={() => {
                    router.push(`?id=${product._id}`, { scroll: false });
                }}
              >
                <div className="relative aspect-[1/1.4] overflow-hidden rounded-2xl">
                  <Image
                    placeholder="blur"
                    blurDataURL="/placeholder.png"
                    className="object-cover"
                    fill
                    src={product.imageUrl || '/placeholder.png'}
                    alt={product.title}
                    sizes="(max-width: 768px) 200px, 500px"
                  />
                </div>
                <div className='py-3 text-sm font-medium space-y-1'>
                  <div className="line-clamp-2">
                    {product.title}
                  </div>
                  <div>
                    {formatCurrency(product.price || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="px-4 text-gray-500">No products found for this category.</div>
      )}
    </div>
  );
}
