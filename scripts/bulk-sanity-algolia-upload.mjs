import { algoliasearch } from 'algoliasearch';
import dotenv from 'dotenv';
import { createClient } from 'next-sanity';
dotenv.config({ path: '.env.local' });


const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '',
  dataset: "production",
  apiVersion: "2021-03-25",
  useCdn: true,
});


const algoliaClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID, 
  process.env.ALGOLIA_WRITE_API_KEY
);

async function importData() {
  const products = await sanityClient.fetch(`*[_type == "product"]{
        _id,
        title,
        vendor->{ title },
        "imageUrl": defaultProductVariant.images[0].asset->url,
        "vendorImageUrl": vendor.logo.asset->url
    }`);

  const algoliaRecords = products.map(product => ({
    objectID: product._id,
    title: product.title || 'Untitled Product',
    image: product.imageUrl? product.imageUrl : '/placeholder.png',
    vendor: product.vendor?.title || 'Unkown Vendor',
    vendorImage: product.vendorImageUrl? product.vendorImageUrl : '/placeholder.png'
  }));

  // Save to Algolia
  try {
    await algoliaClient.saveObjects({
      indexName: 'seidou_products',
      objects: algoliaRecords,
    });
    
    console.log('Successfully imported to Algolia');
  } catch (error) {
    console.error('Error:', error);
  }
}

importData();