'use client'
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageLayout } from "@/components/PageLayout";
import { BuyBiddingCurrencyModal } from "@/components/BuyBiddingCurrencyModal";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "@/redux/toastSlice";
import { PartialUpdateUser } from "@/redux/authSlice";
import { RootState } from "@/redux/store";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { Wallet } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import VoiceBidButton from "@/components/VoiceBidButton";
import FloatingDelta from "@/components/FloatingDelta";
import ControlsModal from "@/components/ControlsModal";
import MultiplyFruitAbility from "@/components/MultiplyFruitAbility";
import DivideFruitAbility, { DivideFruitBadge, DivideStatusPill } from "@/components/DivideFruitAbility";
import StealFruitAbility from "@/components/StealFruitAbility";
import { MULTIPLY_FACTOR, DIVIDE_FACTOR, STEAL_PER_SECOND, STEAL_FRUIT_AMOUNT, STEAL_FRUIT_DURATION_S } from "@/lib/abilityFruits";
import { motion } from "motion/react";
import Image from "next/image";
import { useBidControls } from "@/hooks/useBidControls";

type Bid = {
    id: number;
    auctionId: number;
    userId: string;
    bidAmount: number;
    createdAt: string;
    username?: string | null;
}

// BIG SIS REQUEST: "Increase Bid" renamed to "Controls"
const TABS = [
    { key: 'buy', label: 'Buy Bidding Currency' },
    { key: 'fruits', label: 'Ability Fruits' },
    { key: 'controls', label: 'Controls' },
] as const

type TabKey = typeof TABS[number]['key']

// DEV NOTE (design): "If the result exceeds the max bid limit, cap at the limit."
const MAX_BID_LIMIT = 50_000_000

