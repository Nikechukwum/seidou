'use client'

import AuctionCategoryCard from "@/components/AuctionCategoryCard";
import { PageLayout } from "@/components/PageLayout";

const AuctionPage = () => {

    return (
        <PageLayout pageTitle="Auction" className="px-4 bg-[#f5f5f5]">
            <AuctionCategoryCard />
        </PageLayout>
    );
}

export default AuctionPage;