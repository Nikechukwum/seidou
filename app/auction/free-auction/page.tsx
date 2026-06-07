'use client'
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

const FreeAuctionPage = () => {
    const [placeBidModal, setPlaceBidModal] = useState(false)
    const router = useRouter()
    const auctionItems = [
        { id: 1, amount: "30,000", bids: 6 },
        { id: 2, amount: "30,000", bids: 4 },
        { id: 3, amount: "30,000", bids: 8 },
        { id: 4, amount: "30,000", bids: 5 },
    ];

    return ( 
        <PageLayout pageTitle="Free Auction" className="px-4 bg-[#f5f5f5]">

            <Modal isActive={placeBidModal} setIsActive={setPlaceBidModal}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Bid Amount</h2>
                <p className="text-gray-500 mb-3">Enter the amount you want to bid.</p>
                <div className="space-y-10">
                    <div>
                        <input
                            type="number"
                            placeholder="Amount (₦)"
                            className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] mb-1"
                        />
                    </div>
                    <Button text="Submit" classname="w-full py-3" onClick={() => setPlaceBidModal(false)} />
                </div>
            </Modal>

            <div className="flex flex-col gap-4.5">
                {auctionItems.map((item) => (
                    <ListCard 
                        key={item.id}
                        id={item.id}
                    >
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-lg text-gray-900">
                                ₦ {item.amount}
                            </span>
                            <InformationCircleIcon className="size-5.5 text-gray-500"/>
                        </div>
                        <div className="flex justify-between">
                            <div 
                                className="bg-black text-white text-xs font-bold px-4 py-2 rounded-full w-fit cursor-pointer"
                                onClick={() => router.push(`/auction/free-auction/${item.id}`)}
                            >
                                Bids {item.bids}
                            </div>
                            <button 
                                className="bg-[#60A5FA] hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                onClick={() => setPlaceBidModal(true)}
                            >
                                Place bid
                            </button>
                        </div>
                    </ListCard>
                ))}
            </div>
        </PageLayout>
     );
}
 
export default FreeAuctionPage;