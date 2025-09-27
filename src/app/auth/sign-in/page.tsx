/*
AGENT DIRECTIVE BLOCK
file: /src/app/auth/sign-in/page.tsx
phase: 1
domain: authentication
purpose: Sign-in page with multi-tenant support and voice profile setup
spec_ref: v4-blueprint
complexity_budget: 150
offline_capability: NONE
dependencies:
  external:
    - react
    - @supabase/auth-helpers-nextjs
  internal:
    - /src/lib/supabase/client
    - /src/components/auth/SignInForm
exports:
  - default (SignInPage component)
voice_considerations:
  - Voice profile setup after first login
  - Wake word configuration
  - Voice biometric enrollment option
test_requirements:
  coverage: 85%
  test_file: __tests__/app/auth/sign-in/page.test.tsx
tasks:
  - Create sign-in page layout
  - Add tenant selection if needed
  - Handle voice profile redirect
*/

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient, getUser } from '@/lib/supabase/client';
import SignInForm from '@/components/auth/SignInForm';

export const metadata: Metadata = {
  title: 'Sign In - JobEye',
  description: 'Sign in to your JobEye account',
};

export default async function SignInPage() {
  const user = await getUser();
  
  // Redirect if already authenticated
  if (user) {
    // Check if voice profile is set up
    const supabase = await createServerClient();
    const { data: voiceProfile } = await supabase
      .from('voice_profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .single();

    if (!voiceProfile?.onboarding_completed) {
      redirect('/onboarding/voice');
    }
    
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">JobEye</h1>
          <p className="text-lg text-gray-600">Voice-First Field Service Management</p>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        
        <SignInForm />
        
        <div className="text-center text-sm text-gray-600">
          <p>
            Don't have an account?{' '}
            <a href="/auth/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}