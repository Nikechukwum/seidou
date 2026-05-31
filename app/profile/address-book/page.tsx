'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { RootState } from '@/redux/store'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { PartialUpdateUser, UpdateUser, UserState } from '@/redux/authSlice'
import { showToast } from '@/redux/toastSlice'
import { Header } from '@/components/Header'

export default function AddressBookPage() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()
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
    if (error) dispatch(showToast({ type: 'error', message: error.message }))
    else {
        dispatch(PartialUpdateUser(updates as Partial<UserState>));
        dispatch(showToast({ type: 'success', message: 'Address updated successfully' }))
    }
  }

  return (
    <div className="py-24">
    <Header pageTitle='Address Book'/>
    <div className='px-6'>
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