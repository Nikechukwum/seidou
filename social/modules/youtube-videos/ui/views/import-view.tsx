"use client";

import { useState } from "react";

import { PageLayout } from "@/components/PageLayout";

import { ConvertSection } from "../sections/convert-section";
import { ImportSection } from "../sections/import-section";
import { RecentSection } from "../sections/recent-section";

type Step = { kind: "convert" } | { kind: "import"; convertedText?: string; run: number };

/**
 * /import, in two steps:
 *   1. CONVERT — upload a saved YouTube channel page, fetch its videos, then
 *      set the channel name, category and images (ConvertSection).
 *   2. IMPORT — preview exactly what will be written and write it
 *      (ImportSection). Also reachable directly with an existing JSON export.
 *
 * Step 1 stays mounted while step 2 is open, so "Back" returns to the same
 * pages, names, categories and images.
 */
export const ImportView = () => {
  const [step, setStep] = useState<Step>({ kind: "convert" });

  return (
    <PageLayout pageTitle="Import YouTube videos" className="bg-white">
      <div className="space-y-8 px-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Step {step.kind === "convert" ? "1 of 2 — Channel page" : "2 of 2 — Import"}
        </p>

        <div className={step.kind === "convert" ? "" : "hidden"}>
          <ConvertSection
            onContinue={(convertedText) => setStep({ kind: "import", convertedText, run: Date.now() })}
            onSkip={() => setStep({ kind: "import", run: Date.now() })}
          />
        </div>

        {step.kind === "import" && (
          <ImportSection
            // a fresh preview each time step 1 hands over a new export
            key={step.run}
            convertedText={step.convertedText}
            onBack={() => setStep({ kind: "convert" })}
          />
        )}

        <div className="space-y-4">
          <p className="text-sm font-semibold">Last 10 imported</p>
          <RecentSection />
        </div>
      </div>
    </PageLayout>
  );
};