const LeaderboardPage = () => {
    const [controlsModal, setControlsModal] = useState(false)
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
    const router = useRouter()
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)
    const { checkSession } = useAuth()
    const usernameCacheRef = useRef<Map<string, string | null>>(new Map())

    // BIG SIS REQUEST: bid controls (increment / slider / voice)
    const { bidMode, setBidMode, incrementAmounts, sliderConfig, getSliderValueFromPosition } = useBidControls()

    // BIG SIS REQUEST: slider states
    const [sliderDragging, setSliderDragging] = useState(false)
    const [sliderValue, setSliderValue] = useState(sliderConfig.min)
    const [sliderCancelled, setSliderCancelled] = useState(false)
    const sliderTrackRef = useRef<HTMLDivElement>(null)

    // BIG SIS REQUEST: voice mode key — forces VoiceBidButton remount when switching to voice
    const [voiceKey, setVoiceKey] = useState(0)

    // BIG SIS REQUEST: Ability Fruit MULTIPLY state. The factor comes from the
    // fruit's level (everyone is level 1 -> x2 for now), so there is nothing to
    // pick — Activate fires straight away.
    const [multiplyTarget, setMultiplyTarget] = useState<string | null>(null)

    // BIG SIS REQUEST: Ability Fruit DIVIDE state. The fruit appears on YOUR
    // card, travels to whoever holds FIRST POSITION and divides their bid.
    type DivideStage = 'idle' | 'appear' | 'travel' | 'covering' | 'explode' | 'settle'
    const [divideStage, setDivideStage] = useState<DivideStage>('idle')
    const [divideTarget, setDivideTarget] = useState<string | null>(null)
    const [divideFlight, setDivideFlight] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
    const divideTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

    // clear any in-flight divide timers when the page unmounts
    useEffect(() => () => {
        divideTimeoutsRef.current.forEach(clearTimeout)
        divideTimeoutsRef.current = []
    }, [])

    // BIG SIS REQUEST: Ability Fruit STEAL BIDDING CURRENCY state. Auto-targets
    // every other player with a bid, drains 1,000 BC/sec over a 60s countdown,
    // then pools all the stolen BC onto my bid in one explosion.
    type StealStage = 'idle' | 'active' | 'explode' | 'settle'
    const [stealStage, setStealStage] = useState<StealStage>('idle')
    const [stealSeconds, setStealSeconds] = useState(STEAL_FRUIT_DURATION_S)
    const [stealGain, setStealGain] = useState(0)
    const [stealTargets, setStealTargets] = useState<string[]>([])
    const stealCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Per-target starting balances (the ground truth for every drain tick).
    const stealBasisRef = useRef<Map<string, number>>(new Map())
    // Full table snapshot taken at activation — fallback if the commit RPC fails.
    const stealSnapshotRef = useRef<typeof bids>([])
    // Latest resolved loss per target (drives the aftermath deltas).
    const [stealLossByPlayer, setStealLossByPlayer] = useState<Record<string, number>>({})
    const myUserIdRef = useRef<string | null>(null)

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

    // BIG SIS REQUEST: the Ability Fruits tab opens the Ability Fruits page
    // first — the player picks a fruit there, then comes back here to target.
    const openAbilityFruits = useCallback(() => {
        router.push(`/auction/free-auction/${auctionId}/ability-fruits`)
    }, [router, auctionId])

    // BIG SIS REQUEST: Controls tab opens ControlsModal
    const handleTabClick = (tab: TabKey) => {
        if (tab === 'fruits') {
            openAbilityFruits()
            return
        }
        if (tab === 'buy') setBuyModal(true)
        if (tab === 'controls') setControlsModal(true)
    }

    // BIG SIS REQUEST: tapping Activate on the Ability Fruits page sends the
    // player back here with ?fruit=<id> and the ability fires IMMEDIATELY on
    // their own bid card — no modal, no factor to pick. Waits for the bids to
    // load so FRAME 2 starts on a card that is actually on screen.
    const armedFruitRef = useRef<string | null>(null)
    useEffect(() => {
        const armed = new URLSearchParams(window.location.search).get('fruit')
        if (!armed) return
        window.history.replaceState(null, '', `/auction/free-auction/${auctionId}`)
        armedFruitRef.current = armed
    }, [auctionId])

    // BIG SIS REQUEST: Ability Fruit MULTIPLY — optimistic update at FRAME 4 + server commit
    const handleMultiplyOptimistic = useCallback((id: number | string, newBid: number) => {
        const userId = String(id)
        // Update only the target row immediately (optimistic). Other rows keep the
        // same object reference so only this card re-renders.
        setBids(prev => prev.map(b => b.userId === userId ? { ...b, bidAmount: newBid } : b))

        // Commit server-side; revert on failure
        const previousBids = bids
        void (async () => {
            try {
                const res = await fetch('/api/landwars/multiply-bid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, factor: MULTIPLY_FACTOR }),
                })
                const data = await res.json()
                if (!res.ok) {
                    setBids(previousBids)
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not multiply the bid.' }))
                }
            } catch {
                setBids(previousBids)
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [auctionId, bids, dispatch])

    // SELF ONLY: Multiply always runs on your own bid — there is no player to
    // pick. Guard the case where you have not bid on this table yet.
    const myUserId = currentUserId ?? user?.id ?? null
    const myBid = useMemo(
        () => (myUserId ? bids.find(b => b.userId === myUserId) ?? null : null),
        [bids, myUserId]
    )

    // keep a ref of who I am so the steal countdown/commit never need to be
    // re-created when the balance array changes.
    useEffect(() => {
        myUserIdRef.current = myUserId
    }, [myUserId])

    const handleMultiplySelf = useCallback(() => {
        if (multiplyTarget || stealStage !== 'idle') return
        if (!myUserId || !myBid) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        setMultiplyTarget(myUserId)
    }, [multiplyTarget, myUserId, myBid, dispatch])

    // FRAME 5 (settled): the overlay is gone — float "+X,XXX,XXX ↑" next to the
    // target's new bid, the same green delta a normal bid raise shows.
    const handleMultiplyComplete = useCallback((id: number | string, delta: number) => {
        setMultiplyTarget(null)
        if (delta > 0) fireDelta(String(id), delta)
    }, [fireDelta])

    // BIG SIS REQUEST: Ability Fruit DIVIDE — the fruit ALWAYS hits whoever
    // holds FIRST POSITION. It appears on YOUR card and travels across to rest
    // on the #1 card (FRAME 2), their bid splits old -> reduced (FRAME 3), the
    // red "-X,XXX,XXX ↓" floats off (FRAME 4), then it settles (FRAME 5).
    const handleDivideOptimistic = useCallback((userId: string) => {
        const previousBids = bids
        const oldBid = Number(previousBids.find(b => b.userId === userId)?.bidAmount ?? 0)
        const divided = Math.max(1, Math.floor(oldBid / DIVIDE_FACTOR))
        setBids(prev => prev.map(b => b.userId === userId ? { ...b, bidAmount: divided } : b))

        void (async () => {
            try {
                const res = await fetch('/api/landwars/divide-bid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, factor: DIVIDE_FACTOR }),
                })
                const data = await res.json()
                if (!res.ok) {
                    setBids(previousBids)
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not divide the bid.' }))
                } else if (data && data.target_user_id && String(data.target_user_id) !== userId) {
                    // the server divided whoever is #1 NOW — if that is not the
                    // card we animated, reconcile so client and server agree.
                    setBids(prev => prev.map(b =>
                        b.userId === userId
                            ? { ...b, bidAmount: oldBid }
                            : String(b.userId) === String(data.target_user_id)
                                ? { ...b, bidAmount: Number(data.bidAmount) }
                                : b
                    ))
                    dispatch(showToast({ type: 'error', message: 'The #1 player changed mid-animation.' }))
                }
            } catch {
                setBids(previousBids)
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [auctionId, bids, dispatch])

    // Separately timed frames for the divide sequence. The fruit rests on your
    // card, flies to first position, covers it, then the reduction lands.
    const handleDivideSelf = useCallback(() => {
        if (divideTarget || divideStage !== 'idle' || multiplyTarget || stealStage !== 'idle') return
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        const rank1 = [...bids].sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
        if (!rank1) {
            dispatch(showToast({ type: 'error', message: 'No bids on this table yet.' }))
            return
        }

        const APP_MS = 800
        const TRAVEL_MS = 850
        // long enough to read the old amount strike through before it lifts away
        const SPLIT_MS = 700
        const IMPACT_MS = 950
        const SETTLE_MS = 300

        setDivideTarget(rank1.userId)
        setDivideStage('appear')

        const t1 = setTimeout(() => setDivideStage('travel'), APP_MS)
        divideTimeoutsRef.current.push(t1)
        const t2 = setTimeout(() => setDivideStage('covering'), APP_MS + TRAVEL_MS)
        divideTimeoutsRef.current.push(t2)
        const t3 = setTimeout(() => {
            handleDivideOptimistic(rank1.userId)
            setDivideStage('explode')
        }, APP_MS + TRAVEL_MS + SPLIT_MS)
        divideTimeoutsRef.current.push(t3)
        const t4 = setTimeout(() => setDivideStage('settle'), APP_MS + TRAVEL_MS + SPLIT_MS + IMPACT_MS)
        divideTimeoutsRef.current.push(t4)
        const t5 = setTimeout(() => {
            setDivideStage('idle')
            setDivideTarget(null)
            setDivideFlight(null)
        }, APP_MS + TRAVEL_MS + SPLIT_MS + IMPACT_MS + SETTLE_MS)
        divideTimeoutsRef.current.push(t5)
    }, [divideTarget, divideStage, myUserId, bids, handleDivideOptimistic, dispatch])

    // while the fruit is in flight, capture the source card (mine) and the #1
    // card positions so the page-level overlay can fly between them.
    useEffect(() => {
        if (divideStage !== 'travel') return
        const rectOf = (userId: string | null) =>
            userId
                ? document.querySelector<HTMLElement>(`[data-divide-card="${userId}"]`)?.getBoundingClientRect() ?? null
                : null
        const s = rectOf(myUserId)
        const t = rectOf(divideTarget)
        if (!t) return
        setDivideFlight({
            sx: s ? s.right - 8 : t.left + t.width / 2,
            sy: s ? s.top + s.height / 2 : t.top - 130,
            // land where the fruit comes to REST on the #1 card (right edge,
            // vertically centred) so the flight and the parked fruit are one move
            tx: t.right - 42,
            ty: t.top + t.height / 2,
        })
    }, [divideStage, myUserId, divideTarget])

    // BIG SIS REQUEST: Ability Fruit STEAL BIDDING CURRENCY.
    // Auto-targets every other player who holds any bidding currency, then
    // drains 1,000 BC per second from each for 60 seconds.
    const handleStealSelf = useCallback(() => {
        if (stealStage !== 'idle' || divideTarget || multiplyTarget) return
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        const myBidPresent = bids.some(b => b.userId === myUserId)
        if (!myBidPresent) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        const targets = bids.filter(b => b.userId !== myUserId && Number(b.bidAmount) > 0)
        if (targets.length === 0) {
            dispatch(showToast({ type: 'error', message: 'No one else on the table has bidding currency to take.' }))
            return
        }

        const basis = new Map<string, number>()
        targets.forEach(t => basis.set(String(t.userId), Number(t.bidAmount)))
        stealBasisRef.current = basis
        stealSnapshotRef.current = bids
        setStealTargets(targets.map(t => String(t.userId)))
        setStealLossByPlayer({})
        setStealGain(0)
        setStealSeconds(STEAL_FRUIT_DURATION_S)
        setStealStage('active')
    }, [stealStage, divideTarget, multiplyTarget, myUserId, bids, dispatch])

    // The 60s countdown: every second, each still-eligible target loses 1,000
    // BC. Anyone who runs out before zero loses their red border and badge. At
    // zero: commit the steal + explode + settle.
    const handleStealCommit = useCallback(() => {
        const myId = myUserIdRef.current
        if (!myId) return
        const basis = stealBasisRef.current
        const snapshot = stealSnapshotRef.current

        // Each target loses min(their starting balance, one full 60s drain).
        const lossByPlayer: Record<string, number> = {}
        let gain = 0
        basis.forEach((bid, id) => {
            const loss = Math.min(bid, STEAL_FRUIT_AMOUNT)
            if (loss > 0) {
                lossByPlayer[id] = loss
                gain += loss
            }
        })
        setStealLossByPlayer(lossByPlayer)
        setStealGain(gain)

        setBids(prev => prev.map(b => {
            if (b.userId === myId) return { ...b, bidAmount: Number(b.bidAmount) + gain }
            const base = basis.get(String(b.userId))
            if (base === undefined) return b
            return { ...b, bidAmount: Math.max(0, base - Math.min(base, STEAL_FRUIT_AMOUNT)) }
        }))

        void (async () => {
            try {
                const res = await fetch('/api/landwars/steal-bid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, perSecond: STEAL_PER_SECOND, seconds: STEAL_FRUIT_DURATION_S }),
                })
                const data = await res.json()
                if (!res.ok) {
                    setBids(snapshot)
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not steal the bidding currency.' }))
                }
            } catch {
                setBids(snapshot)
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [auctionId, dispatch])

    useEffect(() => {
        if (stealStage !== 'active') return
        let elapsed = 0
        stealCountdownRef.current = setInterval(() => {
            elapsed += 1
            const sec = elapsed
            const myId = myUserIdRef.current
            const basis = stealBasisRef.current

            // Drain step: recompute each target's balance from its starting
            // value so realtime refreshes can never clobber the countdown.
            setBids(prev => prev.map(b => {
                if (b.userId === myId) return b
                const base = basis.get(String(b.userId))
                if (base === undefined) return b
                return { ...b, bidAmount: Math.max(0, base - STEAL_PER_SECOND * sec) }
            }))
            // Remove the red border + badge of anyone who has fully run out.
            setStealTargets(prev => prev.filter(id => (basis.get(id) ?? 0) > STEAL_PER_SECOND * sec))

            setStealSeconds(STEAL_FRUIT_DURATION_S - sec)

            if (sec >= STEAL_FRUIT_DURATION_S) {
                if (stealCountdownRef.current) clearInterval(stealCountdownRef.current)
                stealCountdownRef.current = null
                handleStealCommit()
                // FRAME 4: slide (420ms) + explosion (~560ms, per design).
                setStealStage('explode')
                setTimeout(() => {
                    // FRAME 5 (+X for ~800ms) then FRAME 6 (aftermath deltas).
                    setStealStage('settle')
                    setTimeout(() => {
                        setStealStage('idle')
                        setStealTargets([])
                        setStealGain(0)
                        setStealLossByPlayer({})
                        stealBasisRef.current = new Map()
                        stealSnapshotRef.current = []
                    }, 2000)
                }, 1000)
            }
        }, 1000)
        return () => {
            if (stealCountdownRef.current) clearInterval(stealCountdownRef.current)
            stealCountdownRef.current = null
        }
    }, [stealStage, handleStealCommit])

    // Fire the armed fruit as soon as the table has loaded and we know who you
    // are. FRAME 1 (the plain leaderboard) is what you see for that instant.
    useEffect(() => {
        if (loading) return
        const armed = armedFruitRef.current
        if (!armed) return
        armedFruitRef.current = null
        if (armed === 'multiply') handleMultiplySelf()
        if (armed === 'divide') handleDivideSelf()
        if (armed === 'thief') handleStealSelf()
    }, [loading, handleMultiplySelf, handleDivideSelf, handleStealSelf])

    // BIG SIS REQUEST: ControlsModal save handler
    const handleControlsSave = useCallback((mode: typeof bidMode) => {
        setBidMode(mode)
        setSliderDragging(false)
        if (mode === 'voice') setVoiceKey(k => k + 1)
    }, [setBidMode])

    // BIG SIS REQUEST: slider drag handlers
    const getSliderPositionFromEvent = useCallback((e: React.PointerEvent | PointerEvent): number => {
        const track = sliderTrackRef.current
        if (!track) return 0
        const rect = track.getBoundingClientRect()
        const x = e.clientX - rect.left
        return Math.max(0, Math.min(100, (x / rect.width) * 100))
    }, [])

    // BIG SIS REQUEST: track pointer start Y for swipe-up detection
    const sliderDragStartYRef = useRef(0)

    const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
        if (quickBidding || bidding) return
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        sliderDragStartYRef.current = e.clientY
        const pos = getSliderPositionFromEvent(e)
        const val = getSliderValueFromPosition(pos)
        setSliderValue(val)
        setSliderDragging(true)
        setSliderCancelled(false)
    }, [quickBidding, bidding, getSliderPositionFromEvent, getSliderValueFromPosition])

    const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
        if (!sliderDragging) return
        const pos = getSliderPositionFromEvent(e)
        const val = getSliderValueFromPosition(pos)
        setSliderValue(val)
        // BIG SIS REQUEST: detect upward swipe → show "Release to cancel"
        const dy = sliderDragStartYRef.current - e.clientY
        setSliderCancelled(dy > 80)
    }, [sliderDragging, getSliderPositionFromEvent, getSliderValueFromPosition])

    // BIG SIS REQUEST: on release, swipe up cancels bid (like voice cancel), otherwise submit
    const handleSliderPointerUp = useCallback((e: React.PointerEvent) => {
        if (!sliderDragging) return
        setSliderDragging(false)
        const dy = sliderDragStartYRef.current - e.clientY
        if (dy > 80) {
            setSliderCancelled(false)
            dispatch(showToast({ type: 'success', message: 'Bid cancelled' }))
            return
        }
        setSliderCancelled(false)
        void handleQuickBid(sliderValue)
    }, [sliderDragging, sliderValue, handleQuickBid, dispatch])

    // BIG SIS REQUEST: bid controls footer always present → always use extended padding
    const bottomPadding = 'pb-[11rem]'

    return (
        <PageLayout
            pageTitle="Table"
            className={`px-4 bg-[#f5f5f5] ${bottomPadding}`}
            extraButton={
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base text-[#111827] whitespace-nowrap">
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
                            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors bg-gray-100 text-gray-600"
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

            {/* BIG SIS REQUEST: Controls modal */}
            <ControlsModal
                isActive={controlsModal}
                setIsActive={setControlsModal}
                currentMode={bidMode}
                onSave={handleControlsSave}
            />

            <BuyBiddingCurrencyModal isActive={buyModal} setIsActive={setBuyModal} />

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
                        // light red border on every target while it is being
                        // drained; disappears at the explode (timer hit zero)
                        // and for anyone who ran out mid-countdown.
                        const isStealLiveTarget =
                            stealStage === 'active' && stealTargets.includes(String(bid.userId))
                        return (
                            <div
                                key={bid.id}
                                data-divide-card={bid.userId}
                                data-steal-card={bid.userId}
                                data-steal-target={stealTargets.includes(String(bid.userId)) ? 'true' : undefined}
                                className={`bg-white rounded-3xl shadow-sm border transition-colors duration-300 ${
                                    isStealLiveTarget ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'
                                }`}
                            >
                                {/* BIG SIS REQUEST: each card wraps in the Steal + Multiply + Divide fruit overlays */}
                                <StealFruitAbility
                                    tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                    activatorId={myUserId}
                                    targetIds={stealTargets}
                                    stage={stealStage}
                                    secondsLeft={stealSeconds}
                                    playerId={bid.userId}
                                    stealAmount={STEAL_PER_SECOND}
                                    gain={stealGain}
                                    lossByPlayer={stealLossByPlayer}
                                >
                                    <DivideFruitAbility
                                        tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                        sourcePlayerId={myUserId}
                                        targetPlayerId={divideTarget}
                                        stage={divideStage}
                                        playerId={bid.userId}
                                        factor={DIVIDE_FACTOR}
                                    >
                                    <MultiplyFruitAbility
                                        tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                        targetPlayerId={multiplyTarget}
                                        playerId={bid.userId}
                                        factor={MULTIPLY_FACTOR}
                                        maxBidLimit={MAX_BID_LIMIT}
                                        onBidUpdated={handleMultiplyOptimistic}
                                        onComplete={handleMultiplyComplete}
                                    >
                                    <div className="flex items-start gap-4 p-6">
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
                                </MultiplyFruitAbility>
                                </DivideFruitAbility>
                                </StealFruitAbility>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* BIG SIS REQUEST: DIVIDE FRAME 2 — the status pill under the table:
                "÷N  Dividing <name>'s bid by N". Clears once the cut lands. */}
            <DivideStatusPill
                stage={divideStage}
                targetName={bids.find(b => b.userId === divideTarget)?.username}
                factor={DIVIDE_FACTOR}
            />

            {/* BIG SIS REQUEST: DIVIDE — the fruit flying from MY card to the
                holder of first position while the divide sequence is live. */}
            {divideStage === 'travel' && divideFlight && (
                <div className="pointer-events-none fixed inset-0 z-[70]">
                    {/* comet trail catching up behind the travelling fruit */}
                    {[1, 2, 3].map((i) => (
                        <motion.span
                            key={`trail-${i}`}
                            className="absolute left-0 top-0 rounded-full bg-violet-400"
                            style={{ width: 12 - i * 3, height: 12 - i * 3 }}
                            initial={{ x: divideFlight.sx - i * 18, y: divideFlight.sy - i * 18, opacity: 0.85 }}
                            animate={{ x: divideFlight.tx - i * 18, y: divideFlight.ty - i * 18, opacity: 0 }}
                            transition={{ duration: 0.85, ease: 'easeInOut', delay: (i - 1) * 0.06 }}
                        />
                    ))}

                    {/* the fruit itself — spins as it flies, ÷ badge riding along */}
                    <motion.div
                        className="absolute left-0 top-0"
                        initial={{ x: divideFlight.sx - 28, y: divideFlight.sy - 28, rotate: 0, scale: 0.5, opacity: 0 }}
                        animate={{ x: divideFlight.tx - 28, y: divideFlight.ty - 28, rotate: 540, scale: 1, opacity: [0, 1, 1, 1] }}
                        transition={{ duration: 0.85, ease: 'easeInOut', times: [0, 0.15, 0.8, 1] }}
                    >
                        <DivideFruitBadge size={56} factor={DIVIDE_FACTOR} />
                    </motion.div>
                </div>
            )}

            {/* Slider overlay — dims page, shows value + swipe text, submits on release, swipe up to cancel */}
            {sliderDragging && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50 pointer-events-none" />
                    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none">
                        <div className="bg-black/80 text-white text-5xl font-bold px-10 py-6 rounded-3xl">
                            B {sliderValue.toLocaleString()}
                        </div>
                        <p className={`mt-3 text-sm font-medium transition-colors ${
                            sliderCancelled ? 'text-red-400' : 'text-white/70'
                        }`}>
                            {sliderCancelled ? 'Release to cancel' : 'Swipe up to cancel'}
                        </p>
                    </div>
                </>
            )}

            {/* BIG SIS REQUEST: Increment buttons in footer (default mode) */}
            {bidMode === 'increment' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-4 py-4 flex justify-center items-center gap-3 max-w-md mx-auto">
                    {incrementAmounts.map((amount) => (
                        <button
                            key={amount}
                            onClick={() => void handleQuickBid(amount)}
                            disabled={quickBidding || bidding}
                            className={`flex-1 flex items-center justify-center gap-1 rounded-full border bg-transparent py-3.5 text-sm font-bold text-black active:bg-black active:text-white duration-100 disabled:opacity-60 ${
                                pressedIncrement === amount ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-200'
                            }`}
                        >
                            +{amount.toLocaleString()}
                        </button>
                    ))}
                </div>
            )}

            {/* BIG SIS REQUEST: Slider in footer */}
            {bidMode === 'slider' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-5 max-w-md mx-auto">
                    <div className="relative w-full">
                        <div
                            ref={sliderTrackRef}
                            className="relative w-full h-2 bg-gray-200 rounded-full cursor-pointer"
                            onPointerDown={handleSliderPointerDown}
                            onPointerMove={handleSliderPointerMove}
                            onPointerUp={handleSliderPointerUp}
                            style={{ touchAction: 'none' }}
                        >
                            <div
                                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                                style={{
                                    width: `${((sliderValue - sliderConfig.min) / (sliderConfig.max - sliderConfig.min)) * 100}%`,
                                }}
                            />
                            <div
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-6 bg-white border-2 border-blue-500 rounded-full shadow-md transition-none"
                                style={{
                                    left: `${((sliderValue - sliderConfig.min) / (sliderConfig.max - sliderConfig.min)) * 100}%`,
                                }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                            <span>10,000</span>
                            <span>500,000</span>
                        </div>
                    </div>
                </div>
            )}

            {/* BIG SIS REQUEST: Voice mode — only mic icon centered in footer, no background */}
            {bidMode === 'voice' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center items-center max-w-md mx-auto">
                    <VoiceBidButton
                        key={voiceKey}
                        onBid={handleVoiceBid}
                        onBuy={() => setBuyModal(true)}
                        onAbilityFruits={openAbilityFruits}
                        renderInline
                    />
                </div>
            )}
        </PageLayout>
    );
}

export default LeaderboardPage;
