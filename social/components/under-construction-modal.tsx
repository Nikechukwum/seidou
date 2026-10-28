"use client";

import { Dispatch, SetStateAction } from "react";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

interface UnderConstructionModalProps {
  isActive: boolean;
  setIsActive: Dispatch<SetStateAction<boolean>>;
}

/**
 * The one "not built yet" dialog for Seidou Social.
 *
 * Same markup the auction wallet, loyalty rewards and product container use,
 * so unfinished features look the same wherever they are met. Used by the
 * header's close icon and by the like / comment / share buttons on Shorts.
 */
export const UnderConstructionModal = ({
  isActive,
  setIsActive,
}: UnderConstructionModalProps) => {
  return (
    <Modal isActive={isActive} setIsActive={setIsActive}>
      <div className="flex flex-col items-center text-center">
        <div className="w-18 h-18 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <WrenchScrewdriverIcon className="w-8 h-8 text-black" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Under Construction
        </h2>
        <p className="text-slate-500 mb-8 text-sm">
          We are working hard to bring this feature to life. It will be
          available in a future update.
        </p>

        <Button
          text="Got it"
          classname="w-full py-3.5"
          onClick={() => setIsActive(false)}
        />
      </div>
    </Modal>
  );
};
