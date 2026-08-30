'use client'
import { ToggleCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { SEARCH_FILTERS, FilterMap } from "@/utils/defaults";
import { ChevronDown, Gift, Handbag, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, SetStateAction, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Badge } from "./Badge";

type Props = {
    filterAction: (filter: string) => void
    filters?: FilterMap
    filterLabels?: Record<string, string>
}

export const HomeHeader = ({filterAction, filters, filterLabels}: Props) => {
    const router = useRouter();
    const [fullHeader, setFullHeader] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const lastScrollValue = useRef<number>(0);
    const dispatch = useDispatch()
    const FILTERS = filters || SEARCH_FILTERS;
    const activeFilter = useSelector((state: RootState) => state.feed.activeFilter);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const cartItems = useSelector(
        (state: RootState) => state.cart.products
    );

    const totalQuantity = () => {
        let total = 0
        cartItems.forEach((item)=>{
            total += item.quantity
        })

        return total
    }

    const handleTagSelection = (filter: string) => {
        const feed: HTMLElement | null = document.getElementById("main");
        feed?.scrollTo({ top: 0 });

        const filterButton: HTMLElement | null = document.querySelector(
          `.${filter}-tag`
        );
        filterButton?.scrollIntoView({
          inline: "start",
          block: "nearest",
          behavior: "smooth",
        });
        filterAction(filter);
    }

    const mainRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const mainElement = document.querySelector('#main') as HTMLElement | null;
        if (!mainElement) return;
        mainRef.current = mainElement;

        const checkScrollDirection = () => {
            const newScrollValue = mainRef.current?.scrollTop || 0;
            if (Math.abs(newScrollValue - lastScrollValue.current) < 20) return
            if (newScrollValue >= lastScrollValue.current && newScrollValue >= 100) {
                setFullHeader(false);
            } else {
                setFullHeader(true);
            }
            lastScrollValue.current = newScrollValue;
        }

        const filterButton: HTMLElement | null = document.querySelector(
        `.${activeFilter}-tag`
        );
        filterButton?.scrollIntoView({
        inline: "start",
        block: "nearest",
        behavior: "smooth",
        });

        mainElement.addEventListener('scroll', checkScrollDirection);
        return () => {
            mainElement.removeEventListener('scroll', checkScrollDirection);
        };
    }, []);

    return ( 
        <header className={`duration-300 bg-white fixed max-w-md top-0 z-5 w-full border-b border-b-[#E6E6E6] ${!fullHeader ? "-translate-y-12.5" : ""}`}>
            <div className="h-12.5 flex items-center justify-between px-5 pt-5">
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen((o) => !o)}
                        className="flex items-center gap-1 active:opacity-70"
                        aria-label="Open menu"
                    >
                        <h1 className="font-semibold text-2xl">Seidou</h1>
                        <ChevronDown className={`size-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-lg p-1.5 z-50">
                            <button
                                onClick={() => {
                                    setDropdownOpen(false)
                                    router.push('/profile/loyalty-rewards')
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center justify-center size-10 rounded-xl bg-gray-100 shrink-0">
                                    <Gift className="size-5 text-[#4b5563]" />
                                </div>
                                <span className="font-medium text-sm">Loyalty Rewards</span>
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-x-2.5 items-center">
                    <button
                    onClick={() => { router.push('/explore') }}
                    className="w-7.5 text-black">
                        <Search className="w-6.5 h-6.5" strokeWidth={2.2}/>
                    </button>

                    <button
                    onClick={() => {
                        dispatch(ToggleCart(true))
                    }}
                    className="w-7.5 text-black"
                    >
                        <Badge showNotifier={cartItems?.length > 0} quantity={totalQuantity()}>
                            <Handbag className="w-6.5 h-6.5" strokeWidth={2.2}/>
                        </Badge>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className={`w-full flex items-center bg-white px-2`}>
                <div className="no-scrollbar fade-right py-2.5 w-full h-full flex grow gap-x-2 overflow-x-scroll snap-x snap-mandatory">
                    {(
                    Object.keys(FILTERS)
                    ).map((filter, index) => {
                    const displayLabel = filterLabels?.[filter] || filter;
                    const isAll = filter === "All";
                    return (
                        <Fragment key={index}>
                        <button
                        className={`shrink-0 rounded-full px-4 py-1.5 text-sm first:ml-10 last:mr-28
                        snap-start scroll-ml-3 active:scale-[1.07] transition-transform ${filter}-tag ${
                            filter === activeFilter
                            ? "bg-[#202020] text-white"
                            : "bg-[#f5f5f5]"
                        }`}
                        onClick={() => {
                            handleTagSelection(filter);
                        }}
                        >
                        {displayLabel}
                        </button>
                        {isAll && (
                            <button
                            aria-label="Update interests"
                            onClick={() => router.push('/onboarding')}
                            className="shrink-0 snap-start scroll-ml-3 rounded-full border px-3 py-1 text-sm flex items-center gap-1 bg-gray-100 hover:bg-gray-200 active:scale-[1.07] transition-transform"
                            >
                            <Plus className="w-4 h-4" strokeWidth={2.5} />
                            </button>
                        )}
                        </Fragment>
                    );
                    })}
                </div>
            </div>
        </header>
    );
}