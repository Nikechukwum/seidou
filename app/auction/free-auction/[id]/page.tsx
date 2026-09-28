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
import BidSlider from "@/components/BidSlider";
import MultiplyFruitAbility from "@/components/MultiplyFruitAbility";
import DivideFruitAbility, { DivideFruitBadge, DivideStatusPill } from "@/components/DivideFruitAbility";
import StealFruitAbility from "@/components/StealFruitAbility";
import SwapFruitAbility, { SwapFruitBadge, SwapStatusPill, SWAP_EASE_OUT, SWAP_BURST_MS } from "@/components/SwapFruitAbility";
import RestoreFruitAbility, {
    RestoreStatusPill,
    RestoreSummaryModal,
    RestoredFruit,
    RestoreStage,
    RESTORE_APPEAR_MS,
    RESTORE_BURST_MS,
    RESTORE_RESTORING_MIN_MS,
    RESTORE_COMPLETE_MS,
} from "@/components/RestoreFruitAbility";
import NegateFruitAbility, {
    NegateStatusPill,
    NegateStage,
    NEGATE_APPEAR_MS,
    NEGATE_SLIDE_MS,
    NEGATE_BURST_MS,
    NEGATE_RESTORED_MS,
} from "@/components/NegateFruitAbility";
import FreezeFruitAbility, { FreezeStatusPill, FreezePulseOverlay } from "@/components/FreezeFruitAbility";
import AdaptiveLeaderboard from "@/components/AdaptiveLeaderboard";
import { MULTIPLY_FACTOR, DIVIDE_FACTOR, STEAL_PER_SECOND, STEAL_FRUIT_AMOUNT, STEAL_FRUIT_DURATION_S, FREEZE_FRUIT_DURATION_S, FREEZE_PULSE_MS, FREEZE_FADE_MS, getAbilityFruit, negateEffectLabel, AbilityFruitId } from "@/lib/abilityFruits";
import { getFruitUsage, recordFruitUse, clearFruitUsage } from "@/lib/fruitUsage";
import {
    AbilityInteraction,
    InteractionFeed,
    FEED_POLL_MS,
    effectLabel,
    effectShortLabel,
    feedClockOffsetMs,
    iBlockedMe,
    iReflectedMe,
    iWasAffected,
    windowRemainingSeconds,
} from "@/lib/abilityInteractions";
import AbilityManifestOverlay from "@/components/AbilityManifestOverlay";
import TargetTelegraphOverlay from "@/components/TargetTelegraphOverlay";
import ReactFruitPicker from "@/components/ReactFruitPicker";
import { AnimatePresence, motion } from "motion/react";
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

