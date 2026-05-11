'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";

const AuctionStore = () => {
    return ( 
        <PageLayout pageTitle="Auction Store" className="px-6 bg-[#f5f5f5]">
            <BigCard 
                title="Bidpack"
                description="Get more bids and increase your chances of winning."
                buttonText="Pay ₦10"
                imgOverlay={
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                            <span className="text-xl font-bold text-white">$</span>
                        </div>
                        <span className="text-4xl font-bold tracking-tight text-white">10k</span>
                    </div>
                }
            />
        </PageLayout>
    );
}
 
export default AuctionStore;