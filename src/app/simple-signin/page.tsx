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
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: '#FFD700' }}>JobEye</h1>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
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

        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          color: white;
          font-size: 1rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #9CA3AF;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
