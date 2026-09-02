"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DrawerModal } from "@/components/DrawerModal";

interface ResponsiveModalProps {
  children: ReactNode;
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Keeps the upstream ResponsiveModal name and prop shape so ported call sites
 * only change their import path, but drops the Radix Dialog / Vaul Drawer pair
 * it used. Inside a max-w-md shell there is no desktop branch to serve, so
 * Seidou's own DrawerModal covers both cases.
 *
 * Two things this shim exists to solve:
 *
 * 1. DrawerModal expects a state setter (Dispatch<SetStateAction<boolean>>),
 *    while callers pass a plain (open: boolean) => void.
 *
 * 2. It is rendered into PageLayout's `extraButton` slot, which Header wraps
 *    in a `-translate-y-1/2` div. A transformed ancestor becomes the
 *    containing block for position:fixed descendants, so the drawer sized
 *    itself against that little wrapper around the button instead of the
 *    viewport — it appeared as a narrow strip pinned to the right edge.
 *    Portalling to document.body escapes the transform.
 */
export const ResponsiveModal = ({
  children,
  open,
  title,
  onOpenChange,
}: ResponsiveModalProps) => {
  // document does not exist during SSR, so the portal target is only
  // available after mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <DrawerModal
      isActive={open}
      setIsActive={(value) =>
        onOpenChange(typeof value === "function" ? value(open) : value)
      }
    >
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </DrawerModal>,
    document.body
  );
};
