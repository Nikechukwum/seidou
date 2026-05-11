'use client'

import AuctionCategoryCard from "@/components/AuctionCategoryCard";
import { DrawerModal } from "@/components/DrawerModal";
import { IconListItem } from "@/components/IconListItem";
import { GamepadIcon } from "@/assets/vectors/Gamepad";
import { PageLayout } from "@/components/PageLayout";
import { ShoppingBagIcon } from "@heroicons/react/20/solid";
import { Bars3Icon, WalletIcon } from "@heroicons/react/24/solid";
import { PartyPopperIcon, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfettiIcon } from "@/assets/vectors/Confetti";

const AuctionPage = () => {
    const [drawer, setDrawer] = useState(false)
    const drawerItems = [
        {
            title: 'Auction Store',
            description: 'Explore available assets',
            icon: <ShoppingBagIcon className="size-6 text-[#2563eb]"/>,
            iconBg: 'bg-[#f0f7ff]',
            route: 'auction/store'
        },
        {
            title: 'Auction Games',
            description: 'Earn bidding currency faster',
            icon: <GamepadIcon size={26}/>,
            iconBg: 'bg-[#f5f3ff]',
            route: 'auction/games'
        },
        {
            title: 'Auction Wallet',
            description: 'View balance and history',
            icon: <WalletIcon className="size-6 text-[#ea580c]" />,
            iconBg: 'bg-[#fff7ed]',
            route: 'auction/wallet'
        },
        {
            title: 'Loyalty Rewards',
            icon: <ConfettiIcon size={26} fill="#ff2056"/>,
            iconBg: 'bg-[#fff1f2]',
            description: 'Spend earned Loyalty points',
            route: 'auction/loyalty-rewards'
        }
    ]
    return (
        <PageLayout 
        pageTitle="Auction" 
        className="px-4 bg-[#f5f5f5]" 
        noBackButton
        extraButton={
            <button onClick={()=>{setDrawer(true)}}>
                <Bars3Icon className="size-7"/>
            </button>
        }>
            <DrawerModal isActive={drawer} setIsActive={setDrawer}>
                <div className="space-y-4">
                    {drawerItems.map((item, idx)=>{
                        return(
                            <Link key={idx} href={item.route} className="inline-block">
                                <IconListItem
                                title={item.title}
                                icon={item.icon}
                                iconBg={item.iconBg}
                                description={item.description}
                                />
                            </Link>
                        )
                    })}

                </div>
            </DrawerModal>

            <AuctionCategoryCard />
        </PageLayout>
    );
}

export default AuctionPage;