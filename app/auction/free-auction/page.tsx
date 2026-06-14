'use client'
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "@/redux/toastSlice";
import { PartialUpdateUser } from "@/redux/authSlice";
import { RootState } from "@/redux/store";

type Auction = {
    id: number;
    chequeValue: number;
    startTime: string;
    endTime: string;
    bidCount: number;
    hasPlacedBid: boolean;
}

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

const FreeAuctionPage = () => {
    const [placeBidModal, setPlaceBidModal] = useState(false)
    const [detailsModal, setDetailsModal] = useState(false)
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
    const [biddingAuction, setBiddingAuction] = useState<Auction | null>(null)
    const [bidAmount, setBidAmount] = useState('')
    const [bidding, setBidding] = useState(false)
    const [auctions, setAuctions] = useState<Auction[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)

    useEffect(() => {
        const fetchAuctions = async () => {
            const supabase = createClient()

            const [{ data: auctionsData }, { data: authData }] = await Promise.all([
                supabase
                    .from('Auctions')
                    .select('id, chequeValue, startTime, endTime, bids:Bids!auctionId(userId)')
                    .order('createdAt', { ascending: false }),
                supabase.auth.getUser(),
            ])

            if (auctionsData) {
                const userId = authData.user?.id ?? null

                setAuctions(auctionsData.map(auction => ({
                    id: auction.id,
                    chequeValue: auction.chequeValue,
                    startTime: auction.startTime,
                    endTime: auction.endTime,
                    bidCount: auction.bids.length,
                    hasPlacedBid: userId
                        ? auction.bids.some((bid: { userId: string }) => bid.userId === userId)
                        : false,
                })))
            }

            setLoading(false)
        }

        fetchAuctions()
    }, [])

    const openPlaceBid = (auction: Auction) => {
        setBiddingAuction(auction)
        setPlaceBidModal(true)
    }

    const handlePlaceBid = async () => {
        if (!bidAmount || !biddingAuction) return
        setBidding(true)

        const res = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionId: biddingAuction.id, bidAmount: Number(bidAmount) }),
        })

        const data = await res.json()

        if (!res.ok) {
            dispatch(showToast({ type: 'error', message: data.error || 'Could not place your bid. Please try again.' }))
        } else {
            setAuctions(prev => prev.map(a =>
                a.id === biddingAuction.id
                    ? { ...a, bidCount: data.action === 'insert' ? a.bidCount + 1 : a.bidCount, hasPlacedBid: true }
                    : a
            ))
            if (user) {
                dispatch(PartialUpdateUser({ bidding_balance: user.bidding_balance - Number(bidAmount) }))
            }
            setBidAmount('')
            setPlaceBidModal(false)
            dispatch(showToast({ type: 'success', message: data.action === 'insert' ? 'Bid placed successfully!' : 'Bid increased successfully!' }))
        }

        setBidding(false)
    }

    const openDetails = (auction: Auction) => {
        setSelectedAuction(auction)
        setDetailsModal(true)
    }

    return (
        <PageLayout pageTitle="Free Auction" className="px-4 bg-[#f5f5f5]">

            <Modal isActive={placeBidModal} setIsActive={(v) => { setPlaceBidModal(v); if (!v) setBidAmount('') }}>
                <h2 className="text-xl font-bold text-[#111827] mb-4">Place Bid</h2>
                <p className="text-gray-500 mb-3">Enter the amount you want to bid.</p>
                <div className="space-y-10">
                    <input
                        type="number"
                        placeholder="Amount (₦)"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
                    />
                    <Button
                        text={bidding ? 'Submitting...' : 'Submit'}
                        classname="w-full py-3"
                        onClick={handlePlaceBid}
                    />
                </div>
            </Modal>

            <Modal isActive={detailsModal} setIsActive={setDetailsModal}>
                {selectedAuction && (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 pb-6">Auction Details</h2>
                        <div className="flex flex-col divide-y divide-gray-100">
                            {([
                                { label: 'Start Date', dateStr: selectedAuction.startTime },
                                { label: 'End Date', dateStr: selectedAuction.endTime },
                            ] as const).map(({ label, dateStr }) => (
                                <div key={label} className="flex items-center justify-between py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
                                            <Calendar className="h-6 w-6 stroke-[1.5]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">{label}</span>
                                            <span className="text-lg font-bold text-gray-900 mt-0.5">{formatDate(dateStr)}</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500">{formatTime(dateStr)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Modal>

            {loading ? (
                <p className="text-center text-gray-500 mt-8">Loading...</p>
            ) : auctions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                    <p className="font-medium">No auctions available</p>
                    <p className="text-sm mt-1">Active auctions will appear here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4.5">
                    {auctions.map((auction, index) => (
                        <ListCard
                            key={auction.id}
                            id={index + 1}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-lg text-gray-900">
                                    ₦ {Number(auction.chequeValue).toLocaleString()}
                                </span>
                                <InformationCircleIcon
                                    className="size-5.5 text-gray-500 cursor-pointer"
                                    onClick={() => openDetails(auction)}
                                />
                            </div>
                            <div className="flex justify-between">
                                <div
                                    className="bg-black text-white text-xs font-bold px-6 py-2 rounded-full w-fit cursor-pointer"
                                    onClick={() => router.push(`/auction/free-auction/${auction.id}`)}
                                >
                                    Bids {auction.bidCount}
                                </div>
                                {!auction.hasPlacedBid && (
                                    <button
                                        className="bg-[#60A5FA] hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                                        onClick={() => openPlaceBid(auction)}
                                    >
                                        Place bid
                                    </button>
                                )}
                            </div>
                        </ListCard>
                    ))}
                </div>
            )}
        </PageLayout>
     );
}

export default FreeAuctionPage;
