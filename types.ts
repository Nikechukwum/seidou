interface ProductVariant {
  price?: number;
  images: {
    url: string;
    lqip: string
  }[];
}
interface Vendor {
  title: string;
  _id: string;
  logo: {
    asset: {
      _ref: string;
      _type: string;
    };
  };
}
interface Slug {
  current: string;
  title: string;
}

type HomeProduct = {
    defaultProductVariant: ProductVariant;
    slug: Slug;
    title: string;
    vendor: Vendor;
    _id: string;
}

interface CategoryProduct {
  _id: string;
  title: string;
  defaultProductVariant: ProductVariant;
  categoryTitle: string
}

export type {HomeProduct, Slug, Vendor, ProductVariant, CategoryProduct}