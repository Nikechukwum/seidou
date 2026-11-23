import { NextRequest } from 'next/server'

// ============================================================================
// GET /api/catalogue-image?src=<ASOS image url> — image proxy for the
// Supabase catalogue products (lib/catalogue.ts).
// ----------------------------------------------------------------------------
// ASOS's image server does not answer requests from Nigerian connections (it
// hangs), but answers Vercel's servers. So the image is fetched here and
// passed on. Vercel's CDN caches the answer (s-maxage), so each image is
// fetched from ASOS about once, not once per visitor.
//
// Only ALLOWED_HOSTS can be fetched, so this cannot be used as an open proxy.
// ============================================================================

const ALLOWED_HOSTS = new Set(['images.asos-media.com'])
const ONE_YEAR = 60 * 60 * 24 * 365

export async function GET(request: NextRequest) {
    const src = request.nextUrl.searchParams.get('src')
    let url: URL
    try {
        url = new URL(src ?? '')
    } catch {
        return new Response('Bad image url', { status: 400 })
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
        return new Response('Image host not allowed', { status: 400 })
    }

    let upstream: Response
    try {
        upstream = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
                Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        })
    } catch {
        return new Response('Image server did not answer', { status: 504 })
    }

    const type = upstream.headers.get('content-type') ?? ''
    if (!upstream.ok || !type.startsWith('image/')) {
        return new Response('Image not found', { status: 502 })
    }

    return new Response(upstream.body, {
        headers: {
            'Content-Type': type,
            'Cache-Control': `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`,
        },
    })
}
