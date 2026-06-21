'use client'
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "@/redux/toastSlice";
import { PartialUpdateUser } from "@/redux/authSlice";
import { RootState } from "@/redux/store";
import { PlusIcon } from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";

type Bid = {
    id: number;
    auctionId: number;
    userId: string;
    bidAmount: number;
    createdAt: string;
}

const LeaderboardPage = () => {
    const [placeBidModal, setPlaceBidModal] = useState(false)
    const [underConstructionModal, setUnderConstructionModal] = useState(false)
    const [bidAmount, setBidAmount] = useState('')
    const [bidding, setBidding] = useState(false)
    const [bids, setBids] = useState<Bid[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const params = useParams()
    const auctionId = params.id as string
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)

    const fetchBids = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('Bids')
            .select('*')
            .eq('auctionId', auctionId)
            .order('bidAmount', { ascending: false })
        if (data) setBids(data)
    }

    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const [, { data: authData }] = await Promise.all([
                fetchBids(),
                supabase.auth.getUser(),
            ])
            setCurrentUserId(authData.user?.id ?? null)
            setLoading(false)
        }
        init()
    }, [auctionId])

    const handlePlaceBid = async () => {
        if (!bidAmount) return
        setBidding(true)

        const res = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionId, bidAmount: Number(bidAmount) }),
        })

        const data = await res.json()

        if (!res.ok) {
            dispatch(showToast({ type: 'error', message: data.error || 'Could not place your bid. Please try again.' }))
        } else {
            await fetchBids()
            if (user) {
                dispatch(PartialUpdateUser({ bidding_balance: user.bidding_balance - Number(bidAmount) }))
            }
            setBidAmount('')
            setPlaceBidModal(false)
            dispatch(showToast({ type: 'success', message: data.action === 'insert' ? 'Bid placed successfully!' : 'Bid updated successfully!' }))
        }

        setBidding(false)
    }

    return (
        <PageLayout
            pageTitle="Table"
            className="px-4 bg-[#f5f5f5]"
            extraButton={
                <button onClick={() => setPlaceBidModal(true)} className="p-1 text-gray-700">
                    <PlusIcon className="size-6" strokeWidth={2.5} />
                </button>
            }
        >
            <Modal isActive={underConstructionModal} setIsActive={setUnderConstructionModal}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-18 h-18 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <WrenchScrewdriverIcon className="w-8 h-8 text-black" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Under Construction</h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        We are working hard to bring this feature to life. It will be available in a future update.
                    </p>
                    <Button text="Got it" classname="w-full py-3.5" onClick={() => setUnderConstructionModal(false)} />
                </div>
            </Modal>

            <Modal isActive={placeBidModal} setIsActive={(v) => { setPlaceBidModal(v); if (!v) setBidAmount('') }}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">
                    {bids.some(b => b.userId === currentUserId) ? 'Increase a Bid' : 'Place a Bid'}
                </h2>
                <p className="text-gray-500 mb-3">Enter the amount to add to your current bid.</p>
                <div className="space-y-10">
                    <input
                        type="number"
                        placeholder="Increase by (₦)"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
                    />
                    <Button
                        text={bidding ? 'Placing...' : 'Submit'}
                        classname="w-full py-3"
                        onClick={handlePlaceBid}
                    />
                </div>
            </Modal>

            {loading ? (
                <p className="text-center text-gray-500 mt-8">Loading...</p>
            ) : bids.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                    <p className="font-medium">No bids yet</p>
                    <p className="text-sm mt-1">Be the first to place a bid on this auction.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4.5">
                    {bids.map((bid, index) => (
                        <ListCard
                            key={bid.id}
                            id={index + 1}
                        >
                            <div className="flex items-center justify-between gap-5 w-full">
                                <span className="shrink-0 font-bold text-lg text-gray-900 grow">
                                    ₦ {Number(bid.bidAmount).toLocaleString()}
                                </span>
                                <span className="font-semibold text-sm text-gray-500 truncate">
                                    {bid.userId === currentUserId ? 'You' : bid.userId}
                                </span>
                            </div>
                                {bid.userId === currentUserId && (
                                <div className="flex gap-2">
                                    <Button
                                        text="Increase bid"
                                        classname="flex-1 py-1! px-0.5! text-xs whitespace-nowrap"
                                        size="xs"
                                        bordered
                                        onClick={() => setPlaceBidModal(true)}
                                    />
                                    <Button
                                        text="Ability cards"
                                        classname="flex-1 py-3! px-0.5! text-xs whitespace-nowrap"
                                        size="xs"
                                        onClick={() => setUnderConstructionModal(true)}
                                    />
                                </div>
                            )}
                        </ListCard>
                    ))}
                </div>
            )}
        </PageLayout>
    );
}

export default LeaderboardPage;
