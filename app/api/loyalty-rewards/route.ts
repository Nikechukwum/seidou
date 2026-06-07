import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COOLDOWN_MINUTES = 2;
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("last_awarded_loyalty_reward_time")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      console.error("Failed to fetch user:", fetchError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const lastAwardTime = user.last_awarded_loyalty_reward_time?.game;
    if (lastAwardTime) {
      const lastTime = new Date(lastAwardTime);
      const now = new Date();
      const diffMs = now.getTime() - lastTime.getTime();
      const diffMins = diffMs / 1000 / 60;
      if (diffMins < COOLDOWN_MINUTES) {
        return NextResponse.json(
          { canClaim: false, retryAfter: Math.ceil(COOLDOWN_MINUTES - diffMins) },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ canClaim: true });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, gameId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    if (!IS_DEVELOPMENT) {
      const { data: user, error: fetchError } = await supabase
        .from("users")
        .select("last_awarded_loyalty_reward_time")
        .eq("id", userId)
        .single();

      if (fetchError || !user) {
        console.error("Failed to fetch user:", fetchError);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const lastAwardTime = user.last_awarded_loyalty_reward_time?.game;
      if (lastAwardTime) {
        const lastTime = new Date(lastAwardTime);
        const now = new Date();
        const diffMs = now.getTime() - lastTime.getTime();
        const diffMins = diffMs / 1000 / 60;
        if (diffMins < COOLDOWN_MINUTES) {
          return NextResponse.json(
            { error: "Please wait before claiming another reward.", retryAfter: Math.ceil(COOLDOWN_MINUTES - diffMins) },
            { status: 429 }
          );
        }
      }
    }

    const REWARD_AMOUNT = 30000;

    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("bidding_balance")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      console.error("Failed to fetch user:", fetchError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newBalance = (user.bidding_balance ?? 0) + REWARD_AMOUNT;

    const { error: updateError } = await supabase
      .from("users")
      .update({
        bidding_balance: newBalance,
        last_awarded_loyalty_reward_time: {
          game: new Date().toISOString(),
        },
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update user:", updateError);
      return NextResponse.json({ error: "Failed to claim reward" }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
