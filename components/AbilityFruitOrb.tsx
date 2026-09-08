'use client'

// BIG SIS REQUEST: the fruit artwork used on the Ability Fruits page, in the
// Learn More sheet and in the ability animations. Renders the original icon
// (background already cut out) with an optional coloured glow behind it.

import Image from 'next/image'
import { AbilityFruit } from '@/lib/abilityFruits'

type Props = {
    fruit: Pick<AbilityFruit, 'image' | 'name' | 'accent'>
    /** Rendered size in px. */
    size?: number
    /** Soft coloured halo behind the fruit, in the fruit's own accent. */
    glow?: boolean
    className?: string
    priority?: boolean
}

export default function AbilityFruitOrb({
    fruit,
    size = 64,
    glow = false,
    className = '',
    priority = false,
}: Props) {
    return (
        <div
            className={`relative shrink-0 ${className}`}
            style={{ width: size, height: size }}
        >
            {glow && (
                <span
                    className="absolute inset-0 rounded-full blur-md"
                    style={{ backgroundColor: fruit.accent.base, opacity: 0.35 }}
                />
            )}
            <Image
                src={fruit.image}
                alt={fruit.name}
                width={size}
                height={size}
                priority={priority}
                sizes={`${size}px`}
                className="relative h-full w-full object-contain drop-shadow-sm"
            />
        </div>
    )
}
