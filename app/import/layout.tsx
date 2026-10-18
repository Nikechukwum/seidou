import { TRPCProvider } from "@/social/trpc/client";

/**
 * /import — the YouTube import page, given a short top-level address.
 *
 * It lives outside /app-center/apps/seidou-social, so it does not inherit that
 * layout: this repeats what the page needs from it. TRPCProvider for the
 * youtubeVideos procedures, and `data-social`, which scopes the ported shadcn
 * base styles the import components are drawn with (see social/social.css).
 */
export default function ImportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TRPCProvider>
      <div data-social className="min-h-lvh">
        {children}
      </div>
    </TRPCProvider>
  );
}
