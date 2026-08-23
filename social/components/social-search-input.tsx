"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { socialPath } from "@/social/constants";

interface SocialSearchInputProps {
  defaultQuery?: string;
  defaultCategoryId?: string;
}

export const SocialSearchInput = ({
  defaultQuery = "",
  defaultCategoryId,
}: SocialSearchInputProps) => {
  const router = useRouter();
  const [value, setValue] = useState(defaultQuery);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Built with URLSearchParams rather than string concatenation so a query
    // containing & or # cannot break the link.
    const params = new URLSearchParams();
    if (value.trim()) params.set("query", value.trim());
    if (defaultCategoryId) params.set("categoryId", defaultCategoryId);

    router.push(`${socialPath("/search")}?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative px-4">
      <SearchIcon className="absolute left-8 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search videos"
        className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-11 pr-10 text-sm outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-8 top-1/2 -translate-y-1/2"
        >
          <XIcon className="size-4 text-gray-400" />
        </button>
      )}
    </form>
  );
};
