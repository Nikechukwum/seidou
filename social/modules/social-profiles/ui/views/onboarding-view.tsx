"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { socialPath } from "@/social/constants";
import { toast } from "@/social/lib/toast";
import { trpc } from "@/social/trpc/client";

import { GENDER_OPTIONS } from "../../constants";
import { DEFAULT_COUNTRY } from "../../countries";
import { BasicInfoStep, BasicInfoValues } from "../components/basic-info-step";
import { InterestsStep } from "../components/interests-step";
import { PersonalizingStep } from "../components/personalizing-step";

type Step = "basic" | "interests" | "personalizing";

interface OnboardingViewProps {
  initial: {
    username: string;
    gender: string | null;
    country: string | null;
    interests: string[];
  };
  countries: { code: string; name: string }[];
}

/**
 * One route, three steps held in state — the answers from step one are only
 * saved together with the interests, so nothing half-finished is written if
 * someone leaves midway.
 */
export const OnboardingView = ({ initial, countries }: OnboardingViewProps) => {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basic");

  const [basicInfo, setBasicInfo] = useState<BasicInfoValues>({
    username: initial.username,
    gender: GENDER_OPTIONS.find((option) => option === initial.gender) ?? "",
    country: initial.country ?? DEFAULT_COUNTRY,
    acceptedTerms: false,
  });
  const [interests, setInterests] = useState<string[]>(initial.interests);

  const complete = trpc.socialProfiles.completeOnboarding.useMutation({
    onError: () => {
      toast.error("We couldn't save your details. Please try again.");
      setStep("interests");
    },
  });

  const onInterestsContinue = () => {
    setStep("personalizing");
    // Started with the animation, not after it, so the save runs while the
    // checklist plays rather than adding a wait at the end.
    complete.mutate({
      username: basicInfo.username.trim(),
      // Both guaranteed by BasicInfoStep's Continue being disabled otherwise.
      gender: basicInfo.gender as (typeof GENDER_OPTIONS)[number],
      country: basicInfo.country,
      acceptedTerms: true,
      interests,
    });
  };

  const onBack = () => {
    if (step === "interests") setStep("basic");
    else router.push("/app-center/apps");
  };

  return (
    <div className="flex min-h-lvh flex-col bg-white">
      {step !== "personalizing" && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="ml-3 mt-4 w-fit p-2 text-black"
        >
          <ArrowLeftIcon className="size-5" strokeWidth={3} />
        </button>
      )}

      {step === "basic" && (
        <BasicInfoStep
          values={basicInfo}
          countries={countries}
          onChange={setBasicInfo}
          onContinue={() => setStep("interests")}
        />
      )}

      {step === "interests" && (
        <InterestsStep
          selected={interests}
          onChange={setInterests}
          onContinue={onInterestsContinue}
        />
      )}

      {step === "personalizing" && (
        <PersonalizingStep
          isSaved={complete.isSuccess}
          // replace: back from the feed should not return to a finished form.
          onDone={() => router.replace(socialPath())}
        />
      )}
    </div>
  );
};
