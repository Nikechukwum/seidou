// ============================================================================
// ABILITY FRUITS CATALOG
// ----------------------------------------------------------------------------
//  tapping the "Ability Fruits" tab (or saying "activate
// ability fruit" in voice mode) opens the Ability Fruits page first. This is
// the single source of truth for what that page lists.
//
// Artwork lives in /public/ability-fruits — the original icons, background cut
// out. Two are shipped but unassigned: unassigned-pink-flame.png and
// unassigned-pink-flower.png.
//
// Only fruits with `available: true` are wired to real gameplay; the rest show
// a "coming soon" note when activated.
// ============================================================================

export type AbilityFruitId =
    | 'multiply'
    | 'divide'
    | 'swap'
    | 'shield'
    | 'freeze'
    | 'flame'
    | 'void'
    | 'thief'
    | 'mirror'
    | 'time'
    | 'copy'
    | 'clone'
    | 'restore'
    | 'negate'

export type AbilityFruit = {
    id: AbilityFruitId
    name: string
    /** One-line summary shown on the card. */
    tagline: string
    /** Long copy shown in the "Learn More" modal. */
    description: string
    /** Artwork in /public/ability-fruits. */
    image: string
    /**
     * Artwork used during the ability animation, when the design calls for a
     * different treatment than the catalog icon. Falls back to `image`.
     */
    animationImage?: string
    /** Accent colour pulled from the artwork — drives glows, particles, badges. */
    accent: {
        /** Core colour, hex. */
        base: string
        /** Lighter spark colour, hex. */
        spark: string
        /** Deeper colour for the cover panel, hex. */
        deep: string
    }
    /** True once the ability is actually playable on the table. */
    available: boolean
}

//  during the testing phase every user holds every fruit
// in this catalog, 10 uses each. Swap this for the real inventory once fruits are purchasable.
export const TESTING_PHASE_FRUIT_COUNT = 10

