'use client';
// ^-- so the provider can be mounted from a server component

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';

import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';
import { APP_URL } from '@/social/constants';

export const trpc = createTRPCReact<AppRouter>();

let clientQueryClientSingleton: QueryClient;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: a fresh client per request, so nothing leaks between users.
    return makeQueryClient();
  }
  // Browser: one shared client, so the cache survives navigation.
  return (clientQueryClientSingleton ??= makeQueryClient());
}

function getUrl() {
  const base = typeof window !== 'undefined' ? '' : APP_URL;
  // Namespaced under /api/social so it cannot collide with Seidou's own
  // commerce API routes.
  return `${base}/api/social/trpc`;
}

export function TRPCProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  // Not useState for the query client: if this suspends on first render with
  // no boundary above it, React discards the client.
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
          async headers() {
            const headers = new Headers();
            headers.set('x-trpc-source', 'nextjs-react');
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
