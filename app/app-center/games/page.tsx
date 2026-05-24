'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/Button";
import Image from "next/image";
import Script from "next/script";
import { FullScreenLoader } from "@/components/FullScreenLoader";

type Game = {
  id: string;
  title: string;
  banner_image: string;
  url: string;
};

const GamesPage = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <div className="p-3 flex flex-col justify-between grow gap-y-2.5">
                <h3 className="text-sm font-semibold line-clamp-2">
                  {game.title}
                </h3>
                <a
                  href={game.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button text="Play" size="xs" classname="w-full" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default GamesPage;