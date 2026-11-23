import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - _next/static, _next/image (build output)
     * - favicon.ico
     * - image files, and the catalogue image proxy (api/catalogue-image)
     * Auth cookies are irrelevant to those, and refreshing on each would
     * add a Supabase round-trip per asset.
     */
    '/((?!_next/static|_next/image|api/catalogue-image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
