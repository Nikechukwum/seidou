'use client'
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ListCard } from "@/components/ListCard";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "lucide-react";

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
    const [detailsModal, setDetailsModal] = useState(false)
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
    const [auctions, setAuctions] = useState<Auction[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

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

    const openDetails = (auction: Auction) => {
        setSelectedAuction(auction)
        setDetailsModal(true)
    }

    return (
        <PageLayout pageTitle="Free Auction" className="px-4 bg-[#f5f5f5]">

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
                                <span className="font-bold text-[22px] text-gray-900">
                                    ₦ {Number(auction.chequeValue).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    text="Learn More"
                                    classname="flex-1 py-1! px-0.5! text-xs whitespace-nowrap"
                                    size="xs"
                                    bordered
                                    onClick={() => openDetails(auction)}
                                />
                                <Button
                                    text="Table"
                                    classname="flex-1 py-3! px-0.5! text-xs whitespace-nowrap"
                                    size="xs"
                                    onClick={() => router.push(`/auction/free-auction/${auction.id}`)}
                                />
                            </div>
                        </ListCard>
                    ))}
                </div>
            )}
        </PageLayout>
     );
}

export default FreeAuctionPage;