export const ABILITY_FRUITS: AbilityFruit[] = [
    {
        id: 'multiply',
        name: 'Multiply Multiply Fruit',
        tagline: "Multiplies your own bid by your fruit's level factor.",
        description:
            "Activate and your own bid on this table is multiplied straight away — there is nothing to pick. The factor comes from your fruit's level: x2 at level 1, rising to x3, x4 and x5 as it levels up. It cannot be used on other players, and if the result exceeds the max bid limit it is capped at the limit.",
        image: '/ability-fruits/multiply.png',
        // The design frames show the fruit in purple through the whole animation.
        animationImage: '/ability-fruits/multiply-purple.png',
        accent: { base: '#a855f7', spark: '#f5f3ff', deep: '#6b21a8' },
        available: true,
    },
    {
        id: 'divide',
        name: 'Divide Divide Fruit',
        tagline: "Cuts the #1 player's bid down by the selected divisor — it always hits first position.",
        description:
            "Activate and the fruit appears on your card, then travels across the table and lands on whoever currently holds first position. Their bid is split by the divisor (÷2, ÷3, ÷4) and rounded down, dropping them down the table. Only the #1 player's bid is affected.",
        image: '/ability-fruits/divide.png',
        accent: { base: '#a855f7', spark: '#e9d5ff', deep: '#6d28d9' },
        available: true,
    },
    {
        id: 'swap',
        name: 'Position Swap',
        tagline: 'Swaps you straight into the #1 spot by trading bids with the highest bidder.',
        description:
            "Activate and the fruit automatically locks onto whoever currently holds first position. Your two bids change hands — you take their top bid, they take yours — so you leap to the top of the table the moment it explodes. Only you and the holder of first place are affected, and if you already hold first position there is nothing to swap for.",
        image: '/ability-fruits/swap.png',
        accent: { base: '#16a34a', spark: '#bbf7d0', deep: '#14532d' },
        available: true,
    },
    {
        id: 'shield',
        name: 'Shield Shield Fruit',
        tagline: 'Creates a protective shield that blocks enemy attacks and theft.',
        description:
            'Wraps your position in a barrier for a short time. While the shield holds, abilities aimed at you — multiplies, freezes, thefts — bounce off and leave your bid untouched.',
        image: '/ability-fruits/shield.png',
        accent: { base: '#2563eb', spark: '#fcd34d', deep: '#1e3a8a' },
        available: false,
    },
    {
        id: 'freeze',
        name: 'Freeze Fruit',
        tagline: 'Prevents all other players from changing their bid amounts for 30 seconds. Only the activating player can still bid.',
        description:
            'Activate and the fruit freezes every OTHER player on the table: for 30 seconds nobody else can change their bid or use a fruit, while their cards wear a blue frozen border and anything they try is refused — a safe window to climb. You can still bid while the freeze holds. The Negate Fruit is the one exception: a frozen player holding it can negate the freeze off themselves. The blue borders fade when the timer hits zero.',
        image: '/ability-fruits/freeze.png',
        accent: { base: '#4DA6FF', spark: '#dbeafe', deep: '#1d4ed8' },
        available: true,
    },
    {
        id: 'copy',
        name: 'Copy Fruit',
        tagline: 'Copies any one of the last 3 ability fruits used on this table into your abilities.',
        description:
            "Activate and a picker opens listing the last ability fruits used on this table by anyone — up to three. Choose one and it is copied straight into your abilities: you can use it just like a normal fruit from then on. The Copy Fruit itself is consumed when the copy lands, and Copy Fruits can never be copied.",
        image: '/ability-fruits/flame.png',
        // The video's "copyability fruit" is a yellow spiky fruit with a stem
        // (durian-like). The artwork ships separately — drop it at
        // /public/ability-fruits/copy.png and it lights up everywhere.
        accent: { base: '#facc15', spark: '#fef08a', deep: '#a16207' },
        available: true,
    },
    {
        id: 'clone',
        name: 'Clone Fruit',
        tagline: 'Duplicates any ability fruit you own into 2 extra copies (x1 becomes x3).',
        description:
            "Activate and a carousel opens listing every ability fruit you currently hold. Pick one — Multiply, Position Swap, Steal, Restore, anything you own — and the tree buds 2 extra copies of it: x1 becomes x3, x2 becomes x4. You can clone any fruit you own except the Clone fruit itself, and the Clone fruit you used is consumed.",
        image: '/ability-fruits/flame.png',
        // The Clone fruit is the SAME yellow spiky durian-looking fruit as the
        // Copy fruit in the video. If there is only one piece of artwork, share
        // it: drop it at /public/ability-fruits/clone.png (copy of copy.png)
        // and it lights up everywhere.
        accent: { base: '#facc15', spark: '#fef08a', deep: '#a16207' },
        available: true,
    },
    // {
    //     id: 'flame',
    //     name: 'Flame Flame Fruit',
    //     tagline: 'Engulfs the target in flames, dealing damage over time.',
    //     description:
    //         'Sets a rival alight. Their bid burns down in small ticks for as long as the flames last, so the longer they ignore it, the more ground they lose.',
    //     image: '/ability-fruits/flame.png',
    //     accent: { base: '#f59e0b', spark: '#fef08a', deep: '#c2410c' },
    //     available: false,
    // },
    {
        id: 'void',
        name: 'Void Void Fruit',
        tagline: 'Creates a dark zone that absorbs energy and disables abilities.',
        description:
            'Opens a dead zone over the table. While it holds, no fruit can be activated by anyone — including you — so it is the counter to a table that has turned into an ability war.',
        image: '/ability-fruits/void.png',
        accent: { base: '#a8a29e', spark: '#f5f5f4', deep: '#57534e' },
        available: false,
    },
    {
        id: 'thief',
        name: 'Steal Bidding Currency',
        tagline: 'Drains 1,000 BC per second from every other player on the table.',
        description:
            "Steals 1,000 bidding currency per second from EVERY other player on the table — no aiming needed. The fruit locks on automatically and runs a 60-second countdown, then slams all the stolen BC straight onto your bid. Players whose balance runs out mid-countdown stop being drained, and anyone left at zero keeps no take.",
        // ARTWORK (design, Negate walkthrough): "the picture we are using for
        // the steal fruit is the negate fruit — you can just swap them." Done:
        // the red swirl orb that used to sit here belongs to NEGATE and now
        // lives at /ability-fruits/negate.png, and this is Steal's own
        // turquoise-and-gold orb from the design canvas.
        image: '/ability-fruits/thief.png',
        accent: { base: '#a855f7', spark: '#f5f3ff', deep: '#6b21a8' },
        available: true,
    },
    {
        id: 'mirror',
        name: 'Mirror Mirror Fruit',
        tagline: 'Reflects the next ability used on you back at its caster.',
        description:
            'Holds a reflective surface over your position. The next fruit aimed at you is sent straight back to the player who threw it, at full strength.',
        image: '/ability-fruits/freeze.png',
        accent: { base: '#14b8a6', spark: '#fde68a', deep: '#115e59' },
        available: false,
    },
    {
        id: 'time',
        name: 'Time Time Fruit',
        tagline: 'Rewinds the table to how it stood a moment ago.',
        description:
            'Turns the clock back on the leaderboard, undoing the most recent round of bids and abilities. Everything that happened in that window is wiped — including your own moves.',
        image: '/ability-fruits/time.png',
        accent: { base: '#eab308', spark: '#fef9c3', deep: '#a16207' },
        available: false,
    },
    {
        id: 'negate',
        name: 'Negate Fruit',
        tagline: 'Cancels the last ability fruit used on you and puts your bid back.',
        description:
            "Activate and the fruit cancels the most recent ability fruit effect that hit you — a divide, a steal, a swap, a freeze — and restores your bid to exactly what it was before that effect landed. It only ever undoes the LAST effect, it does not shield you from anything that comes next, and it cannot be used when nothing has been done to you. After use the fruit needs a short cooldown before it can be eaten again.",
        // The red swirl orb from the design canvas — this artwork is Negate's
        // alone; Steal used to borrow it (see the note on the thief entry).
        image: '/ability-fruits/negate.png',
        // The sequence frames show the fruit in magenta the whole way through,
        // the way Multiply runs purple and Restore runs teal.
        animationImage: '/ability-fruits/negate-pink.png',
        accent: { base: '#ec4899', spark: '#fce7f3', deep: '#9d174d' },
        available: true,
    },
    {
        id: 'restore',
        name: 'Restore Fruit',
        tagline: 'Gives back the ability fruits you used and the bidding currency you spent.',
        description:
            "Activate and the fruit explodes on your card, rewinding your own recent moves: every ability fruit you have used in this auction returns to your inventory, and the bidding currency you committed is paid back into your wallet (your bid leaves the table). A summary shows exactly what came back. It affects nobody else — no other player's bid changes — and it cannot be used when you have nothing to restore.",
        image: '/ability-fruits/restore.png',
        // The sequence frames show the fruit as a teal energy orb, so the
        // animation swaps to the teal treatment the way Multiply does.
        animationImage: '/ability-fruits/restore-teal.png',
        accent: { base: '#14b8a6', spark: '#ccfbf1', deep: '#134e4a' },
        available: true,
    },
]

