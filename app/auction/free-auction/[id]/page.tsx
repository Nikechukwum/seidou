'use client'
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { BuyBiddingCurrencyModal } from "@/components/BuyBiddingCurrencyModal";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "@/redux/toastSlice";
import { PartialUpdateUser } from "@/redux/authSlice";
import { RootState } from "@/redux/store";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { PlusIcon, Wallet } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import VoiceBidButton from "@/components/VoiceBidButton";
import FloatingDelta from "@/components/FloatingDelta";

type Bid = {
    id: number;
    auctionId: number;
    userId: string;
    bidAmount: number;
    createdAt: string;
    username?: string | null;
}

const TABS = [
    { key: 'buy', label: 'Buy Bidding Currency' },
    { key: 'fruits', label: 'Ability Fruits' },
    { key: 'increase', label: 'Increase Bid' },
] as const

type TabKey = typeof TABS[number]['key']

const LeaderboardPage = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('buy')
    const [placeBidModal, setPlaceBidModal] = useState(false)
    const [buyModal, setBuyModal] = useState(false)
    const [underConstructionModal, setUnderConstructionModal] = useState(false)
    const [bidAmount, setBidAmount] = useState('')
    const [bidding, setBidding] = useState(false)
    const [quickBidding, setQuickBidding] = useState(false)
    const [bids, setBids] = useState<Bid[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [deltaTriggers, setDeltaTriggers] = useState<Record<string, { trigger: number; amount: number }>>({})
    const [scalePop, setScalePop] = useState<Record<string, boolean>>({})
    const [glowPop, setGlowPop] = useState<Record<string, boolean>>({})
    const [pressedIncrement, setPressedIncrement] = useState<number | null>(null)
    const params = useParams()
    const auctionId = params.id as string
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)
    const { checkSession } = useAuth()
    const usernameCacheRef = useRef<Map<string, string | null>>(new Map())

    const fireDelta = useCallback((userId: string, amount: number) => {
        setDeltaTriggers(prev => ({
            ...prev,
            [userId]: { trigger: (prev[userId]?.trigger ?? 0) + 1, amount },
        }))
        setScalePop(prev => ({ ...prev, [userId]: true }))
        setGlowPop(prev => ({ ...prev, [userId]: true }))
        setTimeout(() => setScalePop(prev => ({ ...prev, [userId]: false })), 200)
        setTimeout(() => setGlowPop(prev => ({ ...prev, [userId]: false })), 300)
    }, [])

    const fetchBids = useCallback(async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('Bids')
            .select('*')
            .eq('auctionId', auctionId)
            .order('bidAmount', { ascending: false })
        if (data) {
            const userIds = [...new Set(data.map((b) => b.userId))]
            const uncached = userIds.filter((id) => !usernameCacheRef.current.has(id))
            if (uncached.length > 0) {
                const { data: rpcUsernames, error: rpcError } = await supabase.rpc('get_public_usernames', { user_ids: uncached })
                if (!rpcError && rpcUsernames) {
                    ;(rpcUsernames as { user_id: string; username: string }[]).forEach((u) => {
                        usernameCacheRef.current.set(u.user_id, u.username)
                    })
                } else if (rpcError) {
                    const { data: direct } = await supabase.from('users').select('id, username').in('id', uncached)
                    ;(direct ?? []).forEach((p) => {
                        usernameCacheRef.current.set(p.id, p.username)
                    })
                }
            }
            setBids(data.map((b) => ({ ...b, username: usernameCacheRef.current.get(b.userId) ?? null })))
        }
    }, [auctionId])

    const sortedBids = useMemo(() => {
        const yourId = currentUserId ?? user?.id ?? null
        return [...bids].sort((a, b) => {
            if (yourId && a.userId === yourId && b.userId !== yourId) return -1
            if (yourId && b.userId === yourId && a.userId !== yourId) return 1
            return Number(b.bidAmount) - Number(a.bidAmount)
        })
    }, [bids, currentUserId, user?.id])

    const checkSessionRef = useRef(checkSession)
    checkSessionRef.current = checkSession

    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const [, { data: authData }] = await Promise.all([
                fetchBids(),
                supabase.auth.getUser(),
            ])
            setCurrentUserId(authData.user?.id ?? null)
            await checkSessionRef.current(false)
            setLoading(false)
        }
        init()
    }, [auctionId, fetchBids])

    // --- Supabase Realtime: auto-update leaderboard when any bid changes ---
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(`bids:${auctionId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Bids',
                    filter: `auctionId=eq.${auctionId}`,
                },
                () => {
                    fetchBids()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [auctionId, fetchBids])

    const fetchProfileBalance = useCallback(async () => {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return
        const { data } = await supabase
            .from('users')
            .select('bidding_balance')
            .eq('id', authUser.id)
            .single()
        if (data) {
            dispatch(PartialUpdateUser({ bidding_balance: Number(data.bidding_balance) }))
        }
    }, [dispatch])

    const handlePlaceBid = async () => {
        if (!bidAmount) return
        const numericBid = Number(bidAmount)

        if (user && user.bidding_balance < numericBid) {
            dispatch(showToast({ type: 'error', message: 'Insufficient Bidding Credits.' }))
            return
        }

        setBidding(true)

        if (user) {
            dispatch(PartialUpdateUser({ bidding_balance: user.bidding_balance - numericBid }))
        }

        const res = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionId, bidAmount: numericBid }),
        })

        const data = await res.json()

        if (!res.ok) {
            await fetchProfileBalance()
            dispatch(showToast({ type: 'error', message: data.error || 'Could not place your bid. Please try again.' }))
        } else {
            dispatch(PartialUpdateUser({ bidding_balance: Number(data.bidding_balance) }))
            setBidAmount('')
            setPlaceBidModal(false)
            dispatch(showToast({ type: 'success', message: data.action === 'insert' ? 'Bid placed successfully!' : 'Bid updated successfully!' }))
        }

        setBidding(false)
    }

    const handleQuickBid = async (increment: number) => {
        if (quickBidding) return

        if (user && user.bidding_balance < increment) {
            dispatch(showToast({ type: 'error', message: 'Insufficient Bidding Credits.' }))
            return
        }

        setPressedIncrement(increment)
        setQuickBidding(true)

        // Optimistic: wallet balance
        if (user) {
            dispatch(PartialUpdateUser({ bidding_balance: user.bidding_balance - increment }))
        }

        // Optimistic: bid card amount
        let previousBids: Bid[] | null = null
        if (user) {
            previousBids = bids
            setBids(bids.map((b) =>
                b.userId === user.id
                    ? { ...b, bidAmount: Number(b.bidAmount) + increment }
                    : b
            ))
            fireDelta(user.id, increment)
        }

        try {
            const res = await fetch('/api/landwars/increase-bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auctionId, increment }),
            })

            const data = await res.json()

            if (!res.ok) {
                await fetchProfileBalance()
                if (previousBids) setBids(previousBids)
                dispatch(showToast({ type: 'error', message: data.error || 'Could not increase your bid.' }))
            } else {
                dispatch(PartialUpdateUser({ bidding_balance: Number(data.bidding_balance) }))
            }
        } catch {
            await fetchProfileBalance()
            if (previousBids) setBids(previousBids)
            dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
        }

        setQuickBidding(false)
        setPressedIncrement(null)
    }

    const handleVoiceBid = useCallback(async (increment: number): Promise<boolean> => {
        if (quickBidding) return false
        if (user && user.bidding_balance < increment) return false

        setQuickBidding(true)

        if (user) {
            dispatch(PartialUpdateUser({ bidding_balance: user.bidding_balance - increment }))
        }

        let previousBids: Bid[] | null = null
        if (user) {
            previousBids = bids
            setBids(bids.map((b) =>
                b.userId === user.id
                    ? { ...b, bidAmount: Number(b.bidAmount) + increment }
                    : b
            ))
        }

        try {
            const res = await fetch('/api/landwars/increase-bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auctionId, increment }),
            })

            const data = await res.json()

            if (!res.ok) {
                await fetchProfileBalance()
                if (previousBids) setBids(previousBids)
                setQuickBidding(false)
                return false
            }

            dispatch(PartialUpdateUser({ bidding_balance: Number(data.bidding_balance) }))
            if (user) fireDelta(user.id, increment)
            setQuickBidding(false)
            return true
        } catch {
            await fetchProfileBalance()
            if (previousBids) setBids(previousBids)
            setQuickBidding(false)
            return false
        }
    }, [quickBidding, user, bids, auctionId, dispatch, fetchProfileBalance, fireDelta])

    const handleTabClick = (tab: TabKey) => {
        setActiveTab(tab)
        if (tab === 'buy') setBuyModal(true)
        if (tab === 'fruits') setUnderConstructionModal(true)
        if (tab === 'increase') setPlaceBidModal(true)
    }

    return (
        <PageLayout
            pageTitle="Table"
            className="px-4 bg-[#f5f5f5]"
            extraButton={
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base text-[#111827]">
                        B {(user?.bidding_balance ?? 0).toLocaleString()}
                    </span>
                    <div className="flex items-center justify-center size-8 rounded-full bg-gray-100">
                        <Wallet className="size-4 text-[#4b5563]" />
                    </div>
                </div>
            }
            subHeader={
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => handleTabClick(tab.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-black text-white'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
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

            <BuyBiddingCurrencyModal isActive={buyModal} setIsActive={setBuyModal} />

            <VoiceBidButton
                onBid={handleVoiceBid}
                onBuy={() => setBuyModal(true)}
                disabled={quickBidding || bidding}
            />

            {loading ? (
                <p className="text-center text-gray-500 mt-8">Loading...</p>
            ) : bids.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                    <p className="font-medium">No bids yet</p>
                    <p className="text-sm mt-1">Be the first to place a bid on this auction.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4.5">
                    {bids.map((bid, index) => {
                        const isYou = bid.userId === currentUserId || bid.userId === user?.id
                        return (
                            
                            <div
                                key={bid.id}
                                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
                            >
                                
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="size-10 bg-slate-600 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="relative inline-block max-w-full align-top">
                                            <h2 className="text-xl font-bold text-gray-900 leading-tight truncate">
                                                <span
                                                    className="inline-block transition-all duration-200 rounded-md"
                                                    style={{
                                                        transform: scalePop[bid.userId] ? 'scale(1.08)' : 'scale(1)',
                                                        boxShadow: glowPop[bid.userId] ? '0 0 12px rgba(34,197,94,0.3)' : 'none',
                                                    }}
                                                >
                                                    B {Number(bid.bidAmount).toLocaleString()}
                                                </span>
                                            </h2>
                                            {deltaTriggers[bid.userId] && (
                                                <FloatingDelta
                                                    amount={deltaTriggers[bid.userId].amount}
                                                    type="increase"
                                                    trigger={deltaTriggers[bid.userId].trigger}
                                                />
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-sm mt-1 truncate">
                                            {isYou
                                                ? (bid.username || user?.username || 'You')
                                                : (bid.username || 'Unknown')}
                                        </p>
                                    </div>
                                </div>
                                {isYou && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleQuickBid(50000)}
                                            disabled={quickBidding}
                                            className={`flex-1 flex items-center justify-center gap-1 rounded-full border bg-transparent py-3 text-sm font-bold text-black active:bg-black active:text-white duration-100 disabled:opacity-60 ${
                                                pressedIncrement === 50000 ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-200'
                                            }`}
                                        >
                                            <PlusIcon className="size-4" strokeWidth={2.5} />
                                            50,000
                                        </button>
                                        <button
                                            onClick={() => handleQuickBid(100000)}
                                            disabled={quickBidding}
                                            className={`flex-1 flex items-center justify-center gap-1 rounded-full border bg-transparent py-3 text-sm font-bold text-black active:bg-black active:text-white duration-100 disabled:opacity-60 ${
                                                pressedIncrement === 100000 ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-200'
                                            }`}
                                        >
                                            <PlusIcon className="size-4" strokeWidth={2.5} />
                                            100,000
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </PageLayout>
    );
}

export default LeaderboardPage;
