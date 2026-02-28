import { createImageUrlBuilder } from '@sanity/image-url';
import { createClient } from 'next-sanity';

const config = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '',
  dataset: "production",
  apiVersion: "2021-03-25",
  useCdn: true,
  token: process.env.NEXT_PUBLIC_SANITY_AUTH_TOKEN,
};


export const sanityClient = createClient(config);

export const urlFor = (source: { asset: { _ref: string; _type: string } }) => 
    createImageUrlBuilder(config).image(source);