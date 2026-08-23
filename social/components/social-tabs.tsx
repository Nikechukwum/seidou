"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/social/lib/utils";
import { socialPath } from "@/social/constants";
import { useViewer } from "@/social/hooks/use-viewer";

/**
 * Replaces the upstream desktop sidebar. Inside a max-w-md shell a horizontal
 * strip is the only sensible shape, and it matches the category chips
 * directly beneath it.
 */
const TABS = [
  { label: "Home", href: "", auth: false },
  { label: "Trending", href: "/feed/trending", auth: false },
  { label: "Subscribed", href: "/feed/subscribed", auth: true },
];

export const SocialTabs = () => {
  const pathname = usePathname();
  const { isSignedIn, isLoaded, requireSignIn } = useViewer();

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar fade-right px-4">
      {TABS.map((tab) => {
        const href = socialPath(tab.href);
        const isActive = pathname === href;

        // Sending a signed-out user to the subscribed feed would just bounce
        // them off the protected procedure, so intercept it here instead.
        if (tab.auth && isLoaded && !isSignedIn) {
          return (
            <button
              key={tab.label}
              onClick={requireSignIn}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-700"
            >
              {tab.label}
            </button>
          );
        }

        return (
          <Link
            prefetch
            key={tab.label}
            href={href}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-[#202020] text-white border-[#202020]"
                : "bg-white text-gray-700 border-gray-200"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};
