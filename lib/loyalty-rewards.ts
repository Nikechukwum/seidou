/**
 * Loyalty rewards: unclaimed bidding-currency rewards stored on
 * users.loyalty_rewards and claimed from the Land Wars Wallet (and the two
 * other loyalty-reward pages).
 *
 * Client-safe. The amounts here are a display mirror only — what a claim
 * actually credits is decided by the allowlist in
 * supabase/loyalty_rewards_claim.sql, never by a field the browser can write.
 */

/** Where a reward came from. Absent on older entries (GamePix), which the claim treats as "legacy". */
export type LoyaltyRewardSource = "video";

export interface LoyaltyReward {
    id: number;
    amount: string;
    source?: LoyaltyRewardSource;
}

export const LOYALTY_REWARD_AMOUNTS = {
    video: 30_000,
    legacy: 30_000,
} as const;

interface ClaimState {
    rewardId: number;
    bidding_balance: number;
    loyalty_rewards: LoyaltyReward[];
}

/** Body returned by POST /api/loyalty-rewards/claim for every outcome that carries fresh state. */
export type ClaimResponse =
    | (ClaimState & { status: "claimed"; amount: number })
    | (ClaimState & { status: "not_found" })
    | (ClaimState & { status: "unknown_source" });
