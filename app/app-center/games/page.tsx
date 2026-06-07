'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { PageLayout } from "@/components/PageLayout";
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

  // "Yes" — credit the bidding currency now, then route to the game
  const handleClaimNow = async () => {
    const game = selectedGame;
    if (isProcessing) return;

    if (!user?.id) {
      dispatch(showToast({ type: "error", message: "Please sign in to claim your bidding currency." }));
      setClaimModalActive(false);
      if (game) goToGame(game.url);
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/loyalty-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, gameId: game?.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        dispatch(showToast({
          type: "error",
          message: data.error || "Could not claim your reward. Please try again."
        }));
        if (game) goToGame(game.url);
        return;
      }

      dispatch(PartialUpdateUser({ bidding_balance: data.newBalance }));
      dispatch(showToast({ type: "success", message: `B 30,000 added to your bidding balance.` }));
    } catch (err) {
      console.error("Failed to claim reward:", err);
      dispatch(showToast({ type: "error", message: "Could not claim your reward. Please try again." }));
    }

    setIsProcessing(false);
    setClaimModalActive(false);
    if (game) goToGame(game.url);
  };

  // "Not yet" — store a deferred reward in loyalty_rewards, then route to the game
  const handleClaimLater = async () => {
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
      dispatch(showToast({ type: "success", message: "Reward saved to your Loyalty Rewards." }));
    }

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
      <PageLayout pageTitle="Games" className="bg-[#f5f5f5]">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-red-500">{error}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout pageTitle="Games" className="bg-[#f5f5f5]">
      <FullScreenLoader isActive={loading} />

      {/* Claim bidding currency modal */}
      <Modal isActive={claimModalActive} setIsActive={setClaimModalActive}>
        <h2 className="text-xl font-bold text-[#111827] mb-2">Claim your reward before you go...</h2>
        <p className="text-gray-500 mb-8 text-sm">
          You&apos;ve been awarded bidding currency. Claim it now or at a later time. Unclaimed rewards can be found in the Loyalty Rewards page.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            text={isProcessing ? "Processing..." : "Yes, claim now"}
            classname="w-full py-3"
            onClick={isProcessing ? undefined : handleClaimNow}
          />
          <Button
            text="Maybe later"
            bordered
            classname="w-full py-3"
            onClick={isProcessing ? undefined : handleClaimLater}
          />
        </div>
      </Modal>

      <div className="p-4 space-y-6 pb-20">
        {/* Native Banner Container */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-2">Sponsored</p>
          <div id="container-f8a4b3e44415d671ad9711e479282e0d"></div>
        </div>

        {/* 300x250 Banner */}
        {/* <div className="flex justify-center bg-white rounded-xl p-4 shadow-sm">
          <Script
            id="adsterra-options"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.atOptions = {
                  key: '1f4eb91d082bac01274fed2e43bccfff',
                  format: 'iframe',
                  height: 250,
                  width: 300,
                  params: {}
                };
              `,
            }}
          />
          <Script
            src="https://pl28648090.effectivegatecpm.com/1f4eb91d082bac01274fed2e43bccfff/invoke.js"
            strategy="afterInteractive"
          />
        </div> */}

        {/* Smart Link Banner */}
        {/* <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-3">Special Offer</p>
          <a
            href="https://www.effectivegatecpm.com/k4j37eawde?key=fa5dd231bad5cff7def4f4565b5f24b1"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block"
          >
            <Button text="Continue" classname="w-full" />
          </a>
        </div> */}

        {/* Social Bar Script */}
        <Script
          src="https://pl28648876.effectivegatecpm.com/6b/6f/eb/6b6feb7c324f2f4b8c9c61d30e253f1b.js"
          strategy="afterInteractive"
        />

        {/* Crash Game Card */}
        {/* <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="relative h-40 bg-gray-500">
            <Image
              src="https://placehold.co/600x400/1a1a1a/ffffff?text=Crash+Game"
              alt="Crash Game"
              fill
              className="object-cover"
            />
          </div>
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold">Crash Game</h3>
            <a
              href="/crash"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button text="Play" classname="w-full" />
            </a>
          </div>
        </div> */}

        {/* Games Grid */}
        <div className="grid grid-cols-1 gap-7">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="relative h-32 bg-gray-500">
                <Image
                  src={game.banner_image}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="px-4 py-6 flex flex-col justify-between grow gap-y-4">
                <h3 className="text-sm font-semibold line-clamp-2">
                  {game.title}
                </h3>
                
                <Button onClick={()=>{handlePlay(game)}} bordered text="Play" size="xs" classname="w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default GamesPage;