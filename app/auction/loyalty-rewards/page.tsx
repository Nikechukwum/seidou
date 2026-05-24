'use client'
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

const LoyaltyRewardsPage = () => {
    const [placeBidModal, setPlaceBidModal] = useState(false)
    const [featureModal, setFeatureModal] = useState(false)
    const auctionItems = [
        { id: 1, amount: "30,000", bids: 6 },
        { id: 2, amount: "30,000", bids: 4 },
        { id: 3, amount: "30,000", bids: 8 },
        { id: 4, amount: "30,000", bids: 5 },
    ];

    return ( 
        <PageLayout pageTitle="Loyalty Rewards" className="px-4 bg-[#f5f5f5]">

            <Modal isActive={placeBidModal} setIsActive={setPlaceBidModal}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Bid Amount</h2>
                <p className="text-gray-500 mb-3">Enter the amount you want to bid.</p>
                <div className="space-y-10">
                    <div>
                        <input
                            type="number"
                            placeholder="Amount (B)"
                            className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] mb-1"
                        />
                    </div>
                    <Button text="Submit" classname="w-full py-3" onClick={() => setPlaceBidModal(false)} />
                </div>
            </Modal>

            <Modal isActive={featureModal} setIsActive={setFeatureModal}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-18 h-18 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <WrenchScrewdriverIcon className="w-8 h-8 text-black" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Under Construction
                    </h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        We are working hard to bring this feature to life. It will be available in a future update.
                    </p>

                    <Button text="Got it" classname="w-full py-3.5" onClick={()=>{setFeatureModal(false)}}/>
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
                                B {item.amount}
                            </span>
                            <InformationCircleIcon className="size-5.5 text-gray-500"/>
                        </div>
                        <div className="flex justify-between">
                            <Button 
                                text="Learn More" 
                                classname="text-xs"
                                size="xs" 
                                bordered={true}
                                onClick={() => setFeatureModal(true)}
                            />
                            <button 
                                className="bg-[#60A5FA] hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                onClick={() => setPlaceBidModal(true)}
                            >
                                Claim
                            </button>
                        </div>
                    </ListCard>
                ))}
            </div>
        </PageLayout>
     );
}
 
export default LoyaltyRewardsPage;