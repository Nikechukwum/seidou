import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/social/lib/utils";
import { SOCIAL_CATEGORIES } from "@/social/modules/explore/constants";

const CHECKLIST = [
  "Loading your interests",
  "Finding creators you might like",
  "Building your personalized feed",
  "Almost ready...",
];

const STEP_MS = 800;

interface PersonalizingStepProps {
  /** The onboarding save has succeeded. The last item waits for it. */
  isSaved: boolean;
  onDone: () => void;
}

/**
 * The "Personalizing your feed" screen. The checklist is paced on a timer,
 * but the final tick is held until the save has actually gone through, so it
 * never claims "ready" before it is.
 */
export const PersonalizingStep = ({ isSaved, onDone }: PersonalizingStepProps) => {
  // How many checklist items are ticked.
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const last = CHECKLIST.length - 1;
    if (completed < last) {
      const timer = setTimeout(() => setCompleted((c) => c + 1), STEP_MS);
      return () => clearTimeout(timer);
    }
    if (completed === last && isSaved) {
      const timer = setTimeout(() => setCompleted(CHECKLIST.length), STEP_MS / 2);
      return () => clearTimeout(timer);
    }
    if (completed === CHECKLIST.length) {
      const timer = setTimeout(onDone, STEP_MS / 2);
      return () => clearTimeout(timer);
    }
  }, [completed, isSaved, onDone]);

  return (
    <div className="flex min-h-lvh flex-col items-center px-8 pt-14 pb-10">
      {/* Placeholder artwork: a tilted cluster of the category gradients. */}
      <div className="grid rotate-[-8deg] grid-cols-3 gap-2" aria-hidden>
        {SOCIAL_CATEGORIES.slice(0, 9).map((category, i) => (
          <div
            key={category.slug}
            className="size-16 rounded-xl shadow-md animate-pulse"
            style={{ background: category.gradient, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>

      <h1 className="mt-12 text-center text-3xl font-bold tracking-tight text-black">
        Personalizing your feed
      </h1>
      <p className="mt-2 max-w-64 text-center text-sm text-gray-500">
        We&apos;re finding content you&apos;ll love based on your interests and
        follows.
      </p>

      <ul className="mt-8 flex w-full flex-col gap-4">
        {CHECKLIST.map((label, i) => {
          const done = i < completed;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-black bg-black" : "border-gray-300"
                )}
              >
                {done && <CheckIcon className="size-3 text-white" strokeWidth={3} />}
              </span>
              <span className={done ? "text-black" : "text-gray-500"}>{label}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-black transition-[width] duration-700 ease-out"
          style={{ width: `${(completed / CHECKLIST.length) * 100}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-gray-400">Please wait a moment...</p>
    </div>
  );
};
