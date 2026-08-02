'use client'
import { IconListItem } from '@/components/IconListItem';
import { createClient } from '@/lib/supabase/client';
import { ClearUser } from '@/redux/authSlice';
import { RootState } from '@/redux/store';
import { 
  UserIcon, 
  MapPinIcon, 
  WalletIcon, 
  QuestionMarkCircleIcon, 
  Cog6ToothIcon, 
  ChevronRightIcon,
  ArrowLeftStartOnRectangleIcon, 
} from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const dispatch = useDispatch()

  const { user } = useSelector(
        (state: RootState) => state.auth
    );

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error logging out:', error.message)
    } else {
      dispatch(ClearUser())
      router.push('/signin')
    }
  }

  const profileItems = [
    {
      label: 'My Details',
      icon: UserIcon,
      route: '/profile/my-details',
    },
    {
      label: 'Address Book',
      icon: MapPinIcon,
      route: '/profile/address-book',
    },
    {
      label: 'Wallet',
      icon: WalletIcon,
      route: '/profile/wallet',
    },
    {
      label: 'Support',
      icon: QuestionMarkCircleIcon,
      route: '/profile/support',
    },
    {
      label: 'Settings',
      icon: Cog6ToothIcon,
      route: '/profile/settings',
    },
  ]
  
  return (
    <div className="py-24">
      {/* Header */}
      <header className="fixed top-0 left-0 shrink-0 bg-white h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-[#f0f0f0]">
          Profile
      </header>

      {/* Hero Section */}
      <div className="mb-7 text-center">
        <h2 className="text-2xl font-bold">Hi,</h2>
        <p className="text-gray-400 mt-1 font-medium">{user?.firstname || user?.email}</p>
      </div>

      {/* Menu List */}
      <div className="flex flex-col gap-y-4 px-6">
        {profileItems.map((item, index)=>{
          return(
            <Link key={index} href={item.route}>
              <IconListItem 
              icon={<item.icon className="size-5.5 text-[#4b5563]"/>}
              title={item.label}
              chevron
              />
            </Link>
          )
        })}
        <button onClick={()=>{handleLogout()}} className="flex items-center justify-between w-fit py-1 transition-colors group" >
          <div className="flex items-center gap-4 text-red-500">
            <div className="p-4 rounded-xl group-active:scale-95 transition-transform">
              <ArrowLeftStartOnRectangleIcon className="size-6 text-red-500 rotate-180"/>
            </div>
            <span className="font-medium">Log out</span>
          </div>
          {/* <ChevronRightIcon className="size-5 text-[#4b5563]" /> */}
        </button>
      </div>
    </div>
  );
}