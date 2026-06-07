'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";
import { useEffect } from "react";
import { usePaystackPayment } from "react-paystack";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import { createClient } from "@/lib/supabase/client";
import useAuth from "@/hooks/useAuth";

// Price of the bidpack (in Naira) and the bidding currency it grants
const BIDPACK_PRICE = 10;
const BIDPACK_REWARD = 10000;

const AuctionStore = () => {
    const dispatch = useDispatch();
    const supabase = createClient();
    const { checkSession } = useAuth();
    const { user } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        checkSession(false);
    }, []);

    // Paystack config — key sourced from the original codebase (see .env.local)
    const config = {
        reference: new Date().getTime().toString(),
        email: user?.email ?? "",
        amount: BIDPACK_PRICE * 100, // Paystack expects the amount in kobo
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
    };

    const initializePayment = usePaystackPayment(config);

    // Credit the bidpack's bidding currency once payment succeeds
    const creditBidpack = async () => {
        if (!user?.id) return;

        const newBalance = (user.bidding_balance ?? 0) + BIDPACK_REWARD;
        const { error } = await supabase
            .from("users")
            .update({ bidding_balance: newBalance })
            .eq("id", user.id);

        if (error) {
            dispatch(showToast({ type: "error", message: "Payment received but the wallet update failed. Please contact support." }));
            return;
        }

        dispatch(PartialUpdateUser({ bidding_balance: newBalance }));
        dispatch(showToast({ type: "success", message: `B ${BIDPACK_REWARD.toLocaleString()} added to your bidding balance.` }));
    };

    const handleBuyBidpack = () => {
        if (!user?.email) {
            dispatch(showToast({ type: "error", message: "Please sign in to buy a bidpack." }));
            return;
        }

        initializePayment({
            onSuccess: () => creditBidpack(),
            onClose: () => dispatch(showToast({ type: "error", message: "Payment cancelled." })),
        });
    };

    return (
        <PageLayout pageTitle="Auction Store" className="px-6 bg-[#f5f5f5]">
            <BigCard
                title="Bidpack"
                description="Get more bids and increase your chances of winning."
                buttonText={`Pay ₦${BIDPACK_PRICE}`}
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
