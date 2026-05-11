'use client'
import { Button } from "@/components/Button";
import { PageLayout } from "@/components/PageLayout";
import { Modal } from "@/components/Modal";
import { useState } from "react";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";

const AuctionWalletPage = () => {
    const [modal, setModal] = useState(false)
    const [depositModalActive, setDepositModalActive] = useState(false);
    const [withdrawModalActive, setWithdrawModalActive] = useState(false);

    return (
        <PageLayout pageTitle="Auction Wallet" className="px-4">

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
                    <Button text="Transfer" classname="w-full text-base!" onClick={() => setModal(true)} />
                    <Button text="History" bordered classname="w-full text-base!" onClick={() => setModal(true)} />
                </div>
            </div>

            {/* Deposit Modal */}
            {/* <Modal isActive={depositModalActive} setIsActive={setDepositModalActive}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Deposit Funds</h2>
                <p className="text-slate-600 mb-6">Enter the amount you want to deposit into your auction wallet.</p>
                <div className="space-y-4">
                    <input
                        type="number"
                        placeholder="Amount (₦)"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
                    />
                    <Button text="Confirm Deposit" classname="w-full!" onClick={() => setDepositModalActive(false)} />
                </div>
            </Modal> */}

            {/* Withdraw Modal */}
            {/* <Modal isActive={withdrawModalActive} setIsActive={setWithdrawModalActive}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Withdraw Funds</h2>
                <p className="text-slate-600 mb-6">Enter the amount you want to withdraw from your auction wallet.</p>
                <div className="space-y-4">
                    <input
                        type="number"
                        placeholder="Amount (₦)"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
                    />
                    <Button text="Confirm Withdrawal" bordered classname="w-full!" onClick={() => setWithdrawModalActive(false)} />
                </div>
            </Modal> */}
        </PageLayout>
    );
}

export default AuctionWalletPage;