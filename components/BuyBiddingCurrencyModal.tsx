'use client'
import { Modal } from "./Modal";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";

type Option = {
    credits: number;
    naira: number;
    label: string;
}

const OPTIONS: Option[] = [
    { credits: 100000, naira: 10, label: '100,000 Bidding Credits' },
    { credits: 1000000, naira: 100, label: '1,000,000 Bidding Credits' },
    { credits: 10000000, naira: 1000, label: '10,000,000 Bidding Credits' },
]

type Props = {
    isActive: boolean;
    setIsActive: Dispatch<SetStateAction<boolean>>;
}

export const BuyBiddingCurrencyModal = ({ isActive, setIsActive }: Props) => {
    const [selected, setSelected] = useState<Option>(OPTIONS[0])
    const [purchasing, setPurchasing] = useState(false)
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)

    useEffect(() => {
        if (isActive) setSelected(OPTIONS[0])
    }, [isActive])

    const handleBuy = async () => {
        if (!user?.id) {
            dispatch(showToast({ type: "error", message: "Please sign in to buy bidding currency." }))
            return
        }
        if (purchasing) return

        setPurchasing(true)
        try {
            const res = await fetch('/api/landwars/purchase-bidpack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ naira_amount: selected.naira, credit_amount: selected.credits }),
            })

            const data = await res.json()

            if (!res.ok) {
                dispatch(showToast({ type: "error", message: data.error || "Could not complete the purchase." }))
                return
            }

            dispatch(PartialUpdateUser({
                cash_balance: Number(data.wallet_balance),
                bidding_balance: Number(data.landwars_balance),
            }))
            dispatch(showToast({ type: "success", message: `Purchase successful! ${selected.credits.toLocaleString()} Bidding Credits added.` }))
            setIsActive(false)
        } catch {
            dispatch(showToast({ type: "error", message: "Something went wrong. Please try again." }))
        } finally {
            setPurchasing(false)
        }
    }

    return (
        <Modal isActive={isActive} setIsActive={setIsActive}>
            <h2 className="text-xl font-bold text-[#111827] mb-4">
                Buy Bidding Currency
            </h2>
            <p className="text-gray-500 mb-3">
                Select the amount of bidding currency you would like to buy
            </p>
            <div className="space-y-10">
                <div className="relative">
                    <select
                        value={selected.credits}
                        onChange={(e) => {
                            const opt = OPTIONS.find((o) => o.credits === Number(e.target.value))
                            if (opt) setSelected(opt)
                        }}
                        className="w-full appearance-none px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] pr-10 bg-transparent"
                    >
                        {OPTIONS.map((opt) => (
                            <option key={opt.credits} value={opt.credits}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none" />
                </div>

                <button
                    onClick={handleBuy}
                    disabled={purchasing}
                    className="w-full rounded-full border border-gray-200 text-black bg-transparent py-3.5 text-sm font-bold active:bg-black active:text-white duration-100 disabled:opacity-60"
                >
                    {purchasing ? 'Processing...' : `Pay ₦${selected.naira.toLocaleString()}`}
                </button>
            </div>
        </Modal>
    );
}

export default BuyBiddingCurrencyModal;
