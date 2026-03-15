'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { RootState } from '@/redux/store'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowLeftIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { PartialUpdateUser, UpdateUser, UserState } from '@/redux/authSlice'

export default function MyDetailsPage() {
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
    firstname: user?.firstname,
    lastname: user?.lastname,
    phone: user?.phone,
    dob: user?.dob,
    gender: user?.gender
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
        setSuccess('Details updated successfully!')
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
        My Details
    </div>

    <div className='px-6'>
        {error && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold my-4 text-sm text-red-600 bg-red-50 ring-1 ring-red-600 rounded-full px-3 py-2'>
        <ExclamationCircleIcon className='size-5.5 shrink-0'/> {error}
        </p>}
        {success && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold my-4 text-sm text-green-600 bg-green-50 ring-1 ring-green-600 rounded-full px-3 py-2'>
            <CheckCircleIcon className='size-5.5 shrink-0'/> {success}
        </p>}

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

            {/* Email - Read Only (Auth handled) */}
            <div>
            <label className="block text-sm font-medium text-gray-400 uppercase">Email Address</label>
            <input 
                type="email" 
                value={user?.email} 
                disabled 
                className="w-full font-medium border-b border-gray-200 py-2 text-gray-400 cursor-not-allowed"
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

            {/* Gender Selection */}
            <div>
            <label className="block font-medium text-gray-400 uppercase mb-3">Gender</label>
            <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    name="gender" 
                    value="male" 
                    defaultChecked={profile.gender === 'male'}
                    className="w-5 h-5 accent-black mr-3" 
                />
                <span className="text-sm font-medium">Male</span>
                </label>
                <label className="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    name="gender" 
                    value="female" 
                    defaultChecked={profile.gender === 'female'}
                    className="w-5 h-5 accent-black mr-3" 
                />
                <span className="text-sm font-medium">Female</span>
                </label>
            </div>
            </div>

            <div className="px-3 w-full h-fit mt-10">
                <button type='submit' disabled={loading} className="w-full bg-black font-bold p-3 rounded-lg grid place-content-center text-white">
                    {loading ? 'Updating...' : 'Update Details'}
                </button>
            </div>
        </form>
    </div>

    </div>
  )
}