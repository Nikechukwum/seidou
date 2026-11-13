'use client'

import AuctionCategoryCard from "@/components/AuctionCategoryCard";
import { DrawerModal } from "@/components/DrawerModal";
import { PageLayout } from "@/components/PageLayout";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { Gamepad2, Gift, ShoppingBag, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const AuctionPage = () => {
    const [drawer, setDrawer] = useState(false)
    // The burger-menu action sheet: one row, icon on top and its label below.
    const drawerItems = [
        { title: 'Store', icon: ShoppingBag, route: '/auction/store' },
        { title: 'Games', icon: Gamepad2, route: '/auction/games' },
        { title: 'Wallet', icon: Wallet, route: '/land-wars/wallet' },
        { title: 'Reward Hub', icon: Gift, route: '/auction/loyalty-rewards' },
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
                <div className="grid grid-cols-4 gap-2">
                    {drawerItems.map((item) => (
                        <Link
                            key={item.title}
                            href={item.route}
                            className="group flex flex-col items-center gap-2 rounded-2xl py-2 active:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center justify-center size-14 rounded-2xl bg-[#f3f4f6] group-active:scale-95 transition-transform">
                                <item.icon className="size-6 text-[#4b5563]" />
                            </div>
                            <span className="text-xs font-medium text-gray-900 text-center">{item.title}</span>
                        </Link>
                    ))}
                </div>
            </DrawerModal>

            <AuctionCategoryCard />
        </PageLayout>
    );
}

export default AuctionPage;
