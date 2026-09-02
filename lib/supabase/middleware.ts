import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase auth token on every navigation.
 *
 * Server Components cannot write cookies, so `lib/supabase/server.ts`
 * swallows its `setAll` error and relies on this running first — see the
 * comment in that file. Without it the access token silently expires after
 * about an hour: the browser still looks signed in (the Redux user is
 * populated from a stale local session) while every server-side read sees
 * an anonymous request.
 *
 * Deliberately refresh-only — no redirects. Seidou gates routes on the
 * client via `useAuth().checkSession()`, and adding server redirects here
 * would change the behaviour of every existing commerce route.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not put any logic between createServerClient and getUser(). This call
  // is what performs the refresh, and anything in between risks returning a
  // response whose cookies no longer match the refreshed session.
  await supabase.auth.getUser()

  // Must be returned as-is. Building a different response object without
  // copying these cookies across would terminate the user's session.
  return supabaseResponse
}
