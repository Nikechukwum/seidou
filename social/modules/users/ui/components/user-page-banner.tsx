import Image from "next/image";

import { UserGetOneOutput } from "../../types";

interface UserPageBannerProps {
  user: UserGetOneOutput;
}

/**
 * Renders nothing when the channel has no banner.
 *
 * Upstream always drew the block, falling back to a flat colour. Since
 * nothing can set bannerUrl until banner uploads land, that meant every
 * channel opened with a large empty slab that read as a broken image rather
 * than an empty slot. The "add a banner" affordance arrives with the upload
 * work; until then there is nothing useful to occupy the space.
 */
export const UserPageBanner = ({ user }: UserPageBannerProps) => {
  if (!user.bannerUrl) return null;

  return (
    <div className="relative h-28 w-full overflow-hidden">
      <Image
        src={user.bannerUrl}
        alt={`${user.name} banner`}
        fill
        className="object-cover"
      />
    </div>
  );
};
