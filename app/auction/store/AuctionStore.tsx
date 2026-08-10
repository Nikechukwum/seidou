'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import useAuth from "@/hooks/useAuth";

// Price of the bidpack (in Naira, from the main wallet) and the bidding credits it grants
const BIDPACK_PRICE = 10;
const BIDPACK_REWARD = 10000;

const AuctionStore = () => {
    const dispatch = useDispatch();
    const { checkSession } = useAuth();
    const { user } = useSelector((state: RootState) => state.auth);
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        checkSession(false);
    }, []);

    const handleBuyBidpack = async () => {
        if (!user?.id) {
            dispatch(showToast({ type: "error", message: "Please sign in to buy a bidpack." }));
            return;
        }
        if (purchasing) return;

        setPurchasing(true);
        try {
            const res = await fetch('/api/landwars/purchase-bidpack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ naira_amount: BIDPACK_PRICE, credit_amount: BIDPACK_REWARD }),
            });

            const data = await res.json();

            if (!res.ok) {
                dispatch(showToast({ type: "error", message: data.error || "Could not complete the purchase." }));
                return;
            }

            dispatch(PartialUpdateUser({
                cash_balance: Number(data.wallet_balance),
                bidding_balance: Number(data.landwars_balance),
            }));
            dispatch(showToast({ type: "success", message: `Purchase successful! ${BIDPACK_REWARD.toLocaleString()} Bidding Credits added.` }));
        } catch {
            dispatch(showToast({ type: "error", message: "Something went wrong. Please try again." }));
        } finally {
            setPurchasing(false);
        }
    };

    return (
        <PageLayout pageTitle="Land Wars Store" className="px-6 bg-[#f5f5f5]">
            <BigCard
                title="$ 10k Bidpack"
                description="Get more bids and increase your chances of winning."
                buttonText={purchasing ? "Processing..." : `Pay ₦${BIDPACK_PRICE}`}
                onClick={handleBuyBidpack}
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
