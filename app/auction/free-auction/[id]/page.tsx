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

type Bid = {
    id: number;
    auctionId: number;
    userId: string;
    bidAmount: number;
    createdAt: string;
}

const LeaderboardPage = () => {
    const [placeBidModal, setPlaceBidModal] = useState(false)
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
        <PageLayout pageTitle="Leaderboard" className="px-4 bg-[#f5f5f5]">
            <Modal isActive={placeBidModal} setIsActive={(v) => { setPlaceBidModal(v); if (!v) setBidAmount('') }}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Increase Bid</h2>
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
                            <div className="flex">
                                    <button
                                        className="bg-[#60A5FA] hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                        onClick={() => setPlaceBidModal(true)}
                                    >
                                        Increase bid
                                    </button>
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
