import { ChevronDownIcon } from "lucide-react";

import { GENDER_OPTIONS } from "../../constants";
import { ContinueBar } from "./continue-bar";

export interface BasicInfoValues {
  username: string;
  gender: string;
  country: string;
  acceptedTerms: boolean;
}

interface BasicInfoStepProps {
  values: BasicInfoValues;
  countries: { code: string; name: string }[];
  onChange: (values: BasicInfoValues) => void;
  onContinue: () => void;
}

const fieldClass =
  "relative rounded-xl border border-gray-200 px-3.5 pt-2 pb-2.5 focus-within:border-black focus-within:ring-1 focus-within:ring-black";
const labelClass = "block text-xs text-gray-500";
const controlClass =
  "w-full appearance-none bg-transparent pt-0.5 text-[15px] text-black outline-none";

export const BasicInfoStep = ({
  values,
  countries,
  onChange,
  onContinue,
}: BasicInfoStepProps) => {
  const set = <K extends keyof BasicInfoValues>(key: K, value: BasicInfoValues[K]) =>
    onChange({ ...values, [key]: value });

  const usernameLength = values.username.trim().length;
  const canContinue =
    usernameLength >= 2 &&
    usernameLength <= 30 &&
    !!values.gender &&
    !!values.country &&
    values.acceptedTerms;

  return (
    <div className="flex flex-col px-6 pt-4 pb-28">
      <h1 className="text-2xl font-bold tracking-tight text-black">
        Basic information
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Tell us a little about yourself.
      </p>

      <form
        className="mt-8 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canContinue) onContinue();
        }}
      >
        <label className={fieldClass}>
          <span className={labelClass}>Username</span>
          <input
            value={values.username}
            onChange={(event) => set("username", event.target.value)}
            maxLength={30}
            autoComplete="nickname"
            placeholder="Choose a username"
            className={`${controlClass} placeholder:text-gray-400`}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Gender</span>
          <select
            value={values.gender}
            onChange={(event) => set("gender", event.target.value)}
            className={`${controlClass} ${values.gender ? "" : "text-gray-400"}`}
          >
            <option value="" disabled>
              Select gender
            </option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Country</span>
          <select
            value={values.country}
            onChange={(event) => set("country", event.target.value)}
            className={controlClass}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
        </label>

        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.acceptedTerms}
            onChange={(event) => set("acceptedTerms", event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-black"
          />
          <span className="text-xs leading-relaxed text-gray-600">
            I agree to Seidou&apos;s Terms and Conditions and Privacy Policy.
          </span>
        </label>
      </form>

      <ContinueBar disabled={!canContinue} onClick={onContinue} />
    </div>
  );
};
