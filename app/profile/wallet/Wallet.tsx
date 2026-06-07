'use client'
import { Button } from "@/components/Button";
import { PageLayout } from "@/components/PageLayout";
import { useState } from "react";
import { DrawerModal } from "@/components/DrawerModal";
import { usePaystackPayment } from "react-paystack";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import { createClient } from "@/lib/supabase/client";

const MIN_DEPOSIT = 100;

const Wallet = () => {
    const dispatch = useDispatch();
    const supabase = createClient();
    const { user } = useSelector((state: RootState) => state.auth);

    const [depositModalActive, setDepositModalActive] = useState(false);
    const [withdrawModalActive, setWithdrawModalActive] = useState(false);
    const [amount, setAmount] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    const numericAmount = Number(amount);

    // Paystack config — key sourced from the original codebase (see .env.local)
    const config = {
        reference: new Date().getTime().toString(),
        email: user?.email ?? "",
        amount: numericAmount * 100, // Paystack expects the amount in kobo
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
    };

    const initializePayment = usePaystackPayment(config);

    // Credit the deposited amount to the user's cash_balance in Supabase
    const creditWallet = async (deposited: number) => {
        if (!user?.id) return;
        setIsProcessing(true);

        // Read the latest balance to avoid relying on a stale local value
        const { data: current, error: fetchError } = await supabase
            .from("users")
            .select("cash_balance")
            .eq("id", user.id)
            .single();

        if (fetchError) {
            setIsProcessing(false);
            dispatch(showToast({ type: "error", message: "Could not load your balance. Please contact support." }));
            return;
        }

        const newBalance = (current?.cash_balance ?? 0) + deposited;

        const { error: updateError } = await supabase
            .from("users")
            .update({ cash_balance: newBalance })
            .eq("id", user.id);

        setIsProcessing(false);

        if (updateError) {
            dispatch(showToast({ type: "error", message: "Payment received but the wallet update failed. Please contact support." }));
            return;
        }

        dispatch(PartialUpdateUser({ cash_balance: newBalance }));
        dispatch(showToast({ type: "success", message: `₦${deposited.toLocaleString()} added to your wallet.` }));
        setAmount("");
        setDepositModalActive(false);
    };

    const handleDeposit = () => {
        if (!user?.email) {
            dispatch(showToast({ type: "error", message: "You must be signed in to deposit." }));
            return;
        }
        if (!numericAmount || numericAmount < MIN_DEPOSIT) {
            dispatch(showToast({ type: "error", message: `Minimum deposit is ₦${MIN_DEPOSIT}.` }));
            return;
        }

        const depositedAmount = numericAmount;

        initializePayment({
            onSuccess: () => creditWallet(depositedAmount),
            onClose: () => dispatch(showToast({ type: "error", message: "Payment cancelled." })),
        });
    };

    return (
        <PageLayout pageTitle="Seidou Wallet" className="px-4">
            <div className="flex flex-col items-center justify-center">
                {/* Balance Section */}
                <div className="flex flex-col items-center px-5 py-12">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#111827]">
                            ₦{(user?.cash_balance ?? 0).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Available
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between w-full gap-4">
                    <Button text="Deposit" classname="w-full text-base!" onClick={() => setDepositModalActive(true)} />
                    <Button text="Withdraw" bordered classname="w-full text-base!" onClick={() => setWithdrawModalActive(true)} />
                </div>
            </div>

            {/* Deposit Modal */}
            <DrawerModal isActive={depositModalActive} setIsActive={setDepositModalActive}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Deposit Amount</h2>
                <p className="text-gray-500 mb-3">Enter the amount you want to deposit into your wallet.</p>
                <div className="space-y-10">
                    <div>
                        <input
                            type="number"
                            min={MIN_DEPOSIT}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Amount (₦)"
                            className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] mb-1"
                        />
                        <span className="text-gray-400 text-sm">Min. deposit: ₦{MIN_DEPOSIT}</span>
                    </div>
                    <Button
                        text={isProcessing ? "Processing..." : "Top Up"}
                        classname="w-full py-3"
                        onClick={isProcessing ? undefined : handleDeposit}
                    />
                </div>
            </DrawerModal>

            {/* Withdraw Modal */}
            <DrawerModal isActive={withdrawModalActive} setIsActive={setWithdrawModalActive}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Withdraw Amount</h2>
                <p className="text-gray-500 mb-3">Enter the amount you want to withdraw from your wallet.</p>
                <div className="space-y-10">
                    <input
                        type="number"
                        placeholder="Amount (₦)"
                        className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
                    />
                    <Button text="Confirm" classname="w-full py-3" onClick={() => setWithdrawModalActive(false)} />
                </div>
            </DrawerModal>
        </PageLayout>
    );
}

export default Wallet;
