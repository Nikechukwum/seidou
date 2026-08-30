'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { GamesHeader } from "@/components/GamesHeader";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import Image from "next/image";
import Script from "next/script";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { LoyaltyReward, PartialUpdateUser } from "@/redux/authSlice";
import { showToast } from "@/redux/toastSlice";
import { createClient } from "@/lib/supabase/client";
import useAuth from "@/hooks/useAuth";

type Game = {
  id: string;
  title: string;
  banner_image: string;
  url: string;
};

const REWARD_AMOUNT = 30000;

const GamesPage = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [claimModalActive, setClaimModalActive] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dispatch = useDispatch();
  const supabase = createClient();
  const { checkSession } = useAuth();
  const { user } = useSelector((state: RootState) => state.auth);

  // Load the signed-in user's profile (without forcing a redirect) so we
  // can credit their bidding balance / rewards when they claim.
  useEffect(() => {
    checkSession(false);
  }, []);

  const goToGame = (url: string) => {
    window.open(url, '_blank');
  };

  const handlePlay = async (game: Game) => {
    if (!user?.id) {
      goToGame(game.url);
      return;
    }

    try {
      const response = await fetch(`/api/loyalty-rewards?userId=${user.id}`);

      if (response.ok) {
        const data = await response.json();
        if (data.canClaim) {
          setSelectedGame(game);
          setClaimModalActive(true);
        } else {
          goToGame(game.url);
        }
      } else {
        goToGame(game.url);
      }
    } catch (err) {
      console.error("Failed to check cooldown:", err);
      goToGame(game.url);
    }
  };

  // "Accept" — save reward to Loyalty Rewards for later claiming, then route to the game
  const handleAccept = async () => {
    const game = selectedGame;
    if (isProcessing) return;

    if (!user?.id) {
      dispatch(showToast({ type: "error", message: "Please sign in to save your reward." }));
      setClaimModalActive(false);
      if (game) goToGame(game.url);
      return;
    }

    setIsProcessing(true);
    const newReward: LoyaltyReward = { id: Date.now(), amount: REWARD_AMOUNT.toString() };
    const updatedRewards = [...(user.loyalty_rewards ?? []), newReward];
    const { error: updateError } = await supabase
      .from("users")
      .update({ loyalty_rewards: updatedRewards })
      .eq("id", user.id);
    setIsProcessing(false);

    if (updateError) {
      dispatch(showToast({ type: "error", message: "Could not save your reward. Please try again." }));
    } else {
      dispatch(PartialUpdateUser({ loyalty_rewards: updatedRewards }));
      dispatch(showToast({ type: "success", message: "Reward saved to your Land Wars Wallet." }));
    }

    setClaimModalActive(false);
    if (game) goToGame(game.url);
  };

  // "Reject" — forfeit the reward and go straight to the game
  const handleReject = () => {
    const game = selectedGame;
    setClaimModalActive(false);
    if (game) goToGame(game.url);
  };

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await axios.get(
          "https://feeds.gamepix.com/v2/json?sid=37523&pagination=24&page=1"
        );
        const gameItems = response.data?.items ?? [];

        const formattedGames: Game[] = gameItems.map((item: any) => ({
          id: item.id,
          title: item.title,
          banner_image: item.banner_image,
          url: item.url,
        }));

        setGames(formattedGames);
      } catch (err) {
        setError("Failed to load games.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <GamesHeader />
        <div className="pt-28 pb-20 flex items-center justify-center min-h-screen">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <GamesHeader />
      <FullScreenLoader isActive={loading} />

      {/* Claim bidding currency modal */}
      <Modal isActive={claimModalActive} setIsActive={setClaimModalActive} persist>
        <h2 className="text-xl font-bold text-[#111827] mb-2">Accept your reward before you go...</h2>
        <p className="text-gray-500 mb-8 text-sm">
          You have been awarded bidding currency. You can choose to accept or reject it.
          All accepted rewards can later be claimed in your Land Wars Wallet.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            text={isProcessing ? "Saving..." : "Accept"}
            classname="w-full py-3"
            onClick={isProcessing ? undefined : handleAccept}
          />
          <Button
            text="Reject"
            bordered
            classname="w-full py-3"
            onClick={isProcessing ? undefined : handleReject}
          />
        </div>
      </Modal>

      <div className="pt-28 pb-20 p-4 space-y-6">
        

        {/* Social Bar Script */}
        <Script
          src="https://pl28648876.effectivegatecpm.com/6b/6f/eb/6b6feb7c324f2f4b8c9c61d30e253f1b.js"
          strategy="afterInteractive"
        />

        {/* Games Grid */}
        <div className="grid grid-cols-1 gap-7 pt-3">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="relative h-48 bg-gray-500">
                <Image
                  src={game.banner_image}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="px-4 py-7 flex flex-col justify-between grow gap-y-4">
                <h3 className="text-sm font-semibold line-clamp-2">
                  {game.title}
                </h3>
                <Button onClick={() => { handlePlay(game) }} bordered text="Play" size="sm" classname="w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
