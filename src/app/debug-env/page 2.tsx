/**
 * @file Debug Environment Variables Page
 * @purpose Show what environment variables are available at runtime
 */

'use client';

import React from 'react';

export default function DebugEnvPage() {
  const geminiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>

      <div className="space-y-4">
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-2">NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-gray-400">Defined:</dt>
              <dd className="font-mono">{String(typeof geminiKey !== 'undefined')}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Type:</dt>
              <dd className="font-mono">{typeof geminiKey}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Truthy:</dt>
              <dd className="font-mono">{String(!!geminiKey)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Length:</dt>
              <dd className="font-mono">{geminiKey?.length || 0}</dd>
            </div>
            <div>
              <dt className="text-gray-400">First 20 chars:</dt>
              <dd className="font-mono bg-gray-700 p-2 rounded break-all">
                {geminiKey ? geminiKey.substring(0, 20) + '...' : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Full value (hidden):</dt>
              <dd className="font-mono bg-gray-700 p-2 rounded">
                {geminiKey ? '***' + geminiKey.substring(geminiKey.length - 10) : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-2">All NEXT_PUBLIC_* Variables</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(
              Object.keys(process.env)
                .filter(key => key.startsWith('NEXT_PUBLIC_'))
                .reduce((acc, key) => ({
                  ...acc,
                  [key]: key.includes('KEY') || key.includes('SECRET')
                    ? '***REDACTED***'
                    : process.env[key]
                }), {}),
              null,
              2
            )}
          </pre>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-500 p-4 rounded">
          <h3 className="font-semibold mb-2">⚠️ Important Notes</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>NEXT_PUBLIC_* vars are baked into bundle at BUILD time</li>
            <li>Setting them in Railway AFTER build won't help</li>
            <li>Must trigger a new deploy for changes to take effect</li>
            <li>Check Railway build logs to see if var was available during build</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
