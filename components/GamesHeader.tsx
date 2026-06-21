'use client'
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GAME_CATEGORIES = ['All', 'Basketball', 'Board', 'Car', 'Card', 'Escape', 'Fighting', 'Guns', 'Puzzle', 'Racing', 'Shooter', 'Snake', 'Soccer'];

export const GamesHeader = () => {
    const router = useRouter();
    const [fullHeader, setFullHeader] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const lastScrollValue = useRef<number>(0);

    useEffect(() => {
        const mainElement = document.querySelector('#main') as HTMLElement | null;
        if (!mainElement) return;

        const checkScrollDirection = () => {
            const newScrollValue = mainElement.scrollTop;
            if (Math.abs(newScrollValue - lastScrollValue.current) < 20) return;
            if (newScrollValue >= lastScrollValue.current && newScrollValue >= 100) {
                setFullHeader(false);
            } else {
                setFullHeader(true);
            }
            lastScrollValue.current = newScrollValue;
        };

        mainElement.addEventListener('scroll', checkScrollDirection);
        return () => {
            mainElement.removeEventListener('scroll', checkScrollDirection);
        };
    }, []);

    return (
        <header className={`duration-300 bg-white fixed max-w-md top-0 z-10 w-full border-b border-b-[#E6E6E6] ${!fullHeader ? "-translate-y-14" : ""}`}>
            {/* Top row */}
            <div className="h-14 flex items-center px-3 pt-3">
                <button onClick={() => router.back()} className="p-2 text-black">
                    <ArrowLeftIcon className="size-5" strokeWidth={3} />
                </button>
                <span className="absolute left-1/2 -translate-x-1/2 font-semibold text-xl">Games</span>
            </div>

            {/* Category filter row */}
            <div className="w-full flex items-center bg-white px-2">
                <div className="no-scrollbar py-2.5 w-full flex gap-x-1.5 overflow-x-scroll snap-x snap-mandatory">
                    {GAME_CATEGORIES.map((category) => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`shrink-0 rounded-full px-4 py-1.5 text-sm first:ml-1 last:mr-1 snap-start active:scale-[1.07] transition-transform ${
                                category === activeCategory
                                    ? 'bg-[#202020] text-white'
                                    : 'bg-[#f5f5f5]'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>
        </header>
    );
};
