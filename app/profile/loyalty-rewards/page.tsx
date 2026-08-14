'use client'
import { Header } from "@/components/Header";

const LoyaltyRewardsPage = () => {
    return (
        <div className="py-24">
            <Header pageTitle="Loyalty Rewards" />
            <div className="flex flex-col items-center justify-center text-center py-24 px-6 text-slate-500">
                <p className="font-medium">No rewards yet</p>
                <p className="text-sm mt-1">Any unclaimed rewards will appear here.</p>
            </div>
        </div>
    );
}

export default LoyaltyRewardsPage;
