'use client';

/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/offline/page.tsx
 * phase: 5
 * domain: web-app
 * purpose: Offline fallback page for PWA
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 100
 * dependencies:
 *   - internal: None
 *   - external: next
 * exports: default Page
 * voice_considerations:
 *   - Explain offline capabilities via voice
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 80%
 *   - test_file: src/app/offline/__tests__/page.test.tsx
 */

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <svg
            className="mx-auto h-24 w-24 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          You're Offline
        </h1>

        <p className="text-gray-600 mb-8">
          No internet connection detected. You can still:
        </p>

        <div className="space-y-4 text-left mb-8">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="font-medium text-gray-900">Create Jobs with Voice</h3>
              <p className="text-sm text-gray-600">Jobs will sync when you're back online</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="font-medium text-gray-900">Update Load Lists</h3>
              <p className="text-sm text-gray-600">Mark items as loaded or verified</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="font-medium text-gray-900">View Cached Data</h3>
              <p className="text-sm text-gray-600">Access recently viewed jobs and lists</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}