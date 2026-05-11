'use client'
import { useRouter } from "next/navigation";

const AuctionCategoryCard = () => {
    const router = useRouter()
  return (
    /* Main card container with rounded corners and subtle shadow */
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start gap-4 mb-6">
        {/* Profile/Avatar placeholder */}
        <div className="size-10 bg-slate-600 rounded-full shrink-0" />
        <div>
          {/* Title and Description */}
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            Free Auction
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Join now to bid on items for free.
          </p>
        </div>
      </div>

      {/* Button Actions */}
      <div className="flex gap-3">
        <button 
          className="flex-1 py-2 px-6 border border-gray-300 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => console.log('Learn more clicked')}
        >
          Learn more
        </button>
        <button 
          className="flex-1 py-2 px-6 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors"
          onClick={() => router.push('/auction/free-auction')}
        >
          Open
        </button>
      </div>
    </div>
  );
};

export default AuctionCategoryCard;