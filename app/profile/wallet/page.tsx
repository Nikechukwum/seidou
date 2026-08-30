'use client'
import { Button } from "@/components/Button";
import { PageLayout } from "@/components/PageLayout";
import { DrawerModal } from "@/components/DrawerModal";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import { initializePaystack, generateDepositReference } from "@/lib/paystack";

const MIN_DEPOSIT = 1000;

const Wallet = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [depositModalActive, setDepositModalActive] = useState(false);
  const [withdrawModalActive, setWithdrawModalActive] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [amountError, setAmountError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const balance = user?.cash_balance ?? 0;
  const numericAmount = Number(amount);

  const showError = (message: string) =>
    dispatch(showToast({ type: "error", message }));

  const verifyDeposit = async (reference: string) => {
    try {
      const res = await fetch("/api/wallet/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data?.error || "Could not verify your payment. Please contact support.");
        return;
      }

      // Update the balance in place without a page reload
      dispatch(PartialUpdateUser({ cash_balance: data.newBalance }));
      dispatch(showToast({ type: "success", message: "Deposit Successful" }));
      setAmount("");
      setAmountError("");
      setDepositModalActive(false);
    } catch {
      showError("Could not verify your payment. Please contact support.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!user?.id || !user?.email) {
      showError("You must be signed in to deposit.");
      return;
    }

    if (!amount || !Number.isFinite(numericAmount) || numericAmount < MIN_DEPOSIT) {
      setAmountError(`Minimum deposit is ₦${MIN_DEPOSIT}.`);
      return;
    }

    if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      showError("Paystack is not configured. Please contact support.");
      return;
    }

    setAmountError("");
    setIsProcessing(true);

    const reference = generateDepositReference(user.id);

    try {
      await initializePaystack(
        {
          key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
          email: user.email,
          amount: Math.round(numericAmount * 100), // Paystack uses kobo
          currency: "NGN",
          reference,
          metadata: { userId: user.id, type: "wallet_deposit" },
        },
        {
          onSuccess: () => verifyDeposit(reference),
          onCancel: () => {
            setIsProcessing(false);
            showError("Payment cancelled.");
          },
        }
      );
    } catch (err) {
      console.error("[wallet] paystack init failed:", err);
      setIsProcessing(false);
      showError("Could not open the payment window. Please try again.");
    }
  };

  return (
    <PageLayout pageTitle="Wallet" className="px-4">
      <div className="flex flex-col items-center justify-center">
        {/* Balance Section */}
        <div className="flex flex-col items-center px-5 py-12">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-[#111827]">
              ₦{balance.toLocaleString()}
            </span>
          </div>
          <p className="text-slate-500 font-medium text-sm mt-1">Available</p>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amount (₦)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_DEPOSIT}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError) setAmountError("");
              }}
              placeholder="Enter amount"
              className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
            />
            {amountError ? (
              <span className="text-red-500 text-sm mt-1 block">{amountError}</span>
            ) : (
              <span className="text-gray-400 text-sm mt-1 block">
                Min. deposit: ₦{MIN_DEPOSIT}
              </span>
            )}
          </div>
          <Button
            text={isProcessing ? "Processing..." : "Top Up"}
            classname="w-full py-3"
            onClick={isProcessing ? undefined : handleTopUp}
          />
        </div>
      </DrawerModal>

      {/* Withdraw Modal */}
      <DrawerModal isActive={withdrawModalActive} setIsActive={setWithdrawModalActive}>
        <h2 className="text-xl font-bold text-[#111827] mb-4">Withdraw Amount</h2>
        <p className="text-gray-500 mb-3">Withdrawals are coming soon.</p>
        <div className="space-y-10">
          <Button text="Close" classname="w-full py-3" onClick={() => setWithdrawModalActive(false)} />
        </div>
      </DrawerModal>
    </PageLayout>
  );
};

export default Wallet;
