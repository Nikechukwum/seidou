import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/social/lib/utils";

/**
 * The upstream version wrapped this in a Radix Tooltip. Dropped: tooltips fire
 * on hover, which does not exist on the touch devices this mobile shell
 * targets, and it removes a dependency. The name is already line-clamped.
 */
const userInfoVariants = cva("flex items-center gap-1", {
  variants: {
    size: {
      default: "[&_p]:text-sm",
      lg: "[&_p]:text-base [&_p]:font-medium [&_p]:text-black",
      sm: "[&_p]:text-xs",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface UserInfoProps extends VariantProps<typeof userInfoVariants> {
  name: string;
  className?: string;
}

export const UserInfo = ({ name, className, size }: UserInfoProps) => {
  return (
    <div className={cn(userInfoVariants({ size, className }))}>
      <p className="text-gray-500 line-clamp-1">{name}</p>
    </div>
  );
};
