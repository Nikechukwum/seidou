interface ContinueBarProps {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}

/**
 * The full-width black Continue button pinned to the bottom of each
 * onboarding step, centred to the app's max-w-md column. Steps add bottom
 * padding (pb-28) so their last row clears it.
 */
export const ContinueBar = ({
  disabled = false,
  onClick,
  label = "Continue",
}: ContinueBarProps) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md bg-white px-6 pt-3 pb-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="w-full rounded-full bg-black py-3.5 text-center font-semibold text-white transition-all active:scale-[0.98] disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a]"
      >
        {label}
      </button>
    </div>
  );
};
