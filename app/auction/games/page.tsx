'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";

const AuctionGames = () => {
    return ( 
        <PageLayout pageTitle="Auction Games" className="px-6 space-y-8 bg-[#f5f5f5]">
            <BigCard 
                title="Word Search"
                description="Solve puzzles and multiply your rescources."
                buttonText="Open"
                img="/images.png"
            />

            <BigCard 
                title="Skybound"
                description="Multiply your assets. Cashout before the flight ends."
                buttonText="Open"
                img="/Gemini_Generated_Image_ah3moxah3moxah3m.png"
            />
        </PageLayout>
    );
}
 
export default AuctionGames;