//  "Increase Bid" renamed to "Controls"
//  "Increase Bid" renamed to "Controls"
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

    //  bid controls (increment / slider / voice)
    const { bidMode, setBidMode, incrementAmounts, sliderConfig } = useBidControls()


    //  voice mode key — forces VoiceBidButton remount when switching to voice
    const [voiceKey, setVoiceKey] = useState(0)

    //  Ability Fruit MULTIPLY state. The factor comes from the
    // fruit's level (everyone is level 1 -> x2 for now), so there is nothing to
    // pick — Activate fires straight away.
    const [multiplyTarget, setMultiplyTarget] = useState<string | null>(null)
    // One activation = exactly one multiply. Guards against the animation
    // firing onBidUpdated a second time (e.g. the card remounting after the
    // multiplied bid climbs the table).
    const multiplyAppliedRef = useRef(false)

    //  Ability Fruit DIVIDE state. The fruit appears on YOUR
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
        // clear any in-flight swap timers when the page unmounts
        swapTimeoutsRef.current.forEach(clearTimeout)
        swapTimeoutsRef.current = []
        // clear any in-flight restore timers when the page unmounts
        restoreTimeoutsRef.current.forEach(clearTimeout)
        restoreTimeoutsRef.current = []
        // clear any in-flight negate timers when the page unmounts
        negateTimeoutsRef.current.forEach(clearTimeout)
        negateTimeoutsRef.current = []
        // clear any in-flight freeze timers when the page unmounts
        freezeTimeoutsRef.current.forEach(clearTimeout)
        freezeTimeoutsRef.current = []
        if (freezeCountdownRef.current) clearInterval(freezeCountdownRef.current)
        freezeCountdownRef.current = null
    }, [])

    //  Ability Fruit STEAL BIDDING CURRENCY state. Auto-targets
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

    //  Ability Fruit POSITION SWAP state. Auto-targets the
    // highest bidder, swaps the two bid amounts, plays the 5-frame animation.
    type SwapStage = 'idle' | 'active' | 'travel' | 'explode' | 'settle'
    const [swapStage, setSwapStage] = useState<SwapStage>('idle')
    const [swapTargetId, setSwapTargetId] = useState<string | null>(null)
    const [swapFlight, setSwapFlight] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
    // Places GAINED per user in the settled frame: +1 renders the green
    // "↑ 1", -1 the red "↓ 1".
    const [swapDeltas, setSwapDeltas] = useState<Record<string, number>>({})
    const swapTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

    //  Ability Fruit RESTORE state. Gives the activator back
    // what THEY used on this table — the ability fruits they spent and the
    // bidding currency they committed — and plays the sheet's six frames:
    // appear → explode → restoring... → summary (Continue) → complete.
    const [restoreStage, setRestoreStage] = useState<RestoreStage>('idle')
    const [restoreRefund, setRestoreRefund] = useState(0)
    // The ability fruits coming back, with their counts — the top half of the
    // FRAME 5 summary. Read from the per-auction usage ledger (lib/fruitUsage).
    const [restoreFruits, setRestoreFruits] = useState<RestoredFruit[]>([])
    const restoreTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

    //  Ability Fruit NEGATE state. Cancels the most recent
    // effect that hit ME and puts my bid back to what it was before it landed.
    // The effect history lives server-side (public.bid_effects), so the page
    // PEEKS at the top of the stack before it plays a single frame — the sheet
    // says activation must be prevented when there is no recent effect.
    const [negateStage, setNegateStage] = useState<NegateStage>('idle')
    // What the bid goes back to, and the human name of the effect being undone
    // ("Divide", "Position Swap") for the caption pill — both from the peek.
    const [negateRestoreTo, setNegateRestoreTo] = useState(0)
    const [negateLabel, setNegateLabel] = useState<string | null>(null)
    const negateTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
    // One activation at a time: the peek is async, so the guard has to hold
    // from the tap, not from the first frame.
    const negateBusyRef = useRef(false)

    //  Ability Fruit FREEZE state. Freezes every OTHER player on the
    // table for 30s: they cannot change their bid or use a fruit (enforced
    // server-side), the activator still can, and a frozen player holding a
    // Negate can negate the freeze off themselves. The activator's client runs
    // the whole 30s sequence below; every client ALSO polls freeze-status so a
    // player frozen by someone else still shows their blue border and gets the
    // "you are currently frozen" popup instead of a failed activation.
    type FreezeStage = 'idle' | 'pulse' | 'active' | 'fade'
    const [freezeStage, setFreezeStage] = useState<FreezeStage>('idle')
    const [freezeSeconds, setFreezeSeconds] = useState(FREEZE_FRUIT_DURATION_S)
    const [freezeTargets, setFreezeTargets] = useState<string[]>([])
    // FREEZE FRAME 3: the radial wave is table-wide, so the page measures the
    // activator's card (the origin) and the distance to the furthest corner of
    // the table (the reach) and hands both to <FreezePulseOverlay />.
    const [freezePulse, setFreezePulse] = useState<{ origin: { x: number; y: number }; reach: number } | null>(null)
    const freezeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const freezeCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Am I (on THIS client) frozen by someone else's Freeze Fruit right now?
    const [myFreeze, setMyFreeze] = useState<{ frozen: boolean; remaining: number }>({ frozen: false, remaining: 0 })
    const [freezePopupOpen, setFreezePopupOpen] = useState(false)

    //  Ability Fruit INTERACTION SYSTEM — the reaction-window feed.
    // Every client polls it (~1s); the GET runs the server sweep first, so
    // what comes back is post-resolution truth. Pending entries drive the
    // manifest overlay + spidey-sense rings + React picker; resolved entries
    // drive the impact bursts below. All SQL timestamps are compared in SERVER
    // time: feedOffsetMs is the measured clock skew, added to Date.now().
    const [interactionFeed, setInteractionFeed] = useState<InteractionFeed | null>(null)
    const [feedOffsetMs, setFeedOffsetMs] = useState(0)
    // The pending interaction currently targeting ME (drives the React picker).
    const [reactTarget, setReactTarget] = useState<AbilityInteraction | null>(null)
    const [reactCooldowns, setReactCooldowns] = useState<Partial<Record<'shield' | 'mirror', number>>>({})
    const [responding, setResponding] = useState(false)
    // interaction id -> state last seen, so a resolution fires once.
    const seenInteractionsRef = useRef<Map<number, string>>(new Map())
    // the interaction my current steal countdown collects on commit.
    const stealInteractionIdRef = useRef<number | null>(null)

    const openFreezePopup = useCallback(() => setFreezePopupOpen(true), [])

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

    //  Poll freeze-status (~2s) so a player frozen by SOMEONE ELSE learns
    //  about it without a realtime channel on bid_effects: their own card
    //  wears the blue border, and fruit / bid attempts open the "you are
    //  currently frozen" popup instead of failing silently on the server.
    useEffect(() => {
        let cancelled = false
        let poll: ReturnType<typeof setTimeout>
        const check = async () => {
            try {
                const res = await fetch(`/api/landwars/freeze-bid?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (!cancelled && res.ok) {
                    setMyFreeze({ frozen: !!data?.frozen, remaining: Number(data?.remaining_seconds ?? 0) })
                }
            } catch {
                // keep the last known state — a failed poll must never block the table
            }
        }
        void check()
        poll = setTimeout(function tick() {
            void check()
            poll = setTimeout(tick, 2000)
        }, 2000)
        return () => {
            cancelled = true
            clearTimeout(poll)
        }
    }, [auctionId])

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

        if (myFreeze.frozen) {
            dispatch(showToast({ type: 'error', message: `You are currently frozen — wait ${Math.max(1, Math.ceil(myFreeze.remaining))}s for the Freeze Fruit to wear off.` }))
            return
        }

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

        if (myFreeze.frozen) {
            dispatch(showToast({ type: 'error', message: `You are currently frozen — wait ${Math.max(1, Math.ceil(myFreeze.remaining))}s for the Freeze Fruit to wear off.` }))
            return
        }

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
        if (myFreeze.frozen) {
            dispatch(showToast({ type: 'error', message: `You are currently frozen — wait ${Math.max(1, Math.ceil(myFreeze.remaining))}s for the Freeze Fruit to wear off.` }))
            return false
        }
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
    }, [quickBidding, myFreeze.frozen, user, bids, auctionId, dispatch, fetchProfileBalance, fireDelta])

    //  the Ability Fruits tab opens the Ability Fruits page
    // first — the player picks a fruit there, then comes back here to target.
    const openAbilityFruits = useCallback(() => {
        router.push(`/auction/free-auction/${auctionId}/ability-fruits`)
    }, [router, auctionId])

    //  Controls tab opens ControlsModal
    const handleTabClick = (tab: TabKey) => {
        if (tab === 'fruits') {
            openAbilityFruits()
            return
        }
        if (tab === 'buy') setBuyModal(true)
        if (tab === 'controls') setControlsModal(true)
    }

    //  tapping Activate on the Ability Fruits page sends the
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

    //  Ability Fruit MULTIPLY — optimistic update at FRAME 4 + server commit
    const handleMultiplyOptimistic = useCallback((id: number | string, newBid: number) => {
        if (multiplyAppliedRef.current) return
        multiplyAppliedRef.current = true
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
        if (multiplyTarget || stealStage !== 'idle' || swapStage !== 'idle' || restoreStage !== 'idle' || negateStage !== 'idle' || freezeStage !== 'idle') return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
        if (!myUserId || !myBid) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        recordFruitUse(auctionId, 'multiply')
        multiplyAppliedRef.current = false
        setMultiplyTarget(myUserId)
    }, [multiplyTarget, myUserId, myBid, dispatch, stealStage, swapStage, restoreStage, negateStage, freezeStage, myFreeze.frozen])

    // FRAME 5 (settled): the overlay is gone — float "+X,XXX,XXX ↑" next to the
    // target's new bid, the same green delta a normal bid raise shows.
    const handleMultiplyComplete = useCallback((id: number | string, delta: number) => {
        setMultiplyTarget(null)
        if (delta > 0) fireDelta(String(id), delta)
    }, [fireDelta])

    //  Ability Fruit DIVIDE — interaction system. The fruit is CAST through
    // the interaction RPC: it parks a 5s reaction window during which the #1
    // player (the derived target) can Shield/Mirror, then the server sweep
    // applies the cut. Nothing is mutated here — the impact burst plays on the
    // card once the feed reports the outcome (see the resolution effect below).
    const handleDivideSelf = useCallback(() => {
        if (divideTarget || divideStage !== 'idle' || multiplyTarget || stealStage !== 'idle' || swapStage !== 'idle' || restoreStage !== 'idle' || negateStage !== 'idle' || freezeStage !== 'idle') return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        if (!bids.some(b => b.userId === myUserId)) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        if ((interactionFeed?.interactions ?? []).some(i => i.state === 'pending' && i.actor_is_me)) {
            dispatch(showToast({ type: 'error', message: 'You already have an ability fruit in flight on this table.' }))
            return
        }
        const rank1 = [...bids].sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
        if (!rank1) {
            dispatch(showToast({ type: 'error', message: 'No bids on this table yet.' }))
            return
        }

        recordFruitUse(auctionId, 'divide')
        void (async () => {
            try {
                const res = await fetch('/api/landwars/ability-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, action: 'cast', effectType: 'divide', factor: DIVIDE_FACTOR }),
                })
                const data = await res.json()
                if (!res.ok) {
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not cast the Divide Fruit.' }))
                }
            } catch {
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [divideTarget, divideStage, multiplyTarget, stealStage, swapStage, restoreStage, negateStage, freezeStage, myFreeze.frozen, myUserId, bids, interactionFeed, auctionId, dispatch])

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

    //  Ability Fruit STEAL BIDDING CURRENCY — interaction system. Cast through
    // the interaction RPC: every other player is telegraphed for a 5s reaction
    // window (Shield/Mirror save per-target), the sweep resolves eligibility,
    // and the drain spectacle + commit run only once the outcome is 'ready'.
    const handleStealSelf = useCallback(() => {
        if (stealStage !== 'idle' || divideTarget || multiplyTarget || swapStage !== 'idle' || restoreStage !== 'idle' || negateStage !== 'idle' || freezeStage !== 'idle') return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
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
        if ((interactionFeed?.interactions ?? []).some(i => i.state === 'pending' && i.actor_is_me)) {
            dispatch(showToast({ type: 'error', message: 'You already have an ability fruit in flight on this table.' }))
            return
        }

        recordFruitUse(auctionId, 'thief')
        void (async () => {
            try {
                const res = await fetch('/api/landwars/ability-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, action: 'cast', effectType: 'thief' }),
                })
                const data = await res.json()
                if (!res.ok) {
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not cast the Steal.' }))
                }
            } catch {
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [stealStage, divideTarget, multiplyTarget, swapStage, restoreStage, negateStage, freezeStage, myFreeze.frozen, myUserId, bids, interactionFeed, auctionId, dispatch])

    // The 60s countdown: every second, each still-eligible target loses 1,000
    // BC. Anyone who runs out before zero loses their red border and badge. At
    // zero: commit the steal + explode + settle.
    const handleStealCommit = useCallback(() => {
        const myId = myUserIdRef.current
        const interactionId = stealInteractionIdRef.current
        if (!myId || !interactionId) return
        const basis = stealBasisRef.current
        const snapshot = stealSnapshotRef.current

        // Each target loses min(their starting balance, one full 30s drain).
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
                    body: JSON.stringify({ auctionId, interactionId, perSecond: STEAL_PER_SECOND, seconds: STEAL_FRUIT_DURATION_S }),
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

    //  Ability Fruit POSITION SWAP — interaction system. Cast through the
    // interaction RPC: the fruit locks onto the #1 player and parks a 5s
    // reaction window (they can Shield/Mirror), then the server sweep trades
    // the two bids. The burst plays once the feed reports the outcome.
    const handleSwapSelf = useCallback(() => {
        if (swapStage !== 'idle' || stealStage !== 'idle' || divideTarget || multiplyTarget || restoreStage !== 'idle' || negateStage !== 'idle' || freezeStage !== 'idle') return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        const myBidEntry = bids.find(b => String(b.userId) === myUserId)
        if (!myBidEntry) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        if ((interactionFeed?.interactions ?? []).some(i => i.state === 'pending' && i.actor_is_me)) {
            dispatch(showToast({ type: 'error', message: 'You already have an ability fruit in flight on this table.' }))
            return
        }
        const ranked = [...bids].sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))
        const leader = ranked[0]
        if (!leader) {
            dispatch(showToast({ type: 'error', message: 'No bids on this table yet.' }))
            return
        }
        const myAmount = Number(myBidEntry.bidAmount)
        const leaderAmount = Number(leader.bidAmount)
        if (String(leader.userId) === myUserId || leaderAmount === myAmount) {
            dispatch(showToast({ type: 'error', message: "You're already in first position — there's nothing to swap for." }))
            return
        }

        recordFruitUse(auctionId, 'swap')
        void (async () => {
            try {
                const res = await fetch('/api/landwars/ability-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, action: 'cast', effectType: 'swap' }),
                })
                const data = await res.json()
                if (!res.ok) {
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not cast the Position Swap.' }))
                }
            } catch {
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [swapStage, stealStage, divideTarget, multiplyTarget, myUserId, bids, interactionFeed, restoreStage, negateStage, freezeStage, myFreeze.frozen, auctionId, dispatch])

    // while the fruit is in flight, capture the source card (mine) and the
    // leader's card positions so the page-level overlay can fly between them.
    useEffect(() => {
        if (swapStage !== 'travel' || !swapTargetId) return
        const rectOf = (userId: string | null) =>
            userId
                ? document.querySelector<HTMLElement>(`[data-swap-card="${userId}"]`)?.getBoundingClientRect() ?? null
                : null
        const s = rectOf(myUserId)
        const t = rectOf(swapTargetId)
        if (!s || !t) return
        setSwapFlight({
            // FRAME 3 starts exactly where FRAME 2 left the fruit: the RIGHT
            // side of the activator's own card, vertically centered.
            sx: s.right - 25,
            sy: s.top + s.height / 2,
            // ...and lands on the middle of the leader's card, which is where
            // the FRAME 4 burst is centred, so flight + explosion read as one
            // continuous move.
            tx: t.left + t.width / 2,
            ty: t.top + t.height / 2,
        })
    }, [swapStage, swapTargetId, myUserId])

    //  Ability Fruit RESTORE — the commit. This runs UNDER
    // FRAME 4 ("Restoring... your resources are being restored in the
    // background"), and that frame is held until the server has actually paid
    // the stake back. Nothing is shown as restored before it lands: on a
    // failure the sequence is dropped and the table is left exactly as it was.
    const commitRestore = useCallback(async (refund: number) => {
        const startedAt = Date.now()
        // FRAME 4 has to be readable even when the server answers instantly.
        const holdRestoringFrame = async () => {
            const elapsed = Date.now() - startedAt
            if (elapsed < RESTORE_RESTORING_MIN_MS) {
                await new Promise(resolve => setTimeout(resolve, RESTORE_RESTORING_MIN_MS - elapsed))
            }
        }
        const abandon = (message: string) => {
            dispatch(showToast({ type: 'error', message }))
            setRestoreStage('idle')
            setRestoreRefund(0)
            setRestoreFruits([])
        }

        try {
            const res = await fetch('/api/landwars/restore-bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auctionId }),
            })
            const data = await res.json()
            await holdRestoringFrame()

            if (!res.ok) {
                abandon(data.error || 'Could not restore your resources.')
                return
            }

            // My stake comes off the table and lands back in my wallet. No other
            // row is touched — restore is not an attack.
            const refunded = Number(data?.refunded ?? refund)
            setBids(prev => prev.map(b =>
                String(b.userId) === myUserId ? { ...b, bidAmount: Number(data?.bidAmount ?? 0) } : b
            ))
            if (Number.isFinite(Number(data?.bidding_balance))) {
                dispatch(PartialUpdateUser({ bidding_balance: Number(data.bidding_balance) }))
            }
            // The used fruits go back into the inventory. The Restore fruit is
            // only counted as eaten now that the restore has actually landed —
            // a failed commit must not cost the player a fruit — and it never
            // restores itself.
            clearFruitUsage(auctionId, { restore: (getFruitUsage(auctionId).restore ?? 0) + 1 })
            setRestoreRefund(refunded)
            setRestoreStage('summary')
        } catch {
            await holdRestoringFrame()
            abandon('Something went wrong. Please try again.')
        }
    }, [auctionId, myUserId, dispatch])

    // FRAMES 2-4: the fruit appears on the right of my card (appear) → it
    // explodes there (explode) → "Restoring..." holds while the commit runs.
    // FRAME 5 (the summary) and FRAME 6 (complete) are driven by commitRestore
    // and by Continue, because the sheet dismisses the summary by hand.
    const handleRestoreSelf = useCallback(() => {
        if (restoreStage !== 'idle' || stealStage !== 'idle' || swapStage !== 'idle' || divideTarget || multiplyTarget || negateStage !== 'idle' || freezeStage !== 'idle') return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }

        // What there is to give back: the fruits used on this table so far, and
        // the bidding currency committed to it. Both come from what the player
        // actually SPENT — never from their current wallet balance.
        const usage = getFruitUsage(auctionId)
        const usedFruits = (Object.entries(usage) as [AbilityFruitId, number][])
            .filter(([id, count]) => id !== 'restore' && count > 0)
            .map(([id, count]): RestoredFruit | null => {
                const fruit = getAbilityFruit(id)
                return fruit ? { id, name: fruit.name, image: fruit.image, count } : null
            })
            .filter((f): f is RestoredFruit => f !== null)
        const spent = Number(bids.find(b => String(b.userId) === myUserId)?.bidAmount ?? 0)

        // DEV NOTE (design): "Restore cannot be used if there is nothing to
        // restore" — no fruits used AND nothing staked on this table.
        if (spent <= 0 && usedFruits.length === 0) {
            dispatch(showToast({ type: 'error', message: 'No resources to restore.' }))
            return
        }

        setRestoreFruits(usedFruits)
        setRestoreRefund(spent)

        // schedule helper — tracked so the cleanup effect can cancel the frames
        const at = (fn: () => void, ms: number) => {
            const t = setTimeout(fn, ms)
            restoreTimeoutsRef.current.push(t)
        }

        setRestoreStage('appear')
        at(() => setRestoreStage('explode'), RESTORE_APPEAR_MS)
        at(() => {
            setRestoreStage('restoring')
            void commitRestore(spent)
        }, RESTORE_APPEAR_MS + RESTORE_BURST_MS)
    }, [restoreStage, stealStage, swapStage, divideTarget, multiplyTarget, myUserId, bids, auctionId, commitRestore, dispatch, negateStage, freezeStage, myFreeze.frozen])

    // FRAME 6 — Continue on the summary: the green "restored" marker rides the
    // card for a beat, then the sequence is done.
    const handleRestoreContinue = useCallback(() => {
        setRestoreStage('complete')
        const t = setTimeout(() => {
            setRestoreStage('idle')
            setRestoreRefund(0)
            setRestoreFruits([])
        }, RESTORE_COMPLETE_MS)
        restoreTimeoutsRef.current.push(t)
    }, [])

    //  Ability Fruit NEGATE — "cancels any effect another
    // player's ability fruit had on you and restores your bid amount to what
    // it was before". The commit runs UNDER the explosion frame, so the number
    // that comes out of the burst is already the restored one. On a failure
    // the table is put back exactly as it was.
    const commitNegate = useCallback((restoreTo: number) => {
        const previousBids = bids
        setBids(prev => prev.map(b =>
            String(b.userId) === myUserId ? { ...b, bidAmount: restoreTo } : b
        ))

        void (async () => {
            try {
                const res = await fetch('/api/landwars/negate-bid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId }),
                })
                const data = await res.json()
                if (!res.ok) {
                    setBids(previousBids)
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not negate the effect.' }))
                    return
                }
                // The stack may have moved between the peek and the commit (the
                // effect is popped inside the transaction), so the server's
                // amount wins over the one the animation counted to.
                const settled = Number(data?.bidAmount)
                if (Number.isFinite(settled)) {
                    setBids(prev => prev.map(b =>
                        String(b.userId) === myUserId ? { ...b, bidAmount: settled } : b
                    ))
                    setNegateRestoreTo(settled)
                }
            } catch {
                setBids(previousBids)
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [auctionId, bids, myUserId, dispatch])

    // FRAMES 5-7. The peek comes FIRST: "prevent Negate activation if no recent
    // effect exists", and the same call reports the cooldown and hands back the
    // amount the bid is going back to. Only once that passes is a frame played
    // or a fruit counted as eaten.
    const handleNegateSelf = useCallback(async () => {
        if (negateBusyRef.current) return
        if (negateStage !== 'idle' || restoreStage !== 'idle' || stealStage !== 'idle' || swapStage !== 'idle' || divideTarget || multiplyTarget || freezeStage !== 'idle') return
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        if (!bids.some(b => String(b.userId) === myUserId)) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }

        negateBusyRef.current = true
        const abort = (message: string) => {
            negateBusyRef.current = false
            dispatch(showToast({ type: 'error', message }))
        }

        let peek: {
            has_effect?: boolean
            cooldown_remaining?: number
            effect_type?: string
            restored_bid?: number
            error?: string
        }
        try {
            const res = await fetch(`/api/landwars/negate-bid?auctionId=${encodeURIComponent(auctionId)}`)
            peek = await res.json()
            if (!res.ok) {
                abort(peek?.error || 'Could not read your effect history.')
                return
            }
        } catch {
            abort('Something went wrong. Please try again.')
            return
        }

        // "Negate Fruit has a cooldown (e.g., 15-20s)."
        const cooling = Number(peek?.cooldown_remaining ?? 0)
        if (cooling > 0) {
            abort(`Negate Fruit is still cooling down — ${Math.ceil(cooling)}s left.`)
            return
        }
        // "Prevent Negate activation if no recent effect exists."
        if (!peek?.has_effect) {
            abort('Nothing has been used on you yet — there is no effect to negate.')
            return
        }

        recordFruitUse(auctionId, 'negate')
        const restoreTo = Number(peek.restored_bid ?? 0)
        setNegateRestoreTo(restoreTo)
        setNegateLabel(negateEffectLabel(peek.effect_type))

        // schedule helper — tracked so the cleanup effect can cancel the frames
        const at = (fn: () => void, ms: number) => {
            const t = setTimeout(fn, ms)
            negateTimeoutsRef.current.push(t)
        }

        const SLIDE_AT = NEGATE_APPEAR_MS
        const BURST_AT = SLIDE_AT + NEGATE_SLIDE_MS
        const RESTORED_AT = BURST_AT + NEGATE_BURST_MS

        setNegateStage('appear')
        at(() => setNegateStage('covering'), SLIDE_AT)
        at(() => {
            setNegateStage('explode')
            commitNegate(restoreTo)
        }, BURST_AT)
        at(() => setNegateStage('restored'), RESTORED_AT)
        at(() => {
            setNegateStage('idle')
            setNegateRestoreTo(0)
            setNegateLabel(null)
            negateBusyRef.current = false
        }, RESTORED_AT + NEGATE_RESTORED_MS)
    }, [negateStage, restoreStage, stealStage, swapStage, divideTarget, multiplyTarget, myUserId, bids, auctionId, commitNegate, dispatch, freezeStage])

    //  Ability Fruit FREEZE. Freezes every OTHER player on the table
    // for FREEZE_FRUIT_DURATION_S (30s). Stage machine: pulse (~400ms) ->
    // active (30s countdown) -> fade (~FREEZE_FADE_MS) -> idle. The server
    // lock is committed at activation so everyone is blocked from second 0;
    // the countdown is what the activator watches on their own card.
    const handleFreezeSelf = useCallback(() => {
        if (freezeStage !== 'idle' || stealStage !== 'idle' || swapStage !== 'idle' || restoreStage !== 'idle' || negateStage !== 'idle' || divideTarget || multiplyTarget) return
        if (myFreeze.frozen) {
            setFreezePopupOpen(true)
            return
        }
        if (!myUserId) {
            dispatch(showToast({ type: 'error', message: 'Sign in to use a fruit.' }))
            return
        }
        if (!bids.some(b => b.userId === myUserId)) {
            dispatch(showToast({ type: 'error', message: 'Place a bid on this table first.' }))
            return
        }
        const targets = bids.filter(b => b.userId !== myUserId).map(b => String(b.userId))
        if (targets.length === 0) {
            dispatch(showToast({ type: 'error', message: 'No other players on this table to freeze.' }))
            return
        }
        if ((interactionFeed?.interactions ?? []).some(i => i.state === 'pending' && i.actor_is_me)) {
            dispatch(showToast({ type: 'error', message: 'You already have an ability fruit in flight on this table.' }))
            return
        }

        recordFruitUse(auctionId, 'freeze')
        void (async () => {
            try {
                const res = await fetch('/api/landwars/ability-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, action: 'cast', effectType: 'freeze' }),
                })
                const data = await res.json()
                if (!res.ok) {
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not cast the Freeze.' }))
                }
            } catch {
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            }
        })()
    }, [freezeStage, stealStage, swapStage, restoreStage, negateStage, divideTarget, multiplyTarget, myFreeze.frozen, myUserId, bids, interactionFeed, auctionId, dispatch])

    // FREEZE FRAME 3: measure the radial wave once the pulse stage opens. The
    // origin is the activator's own card (where the fruit sits) and the reach
    // is the distance to the furthest corner of the viewport, so the wave is
    // guaranteed to wash over EVERY other card the way the sheet draws it.
    useEffect(() => {
        if (freezeStage !== 'pulse') {
            setFreezePulse(null)
            return
        }
        const card = myUserId
            ? document.querySelector<HTMLElement>(`[data-freeze-card="${myUserId}"]`)
            : null
        const rect = card?.getBoundingClientRect()
        const origin = rect
            ? { x: rect.right - 28, y: rect.top + rect.height / 2 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        const reach = Math.hypot(
            Math.max(origin.x, window.innerWidth - origin.x),
            Math.max(origin.y, window.innerHeight - origin.y),
        )
        setFreezePulse({ origin, reach })
    }, [freezeStage, myUserId])

    //  The 30s countdown: at 0 the freeze ends — the blue borders fade
    //  (FRAME 6) and the sequence resets back to a plain table (FRAME 7).
    useEffect(() => {
        if (freezeStage !== 'active') return
        let elapsed = 0
        freezeCountdownRef.current = setInterval(() => {
            elapsed += 1
            setFreezeSeconds(FREEZE_FRUIT_DURATION_S - elapsed)
            if (elapsed >= FREEZE_FRUIT_DURATION_S) {
                if (freezeCountdownRef.current) clearInterval(freezeCountdownRef.current)
                freezeCountdownRef.current = null
                setFreezeStage('fade')
                const t = setTimeout(() => {
                    setFreezeStage('idle')
                    setFreezeTargets([])
                }, FREEZE_FADE_MS)
                freezeTimeoutsRef.current.push(t)
            }
        }, 1000)
        return () => {
            if (freezeCountdownRef.current) clearInterval(freezeCountdownRef.current)
            freezeCountdownRef.current = null
        }
    }, [freezeStage])

    // Fire the armed fruit as soon as the table has loaded and we know who you
    // are. FRAME 1 (the plain leaderboard) is what you see for that instant.
    //
    // A frozen player is stopped HERE, before any frame plays: the armed fruit
    // is checked against the live freeze status first (the local poll can lag
    // by ~2s), so a frozen player who tapped Activate gets the "you are
    // currently frozen" popup instead of a multiply/divide/... animation that
    // the server would just revert. The Negate Fruit is the exempted fruit.
    useEffect(() => {
        if (loading) return
        const armed = armedFruitRef.current
        if (!armed) return
        armedFruitRef.current = null
        if (armed === 'negate') {
            void handleNegateSelf()
            return
        }
        void (async () => {
            try {
                const res = await fetch(`/api/landwars/freeze-bid?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (res.ok && data?.frozen) {
                    setMyFreeze({ frozen: true, remaining: Number(data?.remaining_seconds ?? 0) })
                    setFreezePopupOpen(true)
                    return
                }
            } catch {
                // fall through to the handler — its own server commit still refuses
            }
            // COOLDOWN: the same fruit cannot fire twice within 20s. Stopped
            // HERE (before any frame) so a player never watches a fruit explode
            // only for the server to refuse and revert it.
            try {
                const coolRes = await fetch(`/api/landwars/fruit-cooldown?auctionId=${encodeURIComponent(auctionId)}`)
                const coolData = await coolRes.json()
                const remaining = Number(coolData?.cooldowns?.[armed] ?? 0)
                if (coolRes.ok && remaining > 0) {
                    dispatch(showToast({
                        type: 'error',
                        message: `${getAbilityFruit(armed)?.name ?? 'This fruit'} is still cooling down — ${remaining} more second${remaining === 1 ? '' : 's'}.`,
                    }))
                    return
                }
            } catch {
                // fall through — the fruit RPC's own cooldown guard still refuses
            }
            if (armed === 'multiply') handleMultiplySelf()
            if (armed === 'divide') handleDivideSelf()
            if (armed === 'thief') handleStealSelf()
            if (armed === 'swap') handleSwapSelf()
            if (armed === 'restore') handleRestoreSelf()
            if (armed === 'freeze') handleFreezeSelf()
        })()
    }, [loading, auctionId, handleMultiplySelf, handleDivideSelf, handleStealSelf, handleSwapSelf, handleRestoreSelf, handleFreezeSelf])

    //  ─────────────────────────────────────────────────────────────────────────
    //  INTERACTION SYSTEM — feed, react target, impact bursts, and respond.
    //  ─────────────────────────────────────────────────────────────────────────

    // The one pending interaction currently targeting ME → opens the React
    // picker and pre-fetches our Shield/Mirror cooldowns.
    const reactableTarget = useMemo(
        () => (interactionFeed?.interactions ?? []).find(i => i.state === 'pending' && i.is_targeting_me) ?? null,
        [interactionFeed]
    )
    useEffect(() => {
        setReactTarget(reactableTarget)
        if (!reactableTarget) return
        void (async () => {
            try {
                const res = await fetch(`/api/landwars/fruit-cooldown?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                const c = data?.cooldowns ?? {}
                setReactCooldowns({ shield: Number(c.shield ?? 0), mirror: Number(c.mirror ?? 0) })
            } catch {
                // keep the last known cooldowns
            }
        })()
    }, [reactableTarget, auctionId])

    // Poll the feed every ~1s. The GET already runs the server sweep first, so
    // each response is post-resolution truth; a failed poll keeps the last feed.
    useEffect(() => {
        if (loading) return
        let cancelled = false
        let timer: ReturnType<typeof setTimeout>
        const check = async () => {
            try {
                const res = await fetch(`/api/landwars/ability-interactions?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (cancelled || !res.ok) return
                setFeedOffsetMs(feedClockOffsetMs(data) ?? 0)
                setInteractionFeed(data)
            } catch {
                // keep last known feed
            }
            timer = setTimeout(check, FEED_POLL_MS)
        }
        void check()
        return () => { cancelled = true; clearTimeout(timer) }
    }, [auctionId, loading])

    // All SQL timestamps live in server time; this is "now-ish" in that clock.
    const serverNowMs = Date.now() + feedOffsetMs

    const pendingInteractions = useMemo(
        () => (interactionFeed?.interactions ?? []).filter(i => i.state === 'pending'),
        [interactionFeed]
    )
    const myPending = useMemo(
        () => (interactionFeed?.interactions ?? []).find(i => i.state === 'pending' && i.actor_is_me) ?? null,
        [interactionFeed]
    )
    const myPendingSeconds = myPending ? windowRemainingSeconds(myPending, serverNowMs) : 0

    // IMPACT BURSTS — replay the visual on top of the server-applied numbers.
    // Nothing here is authoritative; each only fires while its outcome is fresh
    // (< 4s old) so a tab that opens later never replays an ancient effect.
    const burstDivide = useCallback((it: AbilityInteraction) => {
        const o = it.outcome
        if (!o || o.status !== 'applied' || !o.target_user_id) {
            if (o?.status === 'blocked') dispatch(showToast({ type: 'error', message: 'Your Divide was blocked — the #1 player held up a Shield.' }))
            else if (o?.status === 'reflected') {
                const loss = Number(o.previous_bid ?? 0) - Number(o.bid_after ?? 0)
                const myId = myUserIdRef.current
                if (myId && loss > 0) fireDelta(myId, loss)
                dispatch(showToast({ type: 'error', message: 'The #1 player reflected your Divide — you are the one divided.' }))
            }
            return
        }
        setDivideTarget(o.target_user_id)
        setDivideStage('explode')
        const t1 = setTimeout(() => setDivideStage('settle'), 1000)
        divideTimeoutsRef.current.push(t1)
        const t2 = setTimeout(() => { setDivideStage('idle'); setDivideTarget(null) }, 1400)
        divideTimeoutsRef.current.push(t2)
        const loss = Number(o.previous_bid ?? 0) - Number(o.bid_after ?? 0)
        if (loss > 0) fireDelta(o.target_user_id, loss)
    }, [dispatch, fireDelta])

    const burstSwap = useCallback((it: AbilityInteraction) => {
        const o = it.outcome
        if (!o || o.status !== 'applied' || !o.leader_id) {
            if (o?.status === 'blocked') dispatch(showToast({ type: 'error', message: 'Your Swap was blocked — the leader held up a Shield.' }))
            else if (o?.status === 'reflected') dispatch(showToast({ type: 'error', message: 'The leader reflected your Swap — no position changed.' }))
            return
        }
        const rankOf = (m: Record<string, number>) => {
            const sorted = Object.entries(m).sort((a, b) => Number(b[1]) - Number(a[1]))
            const r: Record<string, number> = {}
            sorted.forEach(([id], i) => { r[id] = i + 1 })
            return r
        }
        const before: Record<string, number> = {}
        const after: Record<string, number> = {}
        if (myUserId) { before[myUserId] = Number(o.actor_previous ?? 0); after[myUserId] = Number(o.actor_new ?? 0) }
        before[o.leader_id] = Number(o.leader_previous ?? 0)
        after[o.leader_id] = Number(o.leader_new ?? 0)
        const rb = rankOf(before)
        const ra = rankOf(after)
        setSwapDeltas(myUserId
            ? {
                [myUserId]: (rb[myUserId] ?? 0) - (ra[myUserId] ?? 0),
                [o.leader_id]: (rb[o.leader_id] ?? 0) - (ra[o.leader_id] ?? 0),
            }
            : {})
        setSwapTargetId(o.leader_id)
        setSwapStage('explode')
        const t1 = setTimeout(() => setSwapStage('settle'), SWAP_BURST_MS)
        swapTimeoutsRef.current.push(t1)
        const t2 = setTimeout(() => { setSwapStage('idle'); setSwapTargetId(null); setSwapDeltas({}) }, SWAP_BURST_MS + 1200)
        swapTimeoutsRef.current.push(t2)
    }, [myUserId, dispatch])

    const startStealDrain = useCallback((it: AbilityInteraction) => {
        const eligible = (it.outcome?.eligible ?? []).map(String)
        if (eligible.length === 0) {
            dispatch(showToast({ type: 'error', message: 'Your Steal was fully blocked — nobody was reachable.' }))
            return
        }
        const basis = new Map<string, number>()
        bids.forEach(b => { if (eligible.includes(String(b.userId))) basis.set(String(b.userId), Number(b.bidAmount)) })
        stealBasisRef.current = basis
        stealSnapshotRef.current = bids
        stealInteractionIdRef.current = it.id
        setStealTargets(eligible)
        setStealLossByPlayer({})
        setStealGain(0)
        setStealSeconds(STEAL_FRUIT_DURATION_S)
        setStealStage('active')
    }, [bids, dispatch])

    const startFreezeImpact = useCallback((it: AbilityInteraction) => {
        const frozen = (it.outcome?.frozen ?? []).map(String)
        if (frozen.length === 0) {
            dispatch(showToast({ type: 'error', message: 'Your Freeze was blocked — every target countered it.' }))
            return
        }
        setFreezeTargets(frozen)
        setFreezeSeconds(FREEZE_FRUIT_DURATION_S)
        setFreezeStage('pulse')
        const t = setTimeout(() => setFreezeStage('active'), FREEZE_PULSE_MS)
        freezeTimeoutsRef.current.push(t)
    }, [dispatch])

    // RESOLUTION EFFECT — watch for pending → resolved transitions; fire the
    // matching impact burst + toasts exactly once per interaction id. The reach
    // of `FRONT` also fires the drain spectators the moment they come in range.
    useEffect(() => {
        if (!interactionFeed || !myUserId) return
        const seen = seenInteractionsRef.current
        for (const it of interactionFeed.interactions) {
            const prev = seen.get(it.id)
            if (prev !== 'resolved' && it.state === 'resolved') {
                const resolvedMs = Date.parse(it.resolved_at ?? '')
                const fresh = Number.isFinite(resolvedMs) && serverNowMs - resolvedMs < 4000
                if (fresh) {
                    if (it.actor_is_me) {
                        if (it.effect_type === 'divide') burstDivide(it)
                        else if (it.effect_type === 'swap') burstSwap(it)
                        else if (it.effect_type === 'thief') startStealDrain(it)
                        else if (it.effect_type === 'freeze') startFreezeImpact(it)
                    } else if (it.is_targeting_me) {
                        if (iBlockedMe(it, myUserId)) {
                            dispatch(showToast({ type: 'success', message: `🛡 You shielded the ${effectShortLabel(it.effect_type)} — your bid is safe.` }))
                        } else if (iReflectedMe(it, myUserId)) {
                            dispatch(showToast({ type: 'success', message: `↩️ You mirrored the ${effectShortLabel(it.effect_type)} — thrown straight back.` }))
                        } else if (iWasAffected(it, myUserId)) {
                            if (it.effect_type === 'freeze') {
                                setMyFreeze({ frozen: true, remaining: FREEZE_FRUIT_DURATION_S })
                                dispatch(showToast({ type: 'error', message: '❄️ The Freeze Fruit hit you — you are frozen.' }))
                            } else {
                                dispatch(showToast({ type: 'error', message: `The ${effectShortLabel(it.effect_type)} hit you.` }))
                            }
                        }
                    }
                }
            }
            seen.set(it.id, it.state)
        }
    }, [interactionFeed, myUserId, serverNowMs, burstDivide, burstSwap, startStealDrain, startFreezeImpact, dispatch])

    // RESPOND — the defender casts Shield (blocks) or Mirror (reflects) on the
    // interaction currently targeting them.
    const handleRespond = useCallback((interactionId: number, fruitId: 'shield' | 'mirror') => {
        if (responding) return
        setResponding(true)
        void (async () => {
            try {
                const res = await fetch('/api/landwars/ability-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId, action: 'respond', interactionId, fruitId }),
                })
                const data = await res.json()
                if (!res.ok) {
                    dispatch(showToast({ type: 'error', message: data.error || 'Could not use that defense.' }))
                    return
                }
                recordFruitUse(auctionId, fruitId)
                dispatch(showToast({
                    type: 'success',
                    message: fruitId === 'shield'
                        ? '🛡 Shield up — the effect will bounce off you.'
                        : '↩️ Mirror up — the effect will be thrown straight back.',
                }))
                // Closing is left to the feed: the next poll sees blocked_by /
                // reflected_by updated and is_targeting_me flips to false.
            } catch {
                dispatch(showToast({ type: 'error', message: 'Something went wrong. Please try again.' }))
            } finally {
                setResponding(false)
            }
        })()
    }, [auctionId, dispatch, responding])

    //  ControlsModal save handler
    const handleControlsSave = useCallback((mode: typeof bidMode) => {
        setBidMode(mode)
        if (mode === 'voice') setVoiceKey(k => k + 1)
    }, [setBidMode])


    //  bid controls footer always present → always use extended padding
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

            {/*  Controls modal */}
            <ControlsModal
                isActive={controlsModal}
                setIsActive={setControlsModal}
                currentMode={bidMode}
                onSave={handleControlsSave}
            />

            <BuyBiddingCurrencyModal isActive={buyModal} setIsActive={setBuyModal} />

            {/*  FREEZE — the "you are currently frozen" popup. Shown to a
                player who is frozen by someone else's Freeze Fruit and tries
                to place a bid or activate a fruit (the Negate Fruit aside, per
                the design: it is the one fruit that works while frozen). */}
            <Modal isActive={freezePopupOpen} setIsActive={setFreezePopupOpen}>
                <div className="flex flex-col items-center text-center">
                    <div className="size-16 rounded-full bg-blue-100 flex items-center justify-center mb-5">
                        <Image
                            src={getAbilityFruit('freeze')?.image ?? '/ability-fruits/freeze.png'}
                            alt=""
                            width={40}
                            height={40}
                            sizes="40px"
                            className="size-10 object-contain"
                        />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">You are frozen</h2>
                    <p className="text-sm text-slate-500 mb-8">
                        You are currently frozen. Wait {Math.max(1, Math.ceil(myFreeze.remaining))} seconds
                        for the effect of the Freeze Fruit to wear off — or use the Negate Fruit to break out now.
                    </p>
                    <Button text="Got it" classname="w-full py-3.5" onClick={() => setFreezePopupOpen(false)} />
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
                <AdaptiveLeaderboard
                    rows={bids}
                    myUserId={myUserId}
                    renderCard={(row, rank, anim) => {
                        const bid = row as (typeof bids)[number]
                        const isYou = bid.userId === currentUserId || bid.userId === user?.id
                        // light red border on every target while it is being
                        // drained; disappears at the explode (timer hit zero)
                        // and for anyone who ran out mid-countdown.
                        const isStealLiveTarget =
                            stealStage === 'active' && stealTargets.includes(String(bid.userId))
                        // FREEZE FRAMES 4-6: a BLUE border + glow on every OTHER
                        // player's card while the activator's freeze holds, and on
                        // MY OWN card when I am frozen by someone else (learned
                        // from the freeze-status poll, not the local animation).
                        // The border is ON for 'active' only: the sheet has no borders
                        // during the pulse (frame 3), and dropping the class at
                        // 'fade' (frame 6) lets the CSS transition below carry them
                        // out smoothly over FREEZE_FADE_MS instead of snapping off.
                        const isFreezeLiveTarget =
                            freezeStage === 'active' && freezeTargets.includes(String(bid.userId))
                        const isSelfFrozen = myFreeze.frozen && String(bid.userId) === String(myUserId)
                        const isFreezeBordered = isFreezeLiveTarget || isSelfFrozen
                        // SWAP FRAME 4: the whole card shakes while the fruit
                        // bursts on it, per the design sheet's explosion note.
                        const isSwapBursting = swapStage === 'explode' && String(bid.userId) === swapTargetId
                        // RESTORE FRAME 3: the same shake, on my own card, while
                        // the Restore Fruit explodes on it.
                        const isRestoreBursting = restoreStage === 'explode' && String(bid.userId) === String(myUserId)
                        // NEGATE FRAME 6: the Negate Fruit blows up on my own
                        // card as it cancels the effect — same shake again.
                        const isNegateBursting = negateStage === 'explode' && String(bid.userId) === String(myUserId)
                        return (
                            <motion.div
                                data-divide-card={bid.userId}
                                data-freeze-card={bid.userId}
                                data-swap-card={bid.userId}
                                data-steal-card={bid.userId}
                                data-steal-target={stealTargets.includes(String(bid.userId)) ? 'true' : undefined}
                                animate={isSwapBursting || isRestoreBursting || isNegateBursting
                                    ? { x: [0, -7, 6, -5, 4, -2, 0], y: [0, 3, -3, 2, -1, 0, 0] }
                                    : { x: 0, y: 0 }}
                                transition={isSwapBursting
                                    ? { duration: SWAP_BURST_MS / 1000, ease: 'easeOut' }
                                    : isRestoreBursting
                                        ? { duration: RESTORE_BURST_MS / 1000, ease: 'easeOut' }
                                        : isNegateBursting
                                            ? { duration: NEGATE_BURST_MS / 1000, ease: 'easeOut' }
                                            : { duration: 0.2 }}
                                // FREEZE FRAME 6: box-shadow is in the transition list
                                // (transition-colors alone would snap the glow off) and
                                // runs for FREEZE_FADE_MS, the sheet's ~400ms fade.
                                style={{ transitionDuration: `${FREEZE_FADE_MS}ms` }}
                                className={`bg-white rounded-3xl shadow-sm border transition-[border-color,box-shadow,background-color] ${
                                    isFreezeBordered
                                        ? 'border-[#3DA5FF] shadow-[0_0_18px_rgba(61,165,255,0.35)]'
                                        : isStealLiveTarget
                                            ? 'border-red-200 ring-1 ring-red-100'
                                            : 'border-gray-100'
                                }`}
                            >
                                {/*  each card wraps in the Freeze + Negate + Restore + Steal + Swap + Divide + Multiply fruit overlays */}
                                <FreezeFruitAbility
                                    tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                    activatorId={myUserId}
                                    targetIds={freezeTargets}
                                    stage={freezeStage}
                                    secondsLeft={freezeSeconds}
                                    playerId={bid.userId}
                                >
                                <NegateFruitAbility
                                    tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                    activatorId={myUserId}
                                    stage={negateStage}
                                    playerId={bid.userId}
                                    restoredAmount={negateRestoreTo}
                                    effectLabel={negateLabel}
                                >
                                <RestoreFruitAbility
                                    tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                    activatorId={myUserId}
                                    stage={restoreStage}
                                    playerId={bid.userId}
                                    refundAmount={restoreRefund}
                                >
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
                                    <SwapFruitAbility
                                        tableData={bids.map(b => ({ id: b.userId, bidAmount: Number(b.bidAmount) }))}
                                        activatorId={myUserId}
                                        targetPlayerId={swapTargetId}
                                        stage={swapStage}
                                        playerId={bid.userId}
                                        positionDelta={swapDeltas[String(bid.userId)]}
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
                                        <div className="size-10 bg-slate-600 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                                            <AnimatePresence mode="popLayout" initial={false}>
                                                <motion.span
                                                    key={anim.flipKey}
                                                    initial={{ opacity: 0, y: 10 * anim.dir }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 * anim.dir }}
                                                    transition={{ duration: 0.16, ease: 'easeOut' }}
                                                >
                                                    {rank}
                                                </motion.span>
                                            </AnimatePresence>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="relative inline-block max-w-full align-top">
                                                <h2 className="text-xl font-bold text-gray-900 leading-tight truncate">
                                                    <AnimatePresence mode="popLayout" initial={false}>
                                                        <motion.span
                                                            key={anim.flipKey}
                                                            initial={{ opacity: 0, y: 10 * anim.dir }}
                                                            animate={{ opacity: 1, y: 0, scale: scalePop[bid.userId] ? 1.08 : 1 }}
                                                            exit={{ opacity: 0, y: -10 * anim.dir }}
                                                            transition={{ duration: 0.16, ease: 'easeOut' }}
                                                            className="inline-block rounded-md"
                                                            style={{
                                                                boxShadow: glowPop[bid.userId] ? '0 0 12px rgba(34,197,94,0.3)' : 'none',
                                                            }}
                                                        >
                                                            B {Number(bid.bidAmount).toLocaleString()}
                                                        </motion.span>
                                                    </AnimatePresence>
                                                </h2>
                                                {deltaTriggers[bid.userId] && (
                                                    <FloatingDelta
                                                        amount={deltaTriggers[bid.userId].amount}
                                                        type="increase"
                                                        trigger={deltaTriggers[bid.userId].trigger}
                                                    />
                                                )}
                                            </div>
<p className={`text-sm mt-1 truncate ${isYou ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                                                <AnimatePresence mode="popLayout" initial={false}>
                                                    <motion.span
                                                        key={anim.flipKey}
                                                        initial={{ opacity: 0, y: 10 * anim.dir }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 * anim.dir }}
                                                        transition={{ duration: 0.16, ease: 'easeOut' }}
                                                        className="inline-block"
                                                    >
                                                        {isYou
                                                            ? (bid.username || user?.username || 'You')
                                                            : (bid.username || 'Unknown')}
                                                    </motion.span>
                                                </AnimatePresence>
                                            </p>
                                        </div>
                                    </div>
                                </MultiplyFruitAbility>
                                </DivideFruitAbility>
                                </SwapFruitAbility>
                                </StealFruitAbility>
                                </RestoreFruitAbility>
                                </NegateFruitAbility>
                                </FreezeFruitAbility>
                            </motion.div>
                        )
                    }}
                />
            )}

            {/*  DIVIDE FRAME 2 — the status pill under the table:
                "÷N  Dividing <name>'s bid by N". Clears once the cut lands. */}
            <DivideStatusPill
                stage={divideStage}
                targetName={bids.find(b => b.userId === divideTarget)?.username}
                factor={DIVIDE_FACTOR}
            />

            {/*  SWAP FRAMES 2-3 — the green caption bar under the
                table while the fruit is out and in flight, mirroring the
                narration strip on the design sheet. */}
            <SwapStatusPill
                stage={swapStage}
                targetName={bids.find(b => String(b.userId) === swapTargetId)?.username}
            />

            {/*  NEGATE FRAMES 5-7 — the magenta caption bar under
                the table, naming the effect being cancelled, turning green on
                the frame where the bid is restored. */}
            <NegateStatusPill stage={negateStage} effectLabel={negateLabel} />

            {/*  FREEZE FRAME 3 — the radial wave leaving the activator's
                card and washing over every other card on the table (~600ms).
                It is drawn once here, at page level, because the sheet's rings
                span the WHOLE table rather than sitting on one card. */}
            {freezeStage === 'pulse' && freezePulse && (
                <FreezePulseOverlay origin={freezePulse.origin} reach={freezePulse.reach} />
            )}

            {/*  FREEZE FRAMES 2-6 — the blue caption bar under the
                table while the activator's freeze is live: activated ->
                30s countdown -> fading out. */}
            <FreezeStatusPill stage={freezeStage} secondsLeft={freezeSeconds} />

            {/*  RESTORE FRAMES 2-4 — the teal caption bar under
                the table, ending on the "Restoring your resources..." spinner. */}
            <RestoreStatusPill stage={restoreStage} />

            {/*  INTERACTION FRAME 1-2 — the manifest pill under the
                table while OUR interactive fruit is in its reaction window. */}
            <AnimatePresence>
                {myPending && myPendingSeconds > 0 && (
                    <motion.div
                        className="pointer-events-none flex justify-center"
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg bg-gray-900">
                            {effectLabel(myPending.effect_type)} in flight · {myPendingSeconds}s reaction window
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/*  RESTORE FRAME 5 — the summary of exactly what
                came back. Closed by Continue, never on a timer. */}
            <RestoreSummaryModal
                open={restoreStage === 'summary'}
                fruits={restoreFruits}
                refundAmount={restoreRefund}
                onContinue={handleRestoreContinue}
            />

            {/*  DIVIDE — the fruit flying from MY card to the
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

            {/*  Increment buttons in footer (default mode) */}
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

            {/*  Slider in footer */}
            {bidMode === 'slider' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-5 max-w-md mx-auto">
                    <BidSlider
                        steps={sliderConfig.steps}
                        disabled={quickBidding || bidding}
                        onBid={(amount) => void handleQuickBid(amount)}
                        onCancel={() => dispatch(showToast({ type: 'success', message: 'Bid cancelled' }))}
                    />
                </div>
            )}

            {/*  Voice mode — only mic icon centered in footer, no background */}
            {bidMode === 'voice' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center items-center max-w-md mx-auto pb-[10px]">
                    <VoiceBidButton
                        key={voiceKey}
                        onBid={handleVoiceBid}
                        onBuy={() => setBuyModal(true)}
                        onAbilityFruits={openAbilityFruits}
                        renderInline
                    />
                </div>
            )}

            {/*  INTERACTION SYSTEM — the manifest flights (z-60), the
                spidey-sense telegraph rings (z-55) and the defender's React
                picker. The two overlays are pointer-events-none; only the
                picker modal accepts taps. */}
            <AbilityManifestOverlay interactions={pendingInteractions} serverNowMs={Date.now() + feedOffsetMs} />
            <TargetTelegraphOverlay interactions={pendingInteractions} serverNowMs={Date.now() + feedOffsetMs} myUserId={myUserId} />
            <ReactFruitPicker
                interaction={reactTarget && reactTarget.state === 'pending' ? reactTarget : null}
                serverNowMs={Date.now() + feedOffsetMs}
                responding={responding}
                myUserId={myUserId}
                cooldowns={reactCooldowns}
                onRespond={handleRespond}
                onDismiss={() => setReactTarget(null)}
            />
        </PageLayout>
    );
}

export default LeaderboardPage;
