// ============================================================================
// ABILITY FRUITS CATALOG
// ----------------------------------------------------------------------------
// BIG SIS REQUEST: tapping the "Ability Fruits" tab (or saying "activate
// ability fruit" in voice mode) opens the Ability Fruits page first. This is
// the single source of truth for what that page lists.
//
// Artwork lives in /public/ability-fruits — the original icons, background cut
// out. Two more are shipped but unassigned: unassigned-pink-flame.png and
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

// BIG SIS REQUEST: during the testing phase every user holds all 10 fruits,
// 10 uses each. Swap this for the real inventory once fruits are purchasable.
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
        name: 'Swap-Swap Fruit',
        tagline: 'Allows you to swap your position with another player.',
        description:
            'Trade places on the leaderboard with any player you target. Your bid and theirs change hands, so a well-timed swap can take you straight to the top of the table.',
        image: '/ability-fruits/swap.png',
        accent: { base: '#14b8a6', spark: '#fcd34d', deep: '#0f766e' },
        available: false,
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
        name: 'Freeze Freeze Fruit',
        tagline: 'Freezes your target, preventing them from taking actions for a short time.',
        description:
            'Locks one player out of the table for a short window. They cannot raise their bid or use a fruit until the ice melts, which buys you room to climb past them.',
        image: '/ability-fruits/freeze.png',
        accent: { base: '#38bdf8', spark: '#e0f2fe', deep: '#0369a1' },
        available: false,
    },
    {
        id: 'flame',
        name: 'Flame Flame Fruit',
        tagline: 'Engulfs the target in flames, dealing damage over time.',
        description:
            'Sets a rival alight. Their bid burns down in small ticks for as long as the flames last, so the longer they ignore it, the more ground they lose.',
        image: '/ability-fruits/flame.png',
        accent: { base: '#f59e0b', spark: '#fef08a', deep: '#c2410c' },
        available: false,
    },
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
        name: 'Thief Thief Fruit',
        tagline: "Steals a slice of a rival's bid and adds it to yours.",
        description:
            "Lifts a percentage of one player's bid and moves it onto your own. Blocked outright by the Shield Shield Fruit, so check the table before you reach.",
        image: '/ability-fruits/thief.png',
        accent: { base: '#dc2626', spark: '#fecaca', deep: '#7f1d1d' },
        available: false,
    },
    {
        id: 'mirror',
        name: 'Mirror Mirror Fruit',
        tagline: 'Reflects the next ability used on you back at its caster.',
        description:
            'Holds a reflective surface over your position. The next fruit aimed at you is sent straight back to the player who threw it, at full strength.',
        image: '/ability-fruits/mirror.png',
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
]

export function getAbilityFruit(id: string): AbilityFruit | undefined {
    return ABILITY_FRUITS.find((f) => f.id === id)
}

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
