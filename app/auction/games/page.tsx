'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";
import { useRouter } from "next/navigation";

const AuctionGames = () => {
    const router = useRouter();
    
    return ( 
        <PageLayout pageTitle="Land Wars Games" className="px-6 space-y-8 bg-[#f5f5f5]">
            <BigCard 
                title="Word Search"
                description="Solve puzzles and multiply your rescources."
                buttonText="Open"
                img="/images.png"
                onClick={() => router.push('/auction/games/word-search')}
            />

            <BigCard 
                title="Skybound"
                description="Multiply your assets. Cashout before the flight ends."
                buttonText="Open"
                img="/Gemini_Generated_Image_ah3moxah3moxah3m.png"
                onClick={() => router.push('/auction/games/crash-game')}
            />
        </PageLayout>
    );
}
 
export default AuctionGames;