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
import type { CategoryProduct, HomeProduct } from '@/types'

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
 * by Vercel (next.config.ts `unoptimized`), so lists ask ASOS for a 640px one.
 * ASOS only accepts its own size presets: $n_640w$ and the original $n_1920w$
 * work, while 828 and 1080 answer 400 Bad Request (tested 24 Nov 2026). So
 * the only choices are 'small' (640px) and 'large' (the original link).
 *
 * ASOS does not answer Nigerian connections, so the image is loaded through
 * our own proxy (app/api/catalogue-image/route.ts), which Vercel caches.
 */
export function catalogueImage(url: string, size: 'small' | 'large' = 'small'): string {
    if (!url.includes('asos-media.com')) return url
    const sized = size === 'large' ? url : url
        .replace(/\$n_\d+w\$/, '$n_640w$')
        .replace(/([?&])wid=\d+/, '$1wid=640')
    return `/api/catalogue-image?src=${encodeURIComponent(sized)}`
}

/** The shop name to show for a catalogue product: the channel ("ASOS"), not the brand. */
const channelOf = (row: CatalogueRow) => row.channel_name ?? row.brand ?? 'ASOS'

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

function toProduct(row: CatalogueRow, imageSize: 'small' | 'large') {
    const images = (row.images?.length ? row.images : row.image_url ? [row.image_url] : [])
        .map((url) => ({ url: catalogueImage(url, imageSize), lqip: '' }))
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
        .map((row) => ({ ...toProduct(row, 'small'), categoryTitle }))
}

/**
 * Every priced catalogue product for the Home feed (app/page.tsx), shaped
 * like the feed's Sanity products. With `slugs`, only products whose title
 * puts them in one of those categories; without, all of them.
 */
export async function fetchCatalogueFeed(slugs: string[] | null): Promise<HomeProduct[]> {
    const { data, error } = await createClient()
        .from('catalogue_products')
        .select(COLUMNS)
        .not('price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000)
    if (error) throw error
    return (data as CatalogueRow[])
        .filter((row) => {
            if (!slugs) return true
            const slug = catalogueCategory(row.title)
            return slug !== null && slugs.includes(slug)
        })
        .map((row) => ({
            ...toProduct(row, 'small'),
            slug: { current: '', title: row.title },
            // no logo or vendor page: the feed card shows the channel's initial
            vendor: { title: channelOf(row), _id: '', logo: null },
        }) as unknown as HomeProduct)
}

/**
 * One catalogue product in the same shape the product popup gets from
 * Sanity, with up to 10 more products from the same channel (e.g. ASOS).
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

    // "More from this vendor" = more from the same channel (ASOS)
    const channel = channelOf(row)
    let moreQuery = supabase
        .from('catalogue_products')
        .select(COLUMNS, { count: 'exact' })
        .neq('id', row.id)
        .not('price', 'is', null)
        .limit(10)
    moreQuery = row.channel_name ? moreQuery.eq('channel_name', row.channel_name) : moreQuery.eq('brand', channel)
    const { data: more, count } = await moreQuery

    return {
        ...toProduct(row, 'large'),
        description: row.description,
        vendor: { title: channel, logo: null, _id: null },
        moreFromVendor: ((more ?? []) as CatalogueRow[]).map((r) => toProduct(r, 'small')),
        vendorProductCount: count ?? 0,
    }
}
