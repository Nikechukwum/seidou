import { TRPCProvider } from "@/social/trpc/client";

/**
 * Everything under /app-center/apps/seidou-social.
 *
 * TRPCProvider is mounted here rather than in the root layout so React Query
 * and the tRPC client stay out of the commerce bundle entirely. It is a client
 * component, which a server layout can render, so this file stays a server
 * component and pages below it can still prefetch.
 *
 * `data-social` is what scopes the ported shadcn base styles — see
 * social/social.css. Without it the components render unstyled; with it
 * applied any higher up, it would repaint the commerce pages.
 */
export default function SeidouSocialLayout({
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
