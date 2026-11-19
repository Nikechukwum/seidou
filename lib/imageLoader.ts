// ============================================================================
// IMAGE LOADER — used by every next/image <Image> (see next.config.ts).
// ----------------------------------------------------------------------------
// Why: by default every <Image> is resized by Vercel's Image Optimization,
// which has a monthly quota. Once it ran out, Vercel answered every image with
// 402 "OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED" and product photos broke.
//
// What it does instead:
//   - Sanity images (cdn.sanity.io): Sanity resizes them itself, for free —
//     ?w (width) + q (quality) + auto=format (WebP/AVIF when the browser
//     takes it) + fit=max (never upscale past the original).
//   - Everything else (our own /public files, Mux, YouTube, Supabase, ...):
//     served as-is, straight from where it lives.
// Nothing goes through Vercel's optimizer any more, so the quota can't break
// images again.
// ============================================================================

type LoaderArgs = { src: string; width: number; quality?: number }

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
    if (src.startsWith('https://cdn.sanity.io/')) {
        const url = new URL(src)
        url.searchParams.set('w', String(width))
        url.searchParams.set('q', String(quality ?? 75))
        url.searchParams.set('auto', 'format')
        url.searchParams.set('fit', 'max')
        return url.toString()
    }
    return src
}
