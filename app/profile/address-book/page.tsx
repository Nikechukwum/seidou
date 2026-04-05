'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { RootState } from '@/redux/store'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowLeftIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { PartialUpdateUser, UpdateUser, UserState } from '@/redux/authSlice'

export default function AddressBookPage() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const dispatch = useDispatch()

    const { user } = useSelector(
        (state: RootState) => state.auth
    );

  const [profile, setProfile] = useState({
    addressLine1: user?.address_line1,
    addressLine2: user?.address_line2,
    state: user?.state
  })

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const updates = Object.fromEntries(formData)

    const { error } = await supabase
      .from('users')
      .upsert({
        id: user?.id,
        ...updates,
        updated_at: new Date().toISOString(),
      })

    setLoading(false)
    if (error) setError(error.message)
    else {
        dispatch(PartialUpdateUser(updates as Partial<UserState>));
        setSuccess('Address updated successfully')
    }
    window.scrollTo({top: 0, behavior: 'smooth'})
  }

  return (
    <div className="py-24">
    {/* Header */}
    <div className="fixed top-0 left-0 bg-white shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-[#f0f0f0]">
        <button onClick={()=>{router.back()}} className="absolute text-black top-1/2 left-3 -translate-y-1/2 p-2">
            <ArrowLeftIcon className='size-5' strokeWidth={3} /> 
        </button>
        Address Book
    </div>

    <div className='px-6'>
        {error && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold my-4 text-sm text-red-600 bg-red-50 ring-1 ring-red-600 rounded-full px-3 py-2'>
        <ExclamationCircleIcon className='size-5.5 shrink-0'/> {error}
        </p>}
        {success && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold my-4 text-sm text-green-600 bg-green-50 ring-1 ring-green-600 rounded-full px-3 py-2'>
            <CheckCircleIcon className='size-5.5 shrink-0'/> {success}
        </p>}

        <form onSubmit={handleUpdate} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-400 uppercase">Address Line 1</label>
                <input 
                    name="address_line1"
                    required
                    defaultValue={profile.addressLine1}
                    className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 uppercase">Address Line 2</label>
                <input 
                    name="address_line2"
                    defaultValue={profile.addressLine2}
                    className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 uppercase">State</label>
                <input 
                    name="state"
                    required
                    disabled
                    defaultValue={profile.state}
                    className="w-full font-medium border-b border-gray-300 text-gray-400 py-2 focus:border-black outline-none"
                />
            </div>

            <div className="px-3 w-full h-fit mt-10">
                <button type='submit' disabled={loading} className="w-full bg-black font-bold p-3 rounded-lg grid place-content-center text-white">
                    {loading ? 'Updating...' : 'Update Address'}
                </button>
            </div>
        </form>
    </div>

    </div>
  )
}