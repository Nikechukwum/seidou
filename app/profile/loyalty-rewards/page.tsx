'use client'
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { LoyaltyReward, PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import { createClient } from "@/lib/supabase/client";
import useAuth from "@/hooks/useAuth";

// Bidding currency credited when a loyalty reward is claimed
const REWARD_CLAIM_VALUE = 30000;

const LoyaltyRewardsPage = () => {
    const [featureModal, setFeatureModal] = useState(false)
    const [claimingId, setClaimingId] = useState<number | null>(null)
    const dispatch = useDispatch()
    const supabase = createClient()
    const { checkSession } = useAuth()
    const { user } = useSelector((state: RootState) => state.auth)

    const rewards = user?.loyalty_rewards ?? []

    useEffect(() => {
        checkSession(false)
    }, [])

    // Claim a reward: credit the bidding balance and remove it from the list
    const handleClaim = async (reward: LoyaltyReward) => {
        if (claimingId !== null) return
        if (!user?.id) {
            dispatch(showToast({ type: "error", message: "Please sign in to claim your reward." }))
            return
        }

        setClaimingId(reward.id)
        const newBalance = (user.bidding_balance ?? 0) + REWARD_CLAIM_VALUE
        const updatedRewards = rewards.filter((r) => r.id !== reward.id)

        const { error } = await supabase
            .from("users")
            .update({ bidding_balance: newBalance, loyalty_rewards: updatedRewards })
            .eq("id", user.id)
        setClaimingId(null)

        if (error) {
            dispatch(showToast({ type: "error", message: "Could not claim your reward. Please try again." }))
            return
        }

        dispatch(PartialUpdateUser({ bidding_balance: newBalance, loyalty_rewards: updatedRewards }))
        dispatch(showToast({ type: "success", message: `B ${REWARD_CLAIM_VALUE.toLocaleString()} added to your bidding balance.` }))
    }

    return (
        <PageLayout pageTitle="Loyalty Rewards" className="px-4 bg-[#f5f5f5]">

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

            {rewards.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                    <p className="font-medium">No rewards yet</p>
                    <p className="text-sm mt-1">Any unclaimed rewards will appear here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4.5">
                    {rewards.map((reward, index) => (
                        <ListCard
                            key={reward.id}
                            id={index + 1}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-lg text-gray-900">
                                    B {reward.amount}
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
                                    className="bg-[#60A5FA] hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                    onClick={() => handleClaim(reward)}
                                    disabled={claimingId !== null}
                                >
                                    {claimingId === reward.id ? "Claiming..." : "Claim"}
                                </button>
                            </div>
                        </ListCard>
                    ))}
                </div>
            )}
        </PageLayout>
     );
}

export default LoyaltyRewardsPage;
