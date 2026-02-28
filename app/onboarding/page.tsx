'use client'
import { INTERESTS } from '@/utils/defaults';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([]);

  const toggleInterest = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col bg-white px-6 py-8">
      
      {/* Back Button */}
      <button onClick={()=>{router.back()}} className="mb-5 w-fit text-gray-900 transition-opacity hover:opacity-60">
        <span className="material-symbols-outlined text-[28px]!">arrow_back</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Let's select your interests.
        </h1>
        <p className="mt-2 text-gray-500 font-medium">
          Please select two or more to proceed.
        </p>
      </div>

      {/* Interests Grid */}
      <div className="flex flex-wrap gap-3">
        {INTERESTS.map((interest) => {
          const isSelected = selected.includes(interest.id);
          
          return (
            <button
              key={interest.id}
              onClick={() => toggleInterest(interest.id)}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-full border
                ${isSelected 
                  ? `${interest.bg} ${interest.border}` 
                  : 'bg-white border-gray-100 hover:border-gray-300'}
              `}
            >
              <span className={`material-symbols-outlined text-[20px]! ${interest.color}`}>
                {interest.icon}
              </span>
              <span className={`text-[15px] font-semibold ${isSelected ? 'text-gray-800' : 'text-gray-500'}`}>
                {interest.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spacer to push button down */}
      <div className="grow" />

      {/* Continue Button */}
      <div className="mt-10">
        <button
          disabled={selected.length < 2}
          className="w-full rounded-[28px] bg-black py-4 text-center font-bold text-white shadow-lg shadow-blue-200 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
        >
          Continue
        </button>
      </div>
    </div>
  );
}