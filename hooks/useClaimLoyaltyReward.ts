'use client'
import { useCallback, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import type { ClaimResponse, LoyaltyReward } from "@/lib/loyalty-rewards";

// Shared claim logic for the three loyalty-reward pages. The server does the
// work atomically; this only sends the reward id and mirrors whatever state
// comes back into Redux, so the list and balance always match the database.
const useClaimLoyaltyReward = () => {
    const dispatch = useDispatch()
    const [claimingId, setClaimingId] = useState<number | null>(null)
    // State updates are async, so a ref is what actually blocks a double tap
    const inFlight = useRef(false)

    const claim = useCallback(async (reward: LoyaltyReward) => {
        if (inFlight.current) return
        inFlight.current = true
        setClaimingId(reward.id)

        const fail = (message = "Could not claim your reward. Please try again.") =>
            dispatch(showToast({ type: "error", message }))

        try {
            const res = await fetch("/api/loyalty-rewards/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rewardId: reward.id }),
            })

            if (res.status === 401) {
                fail("Please sign in to claim your reward.")
                return
            }

            const body = await res.json().catch(() => null)
            if (!body || typeof body !== "object" || !("status" in body)) {
                fail()
                return
            }

            const result = body as ClaimResponse
            dispatch(PartialUpdateUser({
                bidding_balance: Number(result.bidding_balance),
                loyalty_rewards: result.loyalty_rewards,
            }))

            switch (result.status) {
                case "claimed":
                    dispatch(showToast({ type: "success", message: `B ${result.amount.toLocaleString()} added to your bidding balance.` }))
                    break
                case "not_found":
                    fail("This reward has already been claimed.")
                    break
                case "unknown_source":
                    fail("This reward can't be claimed. Please contact support.")
                    break
            }
        } catch {
            fail()
        } finally {
            inFlight.current = false
            setClaimingId(null)
        }
    }, [dispatch])

    return { claim, claimingId }
}

export default useClaimLoyaltyReward;
