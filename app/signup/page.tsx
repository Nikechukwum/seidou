'use client'
import { createClient } from '@/lib/supabase/client';
import { ExclamationCircleIcon } from '@heroicons/react/20/solid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createClient()
  
    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
  
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        if(!email || !password){
          setError('Please fill in the form')
          setLoading(false)
          return
        }
  
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          // options: {
          //   data: { display_name: displayName }
          // }
        });

        if (authError) return setError(authError.message);

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('users')
            .insert({ 
              id: authData.user.id,
              email: authData.user.email,
              // display_name: displayName 
            });

          if (profileError){
             setError("User created, but profile failed: " + profileError.message)
             return
            };
        }

        sessionStorage.removeItem('userNav')
        router.replace('/')
        setLoading(false);
    }

  return (
    <div className="flex flex-col bg-white px-6 pb-20">
      
      {/* Back Button */}
      <button onClick={()=>{router.back()}} className="my-6 w-fit text-gray-900">
          <ArrowLeftIcon className='size-5.5' strokeWidth={2.5} /> 
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Create Account
        </h1>
        <p className="mt-2 text-gray-500 font-medium">
          Enter your details to get started.
        </p>
        {error && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold mt-3 text-sm text-red-600 bg-red-50 ring-1 ring-red-600 rounded-full px-3 py-2'>
          <ExclamationCircleIcon className='size-5.5 shrink-0'/> {error}
        </p>}
      </div>

      {/* Form */}
      <form className="space-y-6 mb-8" onSubmit={(e) => handleSubmit(e)}>
        {/* Phone Field */}
        {/* <div>
          <label className="mb-2 block text-sm font-bold text-gray-900">
            Phone number
          </label>
          <input
            type="text"
            name='phone'
            placeholder="+234 9094070547"
            className="w-full rounded-full border border-gray-200 px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
        </div> */}

        {/* Email Field */}
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Email
          </label>
          <input
            type="email"
            name='email'
            placeholder="john@africa.com"
            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Password Field */}
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-900">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name='password'
              className="w-full rounded-full border border-gray-200 px-5 py-3 pr-14 text-gray-900 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400"
            >
              <span className="material-symbols-outlined">
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
            </button>
          </div>
        </div>

        {/* Sign Up Button */}
        <button
          type="submit"
          className="w-full mt-5 rounded-full bg-black py-3.5 text-center shadow-lg shadow-black/10 font-bold text-white transition-transform active:scale-[0.98]"
        >
          Sign Up
        </button>
      </form>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute left-1/2 -translate-x-1/2 inset-0 w-5/6 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 font-medium text-gray-400">Or sign up with</span>
        </div>
      </div>

      {/* Google Login Button */}
      <div className="flex justify-center mb-6">
        <button className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 transition-colors hover:bg-gray-50 active:scale-95">
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
              fill="#EA4335"
            />
          </svg>
        </button>
      </div>

      {/* Footer Text */}
      <div className="mt-auto flex justify-center text-[15px]">
        <span className="text-gray-500">Already have an account?&nbsp;</span>
        <Link href={'/signin'} className="font-bold text-gray-900 hover:underline">Log in</Link>
      </div>
    </div>
  );
}