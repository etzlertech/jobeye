'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check for configuration issues in production
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const needsConfig = isProduction && !siteUrl;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Clear old auth cookies BEFORE signing in to prevent conflicts
    // Old custom cookies (jobeye-auth-token) must be cleared so new Supabase default cookies can be set
    document.cookie = 'jobeye-auth-token=; Max-Age=0; path=/';
    document.cookie = 'jobeye-auth-token.0=; Max-Age=0; path=/';
    document.cookie = 'jobeye-auth-token.1=; Max-Age=0; path=/';
    document.cookie = 'isDemo=; Max-Age=0; path=/';
    document.cookie = 'demoRole=; Max-Age=0; path=/';

    // Clear localStorage
    try {
      localStorage.removeItem('jobeye-auth-token');
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user && data.session) {
        try {
          const callbackResponse = await fetch('/auth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              event: 'SIGNED_IN',
              session: data.session
            })
          });
          
          if (!callbackResponse.ok) {
            const error = await callbackResponse.json();
            console.error('Auth callback failed:', error);
          }
          
          // Force a session refresh to ensure cookies are properly set
          await supabase.auth.refreshSession();
        } catch (callbackError) {
          console.error('Failed to sync Supabase session cookie:', callbackError);
        }

        // Get role from app_metadata or user_metadata
        // Check both 'role' (singular) and 'roles' (array) fields
        const roleFromMetadata = data.user.app_metadata?.role || data.user.user_metadata?.role;
        const rolesArray = data.user.app_metadata?.roles || data.user.user_metadata?.roles || [];
        
        // Determine role based on email pattern or metadata
        let role = 'crew'; // default
        if (data.user.email === 'admin@tophand.tech' || rolesArray.includes('system_admin')) {
          role = 'admin';
        } else if (data.user.email === 'super@tophand.tech' || roleFromMetadata === 'supervisor' || rolesArray.includes('supervisor')) {
          role = 'supervisor';
        } else if (roleFromMetadata === 'admin') {
          role = 'admin';
        } else if (roleFromMetadata === 'crew' || rolesArray.includes('crew')) {
          role = 'crew';
        }

        // Redirect based on role or provided redirect target
        const roleRoutes: Record<string, string> = {
          admin: '/admin/dashboard',
          supervisor: '/supervisor',
          crew: '/crew'
        };

        const redirectParam = searchParams?.get('redirectTo');
        const hasSafeRedirect = redirectParam?.startsWith('/');
        const targetRoute = hasSafeRedirect ? redirectParam! : roleRoutes[role] || '/crew';

        console.log('Sign-in redirect:', {
          email: data.user.email,
          role,
          roleFromMetadata,
          rolesArray,
          targetRoute,
          redirectParam
        });

        router.push(targetRoute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-container">
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold" style={{ color: '#FFD700' }}>JobEye</h1>
          <p className="text-sm text-gray-400">Simple Sign In</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-semibold text-white">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-3 text-sm bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-white placeholder-gray-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-semibold text-white">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-3 text-sm bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-white placeholder-gray-500"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 text-sm bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            style={{ background: isLoading ? undefined : '#FFD700' }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-center text-gray-300 text-sm font-semibold">Test Accounts</p>
          <div className="space-y-1 text-xs text-gray-200">
            <p className="font-mono">Supervisor: super@tophand.tech / demo123</p>
            <p className="font-mono">Crew: crew@tophand.tech / demo123</p>
            <p className="font-mono">Admin: admin@tophand.tech / demo123</p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <p className="text-center text-gray-300 text-sm font-semibold">Demo Pages (No Sign-in Required)</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="/demo-crud"
              className="block text-center py-2 px-3 bg-gray-800 text-gray-200 text-xs rounded-lg hover:bg-gray-700 transition-colors"
            >
              Demo CRUD
            </a>
            <a
              href="/demo-properties"
              className="block text-center py-2 px-3 bg-gray-800 text-gray-200 text-xs rounded-lg hover:bg-gray-700 transition-colors"
            >
              Properties
            </a>
            <a
              href="/demo-jobs"
              className="block text-center py-2 px-3 bg-gray-800 text-gray-200 text-xs rounded-lg hover:bg-gray-700 transition-colors"
            >
              Jobs
            </a>
            <a
              href="/demo-items"
              className="block text-center py-2 px-3 bg-gray-800 text-gray-200 text-xs rounded-lg hover:bg-gray-700 transition-colors"
            >
              Inventory
            </a>
          </div>
        </div>

        {/* Version indicator for deployment */}
        <div className="text-center text-xs text-gray-500">
          v3.2.2 - {new Date().toLocaleDateString()}
          {needsConfig && ' - Config Required'}
        </div>
      </div>
      </div>

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}

export default function SimpleSignInPage() {
  return (
    <Suspense fallback={
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-white">Loading...</div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
