/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/(auth)/sign-in/page.tsx
 * phase: 3
 * domain: auth
 * purpose: Login page with role detection and redirect
 * spec_ref: 007-mvp-intent-driven/contracts/auth.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['initial', 'authenticating', 'role_detected', 'redirecting'],
 *   transitions: [
 *     'initial->authenticating: submitCredentials()',
 *     'authenticating->role_detected: authSuccess()',
 *     'role_detected->redirecting: determineRoute()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/lib/auth/supabase-client',
 *     '@/components/ui/ButtonLimiter'
 *   ],
 *   external: ['next/navigation', 'react'],
 *   supabase: ['auth.users']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands disabled on auth pages for security
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/auth-flow.test.ts'
 * }
 * tasks: [
 *   'Create mobile-first login form matching job load styling',
 *   'Implement role detection from user metadata',
 *   'Add role-based routing after authentication',
 *   'Handle offline authentication gracefully'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  AlertCircle, 
  Loader2,
  Shield,
  Users,
  Wrench,
  Crown,
  CheckCircle,
  ArrowLeft,
  Home,
  WifiOff,
  HelpCircle
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface AuthState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  showPassword: boolean;
}

const roleIcons = {
  admin: Crown,
  supervisor: Shield,
  crew: Wrench
};

const roleRoutes = {
  admin: '/admin',
  supervisor: '/supervisor',
  crew: '/crew'
};

