'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { RootState } from '@/redux/store'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { PartialUpdateUser, UserState } from '@/redux/authSlice'
import { showToast } from '@/redux/toastSlice'

export default function MyDetailsPage() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()
    const dispatch = useDispatch()

    const { user } = useSelector(
        (state: RootState) => state.auth
    );

  const [profile, setProfile] = useState({
    firstname: user?.firstname,
    lastname: user?.lastname,
    username: user?.username,
    phone: user?.phone,
    dob: user?.dob,
    address_line1: user?.address_line1,
    address_line2: user?.address_line2,
    state: user?.state ?? 'Lagos',
    gender: user?.gender
  })

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const updates = Object.fromEntries(formData)

    const username = String(updates.username || '').trim()
    if (username) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user?.id)
        .maybeSingle()

      if (existing) {
        setLoading(false)
        dispatch(showToast({ type: 'error', message: 'Username already taken' }))
        return
      }
    }

    const { error } = await supabase
      .from('users')
      .upsert({
        id: user?.id,
        ...updates,
        username: username || null,
        updated_at: new Date().toISOString(),
      })

    setLoading(false)
    if (error) dispatch(showToast({ type: 'error', message: error.message }))
    else {
        dispatch(PartialUpdateUser({ ...updates, username: username || null } as Partial<UserState>));
        dispatch(showToast({ type: 'success', message: 'Details updated successfully' }))
    }
  }

  return (
    <div className="py-24">
    {/* Header */}
    <div className="fixed top-0 left-0 bg-white shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-[#f0f0f0]">
        <button onClick={()=>{router.back()}} className="absolute text-black top-1/2 left-3 -translate-y-1/2 p-2">
            <ArrowLeftIcon className='size-5' strokeWidth={3} /> 
        </button>
        My Details
    </div>

    <div className='px-6'>
        <form onSubmit={handleUpdate} className="space-y-6">
            {/* First Name */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">First Name</label>
            <input 
                name="firstname"
                required
                defaultValue={profile.firstname}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none transition-colors"
            />
            </div>

            {/* Last Name */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Last Name</label>
            <input 
                name="lastname"
                required
                defaultValue={profile.lastname}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* Username */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Username</label>
            <input 
                name="username"
                defaultValue={profile.username}
                placeholder="e.g. toby"
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* Email - Read Only (Auth handled) */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Email Address</label>
            <input 
                type="email" 
                value={user?.email} 
                disabled 
                className="w-full font-medium border-b border-gray-200 py-2 text-black cursor-not-allowed"
            />
            </div>

            {/* Phone Number */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Phone Number</label>
            <input 
                name="phone"
                required
                defaultValue={profile.phone}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* Date of Birth */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Date of Birth</label>
            <input 
                type="date"
                name="dob"
                required
                defaultValue={profile.dob}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none bg-transparent"
            />
            </div>

            {/* Address Line 1 */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Address Line 1</label>
            <input 
                name="address_line1"
                defaultValue={profile.address_line1}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* Address Line 2 */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Address Line 2</label>
            <input 
                name="address_line2"
                defaultValue={profile.address_line2}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* State */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">State</label>
            <input 
                name="state"
                defaultValue={profile.state}
                className="w-full font-medium border-b border-gray-300 py-2 focus:border-black outline-none"
            />
            </div>

            {/* Gender Selection */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase mb-3">Gender</label>
            <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    name="gender" 
                    value="male" 
                    defaultChecked={profile.gender === 'male'}
                    className="w-5 h-5 accent-black mr-3" 
                />
                <span className="font-medium">Male</span>
                </label>
                <label className="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    name="gender" 
                    value="female" 
                    defaultChecked={profile.gender === 'female'}
                    className="w-5 h-5 accent-black mr-3" 
                />
                <span className="font-medium">Female</span>
                </label>
            </div>
            </div>

            <div className="px-3 w-full h-fit mt-10">
                <button type='submit' disabled={loading} className="w-full bg-black font-bold p-3 rounded-full grid place-content-center text-white">
                    {loading ? 'Updating...' : 'Update Details'}
                </button>
            </div>
        </form>
    </div>

    </div>
  )
}
