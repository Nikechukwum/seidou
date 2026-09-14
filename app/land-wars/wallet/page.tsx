'use client'
import { Button } from "@/components/Button";
import { PageLayout } from "@/components/PageLayout";
import { Modal } from "@/components/Modal";
import { useEffect, useState } from "react";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import useAuth from "@/hooks/useAuth";
import useClaimLoyaltyReward from "@/hooks/useClaimLoyaltyReward";

const LandWarsWalletPage = () => {
    const [modal, setModal] = useState(false)
    const { checkSession } = useAuth();
    const { claim, claimingId } = useClaimLoyaltyReward()
    const { user } = useSelector((state: RootState) => state.auth);

    const rewards = user?.loyalty_rewards ?? []

    useEffect(() => {
        checkSession(false);
    }, []);

    return (
        <PageLayout pageTitle="Land Wars Wallet" className="px-4 bg-[#f5f5f5]">

            <Modal isActive={modal} setIsActive={setModal}>
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

                    <Button text="Got it" classname="w-full py-3.5" onClick={()=>{setModal(false)}}/>
                </div>
            </Modal>

            <div className="flex flex-col items-center justify-center">
                {/* Balance Section */}
                <div className="flex flex-col items-center px-5 py-10">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#111827]">
                            B {(user?.bidding_balance ?? 0).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Available
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between w-full gap-4">
                    <Button text="Transfer" classname="w-full text-base!" onClick={() => setModal(true)} />
                    <Button text="History" bordered classname="w-full text-base!" onClick={() => setModal(true)} />
                </div>
            </div>

            {/* Rewards Section */}
            <div className="mt-8">
                {rewards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
                        <p className="font-medium">No rewards yet</p>
                        <p className="text-sm mt-1">Any unclaimed rewards will appear here.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3.5">
                        {rewards.map((reward) => (
                            <div
                                key={reward.id}
                                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between gap-3"
                            >
                                <span className="font-bold text-lg text-gray-900">
                                    B {reward.amount}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        text="Learn More"
                                        size="xs"
                                        bordered
                                        classname="text-xs"
                                        onClick={() => setModal(true)}
                                    />
                                    <button
                                        className="bg-[#60A5FA] hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                        onClick={() => claim(reward)}
                                        disabled={claimingId !== null}
                                    >
                                        {claimingId === reward.id ? "Claiming..." : "Claim"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PageLayout>
    );
}

export default LandWarsWalletPage;