export function getAbilityFruit(id: string): AbilityFruit | undefined {
    return ABILITY_FRUITS.find((f) => f.id === id)
}

// ----------------------------------------------------------------------------
// COPY FRUIT — coppable set
// ----------------------------------------------------------------------------
// The Copy Fruit can hand the player any PLAYABLE fruit except itself (edge
// case: "Cannot copy another Copy Fruit"). Mirror of the `v_coppable` array in
// supabase/landwars_copy_fruit.sql — keep the two in step.
export const COPYABLE_FRUIT_IDS = ABILITY_FRUITS.filter(
    (f) => f.available && f.id !== 'copy'
).map((f) => f.id) as AbilityFruitId[]

// ----------------------------------------------------------------------------
// CLONE FRUIT — clonable set
// ----------------------------------------------------------------------------
// The Clone Fruit can duplicate any PLAYABLE fruit except ITSELF (edge case:
// "prevent infinite loop" — the Clone fruit can never be cloned). Note the
// Copy fruit IS clonable here: it is a different fruit. Mirror of the
// `v_clonable` array in supabase/landwars_clone_fruit.sql — keep in step.
export const CLONABLE_FRUIT_IDS = ABILITY_FRUITS.filter(
    (f) => f.available && f.id !== 'clone'
).map((f) => f.id) as AbilityFruitId[]

// ----------------------------------------------------------------------------
// FRUIT LEVELS
// ----------------------------------------------------------------------------
// DEV NOTE (design): "Multiply factor is based on the fruit's level
// (e.g. x2, x3, x4, x5)." There is no factor picker — activating the fruit
// uses whatever level the player's fruit is at.
//
// TESTING PHASE: every player sits at level 1, so Activate always fires x2.
// Swap CURRENT_FRUIT_LEVEL for the player's real level once levelling exists.
export const MULTIPLY_LEVEL_FACTORS = [2, 3, 4, 5] as const

export type MultiplyFactor = (typeof MULTIPLY_LEVEL_FACTORS)[number]

export const CURRENT_FRUIT_LEVEL = 1

export function multiplyFactorForLevel(level: number): MultiplyFactor {
    const idx = Math.min(Math.max(level, 1), MULTIPLY_LEVEL_FACTORS.length) - 1
    return MULTIPLY_LEVEL_FACTORS[idx]
}

/** The factor Activate fires with right now. */
export const MULTIPLY_FACTOR = multiplyFactorForLevel(CURRENT_FRUIT_LEVEL)

