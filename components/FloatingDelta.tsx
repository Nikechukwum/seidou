'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

interface FloatingDeltaProps {
    amount: number
    type: 'increase' | 'decrease'
    trigger: number
}

export default function FloatingDelta({ amount, type, trigger }: FloatingDeltaProps) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (trigger === 0) return
        setVisible(true)
        const timeout = setTimeout(() => setVisible(false), 620)
        return () => clearTimeout(timeout)
    }, [trigger])

    if (!visible) return null

    const isIncrease = type === 'increase'
    const sign = isIncrease ? '+' : '-'
    const arrow = isIncrease ? '\u2191' : '\u2192'
    const color = isIncrease ? '#22C55E' : '#EF4444'
    const bgColor = isIncrease ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'
    const dashColor = isIncrease ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'

    return (
        <motion.div
            key={trigger}
            initial={{ opacity: 0, y: 0, x: 0 }}
            animate={{
                opacity: [0, 1, 1, 0],
                y: [0, -12, -34, -54],
                x: [0, 4, 10, 14],
            }}
            transition={{ duration: 0.75, ease: 'easeOut', times: [0, 0.15, 0.6, 1] }}
            className="absolute -top-1 left-full ml-2 whitespace-nowrap pointer-events-none z-10"
        >
            <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1, 0.6], opacity: [0, 0.6, 0.6, 0] }}
                transition={{ duration: 0.75, ease: 'easeOut', times: [0, 0.15, 0.6, 1] }}
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '100%',
                    height: 34,
                    borderLeft: `2px dashed ${dashColor}`,
                    transformOrigin: 'top',
                }}
            />
            <span
                style={{
                    display: 'inline-block',
                    color,
                    backgroundColor: bgColor,
                    borderRadius: 12,
                    padding: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: '20px',
                }}
            >
                {sign}{amount.toLocaleString()} {arrow}
            </span>
        </motion.div>
    )
}
