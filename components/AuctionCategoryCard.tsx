'use client'
import { useRouter } from "next/navigation";
import { Button } from "./Button";

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
            Free Mode
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Join now to bid on items for free.
          </p>
        </div>
      </div>

      {/* Button Actions */}
      <div className="flex gap-3">
      <Button 
        text="Learn More"
        classname="flex-1"
        bordered
      />
        <Button 
          text="Open"
          classname="flex-1"
          onClick={() => router.push('/auction/free-auction')}
        />
      </div>
    </div>
  );
};

export default AuctionCategoryCard;