const roleDescriptions = {
  admin: 'System administration and configuration',
  supervisor: 'Job creation, inventory management, crew oversight',
  crew: 'Job execution, equipment verification, voice control'
};

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [authState, setAuthState] = useState<AuthState>({
    email: '',
    password: '',
    isLoading: false,
    error: null,
    success: null,
    showPassword: false
  });
  
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Network status monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleSignIn = async () => {
    if (!authState.email || !authState.password) {
      setAuthState(prev => ({ ...prev, error: 'Please enter both email and password' }));
      return;
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authState.email,
        password: authState.password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Check both app_metadata and user_metadata for role
        const role = data.user.app_metadata?.role || data.user.user_metadata?.role || 'crew';
        setDetectedRole(role);
        setAuthState(prev => ({ ...prev, success: `Welcome back! Redirecting to ${role} dashboard...` }));
        
        // Small delay to show role detection
        setTimeout(() => {
          router.push(roleRoutes[role as keyof typeof roleRoutes]);
        }, 2000);
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && authState.email && authState.password && !authState.isLoading) {
      handleSignIn();
    }
  };

  // Show role detection/loading screen
  if (detectedRole || authState.isLoading) {
    const RoleIcon = detectedRole ? roleIcons[detectedRole as keyof typeof roleIcons] : Loader2;
    
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center px-8">
          <div className="icon-container mb-6">
            <RoleIcon className={`w-16 h-16 mx-auto ${detectedRole ? 'text-golden' : 'text-golden animate-spin'}`} />
          </div>
          
          {detectedRole ? (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2">Welcome Back!</h2>
              <div className="role-badge mb-4">
                <RoleIcon className="w-5 h-5" />
                <span className="capitalize">{detectedRole}</span>
              </div>
              <p className="text-gray-400 text-sm">
                {roleDescriptions[detectedRole as keyof typeof roleDescriptions]}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Authenticating...</h2>
              <p className="text-gray-400 text-sm">Please wait while we verify your credentials</p>
            </>
          )}
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

          .icon-container {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background: rgba(255, 215, 0, 0.1);
            border: 2px solid #FFD700;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .role-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 9999px;
            color: #FFD700;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="container-section header-container">
        <div className="company-name">JobEye Dev Hub</div>
        <div className="header-info">
          Railway Production • Authentication<br />
          Status: <span style={{color: '#FFC107', fontWeight: 600}}>{isOffline ? 'Offline' : 'Live'}</span>
        </div>
      </div>

      {/* Notifications */}
      {authState.error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm">{authState.error}</span>
          <button 
            onClick={() => setAuthState(prev => ({ ...prev, error: null }))}
            className="ml-auto text-red-500"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {authState.success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 text-golden flex-shrink-0" />
          <span className="text-sm">{authState.success}</span>
        </div>
      )}
      {isOffline && (
        <div className="notification-bar warning">
          <WifiOff className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <span className="text-sm">You're offline. Authentication may be limited.</span>
        </div>
      )}

      {/* Authentication Form */}
      <div className="container-section auth-container">
        <h2 className="section-title auth-title">🔐 Sign In to Continue</h2>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSignIn(); }} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
              Email Address
            </label>
            <div className="input-container">
              <Mail className="input-icon" />
              <input
                id="email"
                type="email"
                value={authState.email}
                onChange={(e) => setAuthState(prev => ({ ...prev, email: e.target.value }))}
                onKeyPress={handleKeyPress}
                className="input-field"
                placeholder="Enter your email"
                autoComplete="email"
                disabled={authState.isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
              Password
            </label>
            <div className="input-container">
              <Lock className="input-icon" />
              <input
                id="password"
                type={authState.showPassword ? 'text' : 'password'}
                value={authState.password}
                onChange={(e) => setAuthState(prev => ({ ...prev, password: e.target.value }))}
                onKeyPress={handleKeyPress}
                className="input-field"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={authState.isLoading}
              />
              <button
                type="button"
                onClick={() => setAuthState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                className="password-toggle"
                disabled={authState.isLoading}
              >
                {authState.showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            onClick={handleSignIn}
            disabled={!authState.email || !authState.password || authState.isLoading}
            className="sign-in-button"
          >
            {authState.isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Lock className="w-5 h-5 mr-2" />
            )}
            Sign In
          </button>
        </form>
      </div>

      {/* Test Account Info */}
      <div className="container-section info-container">
        <h2 className="section-title info-title">🧪 Test Accounts</h2>
        
        <div className="credentials-info">
          <div className="credential-item">
            <span className="credential-label">Supervisor:</span>
            <span className="credential-value">super@tophand.tech / demo123</span>
          </div>
          <div className="credential-item">
            <span className="credential-label">Crew:</span>
            <span className="credential-value">crew@tophand.tech / demo123</span>
          </div>
          <div className="credential-item">
            <span className="credential-label">Admin:</span>
            <span className="credential-value">admin@tophand.tech / demo123</span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          onClick={() => router.push('/')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Hub
        </button>
        <button
          onClick={() => window.open('https://github.com/anthropics/claude-code/issues', '_blank')}
          className="btn-help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Styled JSX */}
      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          margin: 0 auto;
          background: #000;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 10px;
          gap: 8px;
          color: white;
        }

        .container-section {
          border-radius: 12px;
          background: #000;
          border: 3px solid;
          padding: 15px;
          margin-bottom: 8px;
        }

        .header-container {
          border-color: #FFD700;
          padding: 8px 15px;
          text-align: center;
        }

        .auth-container {
          border-color: #0066FF;
        }

        .demo-container {
          border-color: #228B22;
        }

        .info-container {
          border-color: #FFC107;
        }

        .company-name {
          font-size: 22px;
          font-weight: 600;
          color: #FFD700;
          text-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
          margin-bottom: 4px;
        }

        .header-info {
          font-size: 12px;
          color: #ccc;
          line-height: 1.3;
        }

        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
        }

        .auth-title {
          color: #0066FF;
        }

        .demo-title {
          color: #228B22;
        }

        .info-title {
          color: #FFC107;
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }
        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .notification-bar.success {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
        }
        .notification-bar.warning {
          background: rgba(251, 146, 60, 0.1);
          border: 1px solid rgba(251, 146, 60, 0.3);
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          width: 20px;
          height: 20px;
          color: #9CA3AF;
          z-index: 1;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 1rem;
        }
        .input-field:focus {
          outline: none;
          border-color: #0066FF;
          box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.1);
        }
        .input-field:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .input-field::placeholder {
          color: #6B7280;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #9CA3AF;
          cursor: pointer;
          padding: 4px;
        }
        .password-toggle:hover {
          color: white;
        }
        .password-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sign-in-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 1.5rem;
          background: #0066FF;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-top: 1rem;
        }
        .sign-in-button:hover:not(:disabled) {
          background: #0052CC;
        }
        .sign-in-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .demo-card {
          background: rgba(34, 139, 34, 0.1);
          border: 2px solid #228B22;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s;
          text-decoration: none;
          color: white;
          display: block;
          min-height: 70px;
          text-align: left;
          cursor: pointer;
        }

        .demo-card:hover:not(:disabled) {
          background: rgba(34, 139, 34, 0.2);
          transform: scale(1.02);
        }

        .demo-card:active {
          transform: scale(0.98);
        }

        .demo-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .crew-card {
          border-color: #228B22;
          background: rgba(34, 139, 34, 0.1);
        }

        .supervisor-card {
          border-color: #0066FF;
          background: rgba(0, 102, 255, 0.1);
        }

        .admin-card {
          border-color: #9333EA;
          background: rgba(147, 51, 234, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .card-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .card-title {
          font-weight: 600;
          font-size: 14px;
          line-height: 1.2;
        }

        .card-description {
          font-size: 11px;
          color: #ccc;
          line-height: 1.3;
        }

        .credentials-info {
          space-y: 8px;
        }

        .credential-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 193, 7, 0.2);
        }
        .credential-item:last-child {
          border-bottom: none;
        }

        .credential-label {
          font-weight: 600;
          color: #FFC107;
          font-size: 12px;
        }

        .credential-value {
          font-family: monospace;
          font-size: 11px;
          color: #ccc;
        }

        .bottom-actions {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-top: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
          margin-top: auto;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .btn-help {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem;
          background: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-help:hover {
          background: rgba(255, 215, 0, 0.2);
        }

        @media (min-width: 768px) {
          .mobile-container {
            max-width: 768px;
            padding: 20px;
          }

          .demo-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .card-title {
            font-size: 16px;
          }

          .card-description {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
