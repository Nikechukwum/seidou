import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/social/lib/utils";
import { avatarColour } from "@/social/lib/avatar-colour";

/**
 * Rewritten on next/image rather than the Radix Avatar the upstream project
 * used — one fewer dependency, and it routes through Next's image optimizer
 * so remotePatterns applies.
 *
 * The initials fallback matters more here than upstream: Seidou accounts are
 * created by the commerce signup, which has never collected an avatar, so
 * avatar_url is empty for every existing user.
 */
const avatarVariants = cva(
  "relative shrink-0 overflow-hidden rounded-full flex items-center justify-center select-none",
  {
    variants: {
      /**
       * Each size pairs a box with a matching text size, so the initial keeps
       * roughly the same proportion of the circle throughout. Override the box
       * with a className and the text will NOT follow — tailwind-merge has no
       * reason to drop a text-* class that does not conflict with size-*. Add
       * a variant instead.
       */
      size: {
        xs: "h-4 w-4 text-[8px]",
        sm: "h-6 w-6 text-[10px]",
        default: "h-9 w-9 text-sm",
        lg: "h-10 w-10 text-sm",
        xl: "h-16 w-16 text-2xl",
        hero: "h-28 w-28 text-4xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface UserAvatarProps extends VariantProps<typeof avatarVariants> {
  imageUrl?: string | null;
  name: string;
  className?: string;
  onClick?: () => void;
}

export const UserAvatar = ({
  imageUrl,
  name,
  size,
  className,
  onClick,
}: UserAvatarProps) => {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      className={cn(avatarVariants({ size, className }))}
      // Only colour the fallback: a real photo fills the circle, and a tinted
      // ring behind it would show through while the image loads.
      style={imageUrl ? undefined : { backgroundColor: avatarColour(name) }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill className="object-cover" />
      ) : (
        <span className="font-semibold text-white">{initial}</span>
      )}
    </div>
  );
};
