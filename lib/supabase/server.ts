// Created a new server.ts utility to handle server-side Supabase connections
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Exported the createClient function that the API route is trying to import
export async function createClient() {
  // Awaiting cookies() is required in newer versions of Next.js
  const cookieStore = await cookies()

  // Configured createServerClient to manage Supabase auth securely via cookies
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // Updated cookie store with new session tokens when necessary
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored error if setAll is called from a Server Component
            // (Middleware usually handles the token refresh)
          }
        },
      },
    }
  )
}