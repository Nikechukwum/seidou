interface ProductVariant {
  images: {
    asset: {
      _ref: string;
      _type: string;
    };
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
}[]

export type {HomeProduct, Slug, Vendor, ProductVariant}