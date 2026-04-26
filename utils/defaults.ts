const PRODUCT_QUERY = `*[_type == 'product'] | order(_id)[0...5]{
        defaultProductVariant,
        _id,
        title,
        slug,
        vendor->{
        title,
        logo,
        _id,
        },
        likes
    }`;

const SEARCH_FILTERS = {
        All: [],
        Tops: ["blouse", "tee", "shirt"],
        Bags: ["bag"],
        Skirts: ["skirt"],
        Shoes: ["shoes"],
        Jeans: ["jeans"],
        Shades: ["sunglasses"],
        Headwear: ["hat", "cap"],
        Foods: ["burger", "meal", "rice", "chicken", "ice cream"],
    };

const FOOTER_LINKS = [
      {
         label: 'Home',
         icon: 'home',
         href: '/',
      },
      // {
      //    label: 'Auction',
      //    icon: 'gavel',
      //    href: '/auction',
      // },
      {
         label: 'App Center',
         icon: 'apps',
         href: '/app-center',
      },
      {
         label: 'Profile',
         icon: 'account_circle',
         href: '/profile',
      }
  ]

const INTERESTS = [
  { id: 'aviation', label: 'Aviation', icon: 'flight', color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'art', label: 'Art', icon: 'palette', color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' },
  { id: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-200' },
  { id: 'baking', label: 'Baking', icon: 'bakery_dining', color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  { id: 'botany', label: 'Botany', icon: 'potted_plant', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
  { id: 'cars', label: 'Cars', icon: 'directions_car', color: 'text-red-500', bg: 'bg-red-100', border: 'border-red-200' },
  { id: 'realestate', label: 'Real Estate', icon: 'home_work', color: 'text-purple-600', bg: 'bg-purple-200', border: 'border-purple-300' },
  { id: 'tech', label: 'Technology', icon: 'stay_current_portrait', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'mens_fashion', label: "Men's Fashion", icon: 'checkroom', color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'womens_fashion', label: "Women's Fashion", icon: 'styler', color: 'text-pink-600', bg: 'bg-pink-100', border: 'border-pink-200' },
  { id: 'dogs', label: 'Dogs', icon: 'pets', color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' },
];


export {PRODUCT_QUERY, SEARCH_FILTERS, FOOTER_LINKS, INTERESTS}