// ============================================================================
// CATALOGUE PRODUCTS — products imported into Supabase (table
// public.catalogue_products, e.g. the ASOS import) shown next to the Sanity
// products on the Explore pages.
// ----------------------------------------------------------------------------
// The import's own `category` column holds the brand or the ASOS page title
// ("Mango", "Shop Women's ASOS New In ..."), not a shop category. So each
// product is placed in a Sanity category by keywords in its title (RULES).
// A product that matches no rule, or has no price, is not shown.
//
// Catalogue ids are prefixed with CATALOGUE_ID_PREFIX so the product popup
// (components/ProductInfo.tsx) and the cart can tell them apart from Sanity ids.
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import type { CategoryProduct } from '@/types'

/** Naira per British pound used to show GBP prices in ₦. Change it here only. */
export const GBP_TO_NGN = 2000

export const CATALOGUE_ID_PREFIX = 'cat_'

export const isCatalogueId = (id: string | null | undefined): id is string =>
    !!id && id.startsWith(CATALOGUE_ID_PREFIX)

/**
 * Title keywords -> Sanity category slug (see /explore). Checked top to
 * bottom; the FIRST match wins, so the order matters: "shirt dress" must hit
 * dresses before shirts, "heeled sandal" heels before sandals, and a "jeans
 * belt" must be skipped before the jeans rule. `null` = not shown anywhere.
 */
const RULES: [slug: string | null, pattern: RegExp][] = [
    ['dresses', /\bdress\b/i],
    ['skirts', /\b(skirt|skort)\b/i],
    // accessories with no women's category yet (scarves, belts, bras, ...)
    [null, /(?<!with )\b(scarf|gloves|headband|snood|bra|nipple covers|belt|laptop case)( in\b|$)/i],
    ['jeans-j', /\bjeans?\b/i],
    ['shorts', /\b(shorts|mini short|bermuda)\b/i],
    ['pants', /\b(trousers?|flares|leggings)\b/i],
    ['heels', /\b(heel|heeled|court shoe|slingback|slinkgback|mule)\b/i],
    ['sandals', /\bsandals?\b/i],
    ['flats', /\b(flat boot|slip-on|trainers|boots?)\b/i],
    ['crossbody-bag-w', /\bcross ?body\b/i],
    ['tote-bags', /\btote\b/i],
    ['clutch-bags', /\bclutch\b/i],
    ['shoulder-bags', /\b(shoulder bag|handbag|bucket bag)\b/i],
    ['hats', /\bhat\b/i],
    ['knitwear', /\b(jumper|cardigan|knitted)\b/i],
    ['crop-tops', /\b(crop top|cropped top|cami)\b/i],
    ['sleeve-tops', /\b(t-shirt|top|bodysuit)\b/i],
    ['shirts-and-blouses', /\b(shirt|blouse)\b/i],
]

/** The Sanity category slug a catalogue product belongs to, or null. */
export function catalogueCategory(title: string): string | null {
    for (const [slug, pattern] of RULES) {
        if (pattern.test(title)) return slug
    }
    return null
}

/** Price in ₦, rounded to the nearest ₦100. */
function toNaira(price: number, currency: string | null): number {
    const naira = currency === 'GBP' ? price * GBP_TO_NGN : price
    return Math.round(naira / 100) * 100
}

/**
 * ASOS image links ask for a 1926px-wide image. Images are no longer resized
 * by Vercel (next.config.ts `unoptimized`), so ask ASOS for a smaller one.
 * ASOS does not answer Nigerian connections, so the image is loaded through
 * our own proxy (app/api/catalogue-image/route.ts), which Vercel caches.
 */
export function catalogueImage(url: string, width = 640): string {
    if (!url.includes('asos-media.com')) return url
    const sized = url
        .replace(/\$n_\d+w\$/, `$n_${width}w$`)
        .replace(/([?&])wid=\d+/, `$1wid=${width}`)
    return `/api/catalogue-image?src=${encodeURIComponent(sized)}`
}

type CatalogueRow = {
    id: string
    title: string
    brand: string | null
    channel_name: string | null
    description: string | null
    price: number | null
    currency: string | null
    image_url: string | null
    images: string[] | null
}

const COLUMNS = 'id,title,brand,channel_name,description,price,currency,image_url,images'

function toProduct(row: CatalogueRow, imageWidth: number) {
    const images = (row.images?.length ? row.images : row.image_url ? [row.image_url] : [])
        .map((url) => ({ url: catalogueImage(url, imageWidth), lqip: '' }))
    return {
        _id: `${CATALOGUE_ID_PREFIX}${row.id}`,
        title: row.title,
        defaultProductVariant: {
            price: toNaira(row.price ?? 0, row.currency),
            images,
        },
    }
}

/** Priced catalogue products whose title puts them in `slug`. */
export async function fetchCatalogueProducts(slug: string, categoryTitle: string): Promise<CategoryProduct[]> {
    const { data, error } = await createClient()
        .from('catalogue_products')
        .select(COLUMNS)
        .not('price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000)
    if (error) throw error
    return (data as CatalogueRow[])
        .filter((row) => catalogueCategory(row.title) === slug)
        .map((row) => ({ ...toProduct(row, 640), categoryTitle }))
}

/**
 * One catalogue product in the same shape the product popup gets from
 * Sanity, with up to 10 more products of the same brand.
 */
export async function fetchCatalogueProduct(id: string) {
    const supabase = createClient()
    const { data: row, error } = await supabase
        .from('catalogue_products')
        .select(COLUMNS)
        .eq('id', id.slice(CATALOGUE_ID_PREFIX.length))
        .maybeSingle<CatalogueRow>()
    if (error) throw error
    if (!row) return null

    const brand = row.brand ?? row.channel_name ?? 'ASOS'
    const { data: more, count } = await supabase
        .from('catalogue_products')
        .select(COLUMNS, { count: 'exact' })
        .eq('brand', brand)
        .neq('id', row.id)
        .not('price', 'is', null)
        .limit(10)

    return {
        ...toProduct(row, 1080),
        description: row.description,
        vendor: { title: brand, logo: null, _id: null },
        moreFromVendor: ((more ?? []) as CatalogueRow[]).map((r) => toProduct(r, 400)),
        vendorProductCount: count ?? 0,
    }
}
