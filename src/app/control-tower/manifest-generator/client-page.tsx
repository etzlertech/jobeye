'use client'

import { useState, useEffect } from 'react'

interface Manifest {
  id: string
  content: string
  fileCount: number
  createdAt: string
}

export default function ManifestGeneratorClient() {
  const [currentManifest, setCurrentManifest] = useState<Manifest | null>(null)
  const [manifestHistory, setManifestHistory] = useState<Manifest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateManifest = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/control-tower/generate-manifest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to generate manifest (${response.status})`)
      }
      
      const manifest: Manifest = {
        id: data.manifest.id,
        content: data.manifest.content,
        fileCount: data.manifest.fileCount,
        createdAt: data.manifest.createdAt
      }
      
      setCurrentManifest(manifest)
      setManifestHistory(prev => [manifest, ...prev])
    } catch (err: any) {
      console.error('Manifest generation error:', err)
      setError(err.message || 'Failed to generate manifest. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (currentManifest?.content) {
      try {
        await navigator.clipboard.writeText(currentManifest.content)
        alert('Manifest copied to clipboard!')
      } catch (err) {
        alert('Failed to copy to clipboard')
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Manifest Generator</h1>
        <p className="text-gray-400">Generate comprehensive project progress reports for auditing and review</p>
      </div>

      {/* Generate Button */}
      <div className="mb-8">
        <button
          onClick={generateManifest}
          disabled={loading}
          className={`${
            loading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-tower-accent hover:bg-blue-600'
          } text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center space-x-3`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Generating Manifest...</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Generate New Manifest</span>
            </>
          )}
        </button>
        
        {error && (
          <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg text-red-200">
            <div className="font-semibold mb-1">Error:</div>
            <div>{error}</div>
            {error.includes('authentication') && (
              <div className="mt-2 text-sm">
                💡 Tip: Make sure you're running in development mode (NODE_ENV=development)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current Manifest Display */}
      {currentManifest && (
        <div className="mb-8">
          <div className="bg-tower-gray rounded-lg border border-tower-border">
            <div className="p-6 border-b border-tower-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Latest Manifest</h2>
                  <p className="text-sm text-gray-400">
                    Generated on {new Date(currentManifest.createdAt).toLocaleString()} • 
                    {currentManifest.fileCount} files analyzed
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="bg-tower-accent hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  📋 Copy to Clipboard
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-tower-dark rounded-lg p-4 border border-tower-border overflow-auto max-h-96">
                <pre className="manifest-content text-gray-300 whitespace-pre-wrap text-sm">
                  {currentManifest.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manifest History */}
      {manifestHistory.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4">Manifest History</h2>
          <div className="bg-tower-gray rounded-lg border border-tower-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-tower-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Generated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Files Analyzed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tower-border">
                  {manifestHistory.map((manifest, index) => (
                    <tr key={manifest.id} className="hover:bg-tower-border transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {new Date(manifest.createdAt).toLocaleString()}
                        </div>
                        {index === 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200 mt-1">
                            Latest
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{manifest.fileCount} files</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setCurrentManifest(manifest)}
                          className="text-tower-accent hover:text-blue-400 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(manifest.content)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!currentManifest && !loading && (
        <div className="bg-tower-gray rounded-lg p-6 border border-tower-border">
          <h3 className="text-lg font-semibold text-white mb-3">📋 About Manifest Generation</h3>
          <div className="text-gray-300 space-y-2">
            <p>The manifest generator creates comprehensive project progress reports that include:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>File statistics and completion percentages</li>
              <li>Voice-first compliance metrics</li>
              <li>Architecture health indicators</li>
              <li>Component breakdown and analysis</li>
              <li>Recommended next steps</li>
            </ul>
            <p className="mt-4 text-sm text-gray-400">
              Generated manifests are automatically saved to the database and can be reviewed later.
            </p>
            <div className="mt-4 p-3 bg-tower-dark rounded border border-green-900">
              <div className="text-green-400 text-sm">
                💡 Development Mode: Manifest generation will analyze your actual source code.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}