// ----------------------------------------------------------------------------
// DIVIDE LEVELS
// ----------------------------------------------------------------------------
// Same levelling idea as Multiply, but the level controls the DIVISOR:
// ÷2 at level 1 (default), rising to ÷3 and ÷4 as the fruit levels up.
export const DIVIDE_LEVEL_FACTORS = [2, 3, 4] as const

export type DivideFactor = (typeof DIVIDE_LEVEL_FACTORS)[number]

export function divideFactorForLevel(level: number): DivideFactor {
    const idx = Math.min(Math.max(level, 1), DIVIDE_LEVEL_FACTORS.length) - 1
    return DIVIDE_LEVEL_FACTORS[idx]
}

/** The divisor Activate fires with right now. */
export const DIVIDE_FACTOR = divideFactorForLevel(CURRENT_FRUIT_LEVEL)

// ----------------------------------------------------------------------------
// STEAL (BIDDING CURRENCY) SETTINGS
// ----------------------------------------------------------------------------
// While the fruit's 60-second countdown runs, EVERY other player on the table
// is drained STEAL_PER_SECOND per second. STEAL_FRUIT_AMOUNT is the most any
// single player can lose (the full 60 seconds). Players whose balance runs out
// before the timer hits zero stop being drained and lose their red border.
export const STEAL_PER_SECOND = 1_000
export const STEAL_FRUIT_DURATION_S = 60
export const STEAL_FRUIT_AMOUNT = STEAL_FRUIT_DURATION_S * STEAL_PER_SECOND


// ----------------------------------------------------------------------------
// FREEZE SETTINGS
// ----------------------------------------------------------------------------
// DEV NOTES (design, Freeze sheet + video):
//   - The freeze holds for FREEZE_FRUIT_DURATION_S (30s), shown by the
//     countdown timer hanging below the fruit on the activator's card.
//   - On activation a BLUE pulse (FREEZE_PULSE_MS) spreads out of the
//     activator's card as a RADIAL WAVE that travels over ALL the other cards
//     — the sheet draws concentric rings crossing the whole table, not a badge
//     on one card — then every OTHER player's card wears a FREEZE_BORDER_COLOR
//     frozen border + glow until the timer hits zero. The activator's card
//     NEVER gets the border.
//   - Frozen players cannot change their bid and cannot use fruits — enforced
//     server-side by the fruit RPCs (see supabase/landwars_freeze_bid.sql).
//     The Negate Fruit is the exception: it stays usable while frozen and
//     releases the player who negates the freeze.
//   - The blue borders fade out smoothly over FREEZE_FADE_MS.
export const FREEZE_FRUIT_DURATION_S = 30
// Design sheet, NOTES FOR DEV: "radial wave from activator to all other cards
// (~600ms)" and "when duration ends, fade borders out smoothly (~400ms)".
export const FREEZE_PULSE_MS = 600
export const FREEZE_FADE_MS = 400
// Design sheet: "use blue border (#3DA5FF) with subtle glow for frozen state".
export const FREEZE_BORDER_COLOR = '#3DA5FF'


// ----------------------------------------------------------------------------
// FRUIT COOLDOWNS
// ----------------------------------------------------------------------------
// DEV NOTE (design, Negate sheet): "Negate Fruit has a cooldown (e.g., 15-20s)."
// Every ability fruit now shares the same rule — after a fruit fires you must
// wait FRUIT_COOLDOWN_S (20s) before the SAME fruit can fire again on that
// table. Casting Multiply does not lock Divide; only the fruit you just used
// cools down.
//
// Enforced server-side by every fruit RPC via public.assert_fruit_cooldown /
// public.bump_fruit_cooldown (see supabase/landwars_fruit_cooldowns.sql), and
// surfaced client-side by the /api/landwars/fruit-cooldown read. Keep the SQL
// side and this constant in step.
export const FRUIT_COOLDOWN_S = 20

// Negate's own cooldown is simply the shared one.
export const NEGATE_COOLDOWN_S = FRUIT_COOLDOWN_S

/** Effects the stack records, and therefore what Negate can undo. */
export type NegatableEffect = 'multiply' | 'divide' | 'swap' | 'thief' | 'freeze'

/** How the negated effect is named in the status pill and the toast. */
export const NEGATE_EFFECT_LABELS: Record<NegatableEffect, string> = {
    multiply: 'Multiply',
    divide: 'Divide',
    swap: 'Position Swap',
    thief: 'Steal Bidding Currency',
    freeze: 'Freeze Fruit',
}

export function negateEffectLabel(type: string | null | undefined): string {
    return NEGATE_EFFECT_LABELS[type as NegatableEffect] ?? 'the last effect'
}
