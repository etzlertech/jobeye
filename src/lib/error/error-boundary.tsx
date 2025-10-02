/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/error/error-boundary.tsx
 * phase: 3
 * domain: error-handling
 * purpose: React error boundary with offline support and voice feedback
 * spec_ref: 007-mvp-intent-driven/contracts/error-handling.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: {
 *   states: ['normal', 'error', 'recovering', 'recovered'],
 *   transitions: [
 *     'normal->error: errorCaught()',
 *     'error->recovering: startRecovery()',
 *     'recovering->recovered: recoveryComplete()',
 *     'recovering->error: recoveryFailed()',
 *     'recovered->normal: resetError()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "errorBoundary": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/voice/voice-processor',
 *     '@/lib/offline/sync-manager',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['ErrorBoundary', 'ErrorFallback']
 * voice_considerations: Provide voice feedback for errors and recovery options
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/error/error-boundary.test.tsx'
 * }
 * tasks: [
 *   'Create React error boundary with offline support',
 *   'Add voice feedback for error states',
 *   'Implement automatic recovery mechanisms',
 *   'Create user-friendly error fallback UI'
 * ]
 */

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Mic, WifiOff } from 'lucide-react';
import { voiceProcessor } from '@/lib/voice/voice-processor';
import { syncManager } from '@/lib/offline/sync-manager';
import { voiceLogger } from '@/core/logger/voice-logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  recoveryAttempts: number;
  isOffline: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRecoveryAttempts?: number;
  enableVoiceFeedback?: boolean;
}

export interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  isOffline: boolean;
  onRetry: () => void;
  onGoHome: () => void;
  onReportError: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: NodeJS.Timeout | null = null;
  private voiceTimeout: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0,
      isOffline: !navigator.onLine
    };

    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    this.setState({ isOffline: false });
    
    // If we had an error and we're back online, try to recover
    if (this.state.hasError && !this.state.isRecovering) {
      this.attemptRecovery();
    }
  };

  private handleOffline = (): void => {
    this.setState({ isOffline: true });
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    voiceLogger.error('Error caught by boundary', { error, errorInfo });
    
    this.setState({
      errorInfo,
      recoveryAttempts: 0
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Provide voice feedback if enabled
    if (this.props.enableVoiceFeedback) {
      this.provideVoiceFeedback(error);
    }

    // Attempt automatic recovery for certain error types
    this.scheduleRecoveryAttempt(error);
  }

  private provideVoiceFeedback(error: Error): void {
    if (!voiceProcessor.getStatus().isSupported) {
      return;
    }

    let message = 'An error occurred. ';
    
    if (this.state.isOffline) {
      message += 'You appear to be offline. The app will work with limited functionality.';
    } else if (this.isNetworkError(error)) {
      message += 'There seems to be a connection issue. Please check your internet connection.';
    } else if (this.isUserPermissionError(error)) {
      message += 'Permission is needed to use this feature. Please check your browser settings.';
    } else {
      message += 'Please try refreshing the page or going back to the home screen.';
    }

    // Delay voice feedback to avoid interrupting other audio
    this.voiceTimeout = setTimeout(() => {
      voiceProcessor.speak(message).catch(() => {
        // Silence voice errors to avoid recursive error boundary triggers
      });
    }, 1000);
  }

  private isNetworkError(error: Error): boolean {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('Failed to fetch');
  }

  private isUserPermissionError(error: Error): boolean {
    return error.message.includes('permission') ||
           error.message.includes('NotAllowedError') ||
           error.message.includes('getUserMedia');
  }

  private scheduleRecoveryAttempt(error: Error): void {
    const maxAttempts = this.props.maxRecoveryAttempts || 3;
    
    if (this.state.recoveryAttempts >= maxAttempts) {
      return;
    }

    // Only attempt automatic recovery for certain error types
    if (this.shouldAutoRecover(error)) {
      const delay = Math.min(1000 * Math.pow(2, this.state.recoveryAttempts), 10000);
      
      this.retryTimer = setTimeout(() => {
        this.attemptRecovery();
      }, delay);
    }
  }

  private shouldAutoRecover(error: Error): boolean {
    // Auto-recover for network errors when online
    if (this.isNetworkError(error) && !this.state.isOffline) {
      return true;
    }

    // Auto-recover for temporary errors
    if (error.message.includes('ChunkLoadError') || 
        error.message.includes('Loading chunk')) {
      return true;
    }

    return false;
  }

  private attemptRecovery = (): void => {
    this.setState({ 
      isRecovering: true,
      recoveryAttempts: this.state.recoveryAttempts + 1
    });

    // Try to sync offline data if we're back online
    if (!this.state.isOffline) {
      syncManager.syncAll({ priorityOnly: true })
        .then(() => {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            isRecovering: false
          });
        })
        .catch(() => {
          this.setState({ isRecovering: false });
        });
    } else {
      // Just reset the error state for offline recovery
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRecovering: false
        });
      }, 1000);
    }
  };

  private handleRetry = (): void => {
    this.attemptRecovery();
  };

  private handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0
    });

    // Navigate to home page
    window.location.href = '/';
  };

  private handleReportError = (): void => {
    const { error, errorInfo } = this.state;
    
    if (error && errorInfo) {
      // Store error report for later sync
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Try to send error report
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      }).catch(() => {
        // If reporting fails, store locally for later sync
        localStorage.setItem(
          `error-report-${Date.now()}`,
          JSON.stringify(errorReport)
        );
      });
    }
  };

  componentWillUnmount(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout);
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          isRecovering={this.state.isRecovering}
          isOffline={this.state.isOffline}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          onReportError={this.handleReportError}
        />
      );
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  isRecovering,
  isOffline,
  onRetry,
  onGoHome,
  onReportError
}) => {
  const getErrorTitle = (): string => {
    if (isOffline) {
      return 'Offline Mode';
    }
    if (error?.message.includes('ChunkLoadError')) {
      return 'Loading Error';
    }
    if (error?.message.includes('fetch')) {
      return 'Connection Error';
    }
    return 'Something went wrong';
  };

  const getErrorMessage = (): string => {
    if (isOffline) {
      return 'You\'re currently offline. Some features may be limited, but you can continue working with cached data.';
    }
    if (error?.message.includes('ChunkLoadError')) {
      return 'Failed to load part of the application. This usually resolves with a refresh.';
    }
    if (error?.message.includes('fetch')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    return 'An unexpected error occurred. Don\'t worry, your data is safe and we\'re working to resolve this.';
  };

  const getErrorIcon = () => {
    if (isOffline) {
      return <WifiOff className="w-16 h-16 text-yellow-500" />;
    }
    return <AlertTriangle className="w-16 h-16 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-6">
          {getErrorIcon()}
        </div>
        
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          {getErrorTitle()}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {getErrorMessage()}
        </p>
        
        {isRecovering && (
          <div className="mb-6">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-blue-600">
              Attempting to recover...
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={onRetry}
            disabled={isRecovering}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
            {isRecovering ? 'Retrying...' : 'Try Again'}
          </button>
          
          <button
            onClick={onGoHome}
            className="w-full py-3 px-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </button>
          
          {!isOffline && (
            <button
              onClick={onReportError}
              className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 text-sm flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Report this issue
            </button>
          )}
        </div>
        
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer">
              Technical details
            </summary>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
              {error.message}
              {error.stack && `\n\nStack trace:\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorBoundary;