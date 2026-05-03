import { PageLayout } from "@/components/PageLayout";
import { Info } from "lucide-react";

const FreeAuctionPage = () => {
    const auctionItems = [
        { id: 1, amount: "30,000", bids: 6 },
        { id: 2, amount: "30,000", bids: 4 },
        { id: 3, amount: "30,000", bids: 8 },
        { id: 4, amount: "30,000", bids: 5 },
    ];

    return ( 
        <PageLayout pageTitle="Free Auction" className="px-4 bg-[#f5f5f5]" backButton>
            <div className="flex flex-col gap-4.5">
                {auctionItems.map((item) => (
                    /* Card Container */
                    <div 
                    key={item.id} 
                    className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
                    >
                    {/* Left Section: Rank Circle and Details */}
                    <div className="flex items-center gap-4">
                        {/* Rank Indicator */}
                        <div className="w-14 h-14 flex items-center justify-center border-2 border-gray-50 rounded-full text-xl font-bold text-gray-800">
                        {item.id}
                        </div>

                        {/* Price and Bid Count */}
                        <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-lg text-gray-900">
                            ₦ {item.amount}
                            </span>
                            <Info size={16} className="text-gray-500 mb-1" />
                        </div>
                        <div className="bg-black text-white text-[10px] font-bold px-4 py-1 rounded-full w-fit">
                            Bids {item.bids}
                        </div>
                        </div>
                    </div>

                    {/* Right Section: Action Button */}
                    <button 
                        className="bg-[#60A5FA] hover:bg-blue-500 text-white text-xs font-bold py-2 px-5 rounded-full transition-colors"
                        // onClick={() => console.log(`Increase bid for item ${item.id}`)}
                    >
                        Increase bid
                    </button>
                </div>
                ))}
            </div>
        </PageLayout>
     );
}
 
export default FreeAuctionPage;