'use client'

import AuctionCategoryCard from "@/components/AuctionCategoryCard";
import { DrawerModal } from "@/components/DrawerModal";
import { IconListItem } from "@/components/IconListItem";
import { PageLayout } from "@/components/PageLayout";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { Gamepad2, Gift, ShoppingBag, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const AuctionPage = () => {
    const [drawer, setDrawer] = useState(false)
    const drawerItems = [
        {
            title: 'Land Wars Store',
            description: 'Explore available assets',
            icon: <ShoppingBag className="size-5.5 text-[#4b5563]"/>,
            route: 'auction/store'
        },
        {
            title: 'Land Wars Games',
            description: 'Earn bidding currency faster',
            icon: <Gamepad2 className="size-5.5 text-[#4b5563]"/>,
            route: 'auction/games'
        },
        {
            title: 'Land Wars Wallet',
            description: 'View balance and history',
            icon: <Wallet className="size-5.5 text-[#4b5563]" />,
            route: '/land-wars/wallet'
        },
        {
            title: 'Loyalty Rewards',
            description: 'Spend earned Loyalty points',
            icon: <Gift className="size-5.5 text-[#4b5563]"/>,
            route: 'auction/loyalty-rewards'
        }
    ]
    return (
        <PageLayout 
        pageTitle="Land Wars" 
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
                                description={item.description}
                                chevron
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
