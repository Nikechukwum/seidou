'use client'
import { Button } from "@/components/Button";
import { PageLayout } from "@/components/PageLayout";
import { Modal } from "@/components/Modal";
import { useState } from "react";
import { DrawerModal } from "@/components/DrawerModal";

const WalletPage = () => {
    const [depositModalActive, setDepositModalActive] = useState(false);
    const [withdrawModalActive, setWithdrawModalActive] = useState(false);

    return (
        <PageLayout pageTitle="Seidou Wallet" className="px-4">
            <div className="flex flex-col items-center justify-center">
                {/* Balance Section */}
                <div className="flex flex-col items-center px-5 py-12">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#111827]">₦0</span>
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
                            placeholder="Amount (₦)"
                            className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] mb-1"
                        />
                        <span className="text-gray-400 text-sm">Min. deposit: ₦100</span>
                    </div>
                    <Button text="Top Up" classname="w-full py-3" onClick={() => setDepositModalActive(false)} />
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

export default WalletPage;