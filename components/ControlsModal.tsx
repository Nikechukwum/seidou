'use client'

import { useState, useEffect, Dispatch, SetStateAction } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import type { BidMode } from '@/hooks/useBidControls'

// BIG SIS REQUEST: Controls modal — select how to bid

interface ControlsModalProps {
    isActive: boolean
    setIsActive: Dispatch<SetStateAction<boolean>>
    currentMode: BidMode
    onSave: (mode: BidMode) => void
}

export default function ControlsModal({ isActive, setIsActive, currentMode, onSave }: ControlsModalProps) {
    const [selected, setSelected] = useState<BidMode>(currentMode)

    useEffect(() => {
        if (isActive) setSelected(currentMode)
    }, [isActive, currentMode])

    const handleSave = () => {
        onSave(selected)
        setIsActive(false)
    }

    return (
        <Modal isActive={isActive} setIsActive={setIsActive}>
            <h2 className="text-xl font-bold text-[#111827] mb-1">Controls</h2>
            <p className="text-gray-500 text-sm mb-6">
                Select how you would like to bid.
            </p>

            <div className="flex flex-col gap-3 mb-8">
                {([
                    { value: 'increment' as const, label: 'Increment Buttons' },
                    { value: 'slider' as const, label: 'Slider' },
                    { value: 'voice' as const, label: 'Voice Mode' },
                ]).map((option) => (
                    <label
                        key={option.value}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                            selected === option.value
                                ? 'border-black bg-gray-50'
                                : 'border-gray-200 bg-white'
                        }`}
                    >
                        <div
                            className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                selected === option.value
                                    ? 'border-black'
                                    : 'border-gray-300'
                            }`}
                        >
                            {selected === option.value && (
                                <div className="size-2.5 rounded-full bg-black" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                            {option.label}
                        </span>
                        <input
                            type="radio"
                            name="bidMode"
                            value={option.value}
                            checked={selected === option.value}
                            onChange={() => setSelected(option.value)}
                            className="sr-only"
                        />
                    </label>
                ))}
            </div>

            <Button text="SAVE SETTINGS" classname="w-full py-3.5" onClick={handleSave} />
        </Modal>
    )
}
