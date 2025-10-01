'use client';

import { useState, useEffect } from 'react';

interface ProjectStats {
  totalFiles: number
  voiceCoverage: number
  lastManifest?: {
    createdAt: string
    fileCount: number
  }
}

export default function ControlTowerDashboard() {
  const [stats, setStats] = useState<ProjectStats>({
    totalFiles: 0,
    voiceCoverage: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for now - in production, this would fetch from the API
    setTimeout(() => {
      setStats({
        totalFiles: 47,
        voiceCoverage: 73,
        lastManifest: {
          createdAt: new Date().toISOString(),
          fileCount: 47
        }
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-tower-border rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-tower-gray rounded-lg p-6">
                <div className="h-6 bg-tower-border rounded mb-4"></div>
                <div className="h-10 bg-tower-border rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Project Control Tower</h1>
        <p className="text-gray-400">Real-time architecture monitoring and control dashboard</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-tower-gray rounded-lg p-6 border border-tower-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Total Files</h3>
            <span className="text-2xl">📁</span>
          </div>
          <div className="text-3xl font-bold text-tower-accent">{stats.totalFiles}</div>
          <p className="text-sm text-gray-400 mt-2">TypeScript & React components</p>
        </div>

        <div className="bg-tower-gray rounded-lg p-6 border border-tower-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Voice Coverage</h3>
            <span className="text-2xl">🎤</span>
          </div>
          <div className="text-3xl font-bold text-tower-accent">{stats.voiceCoverage}%</div>
          <div className="w-full bg-tower-border rounded-full h-2 mt-3">
            <div 
              className="bg-tower-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.voiceCoverage}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-tower-gray rounded-lg p-6 border border-tower-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Last Manifest</h3>
            <span className="text-2xl">📋</span>
          </div>
          <div className="text-sm text-gray-400">
            {stats.lastManifest ? (
              <>
                <div>Generated: {new Date(stats.lastManifest.createdAt).toLocaleDateString()}</div>
                <div className="mt-1">Files: {stats.lastManifest.fileCount}</div>
              </>
            ) : (
              'No manifests generated yet'
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-tower-gray rounded-lg p-6 border border-tower-border mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/control-tower/manifest-generator"
            className="bg-tower-accent hover:bg-blue-600 text-white p-4 rounded-lg transition-colors text-center"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-medium">Generate Manifest</div>
            <div className="text-sm opacity-75">Create progress report</div>
          </a>

          <a
            href="/control-tower/architecture-viewer"
            className="bg-tower-border hover:bg-gray-600 text-white p-4 rounded-lg transition-colors text-center"
          >
            <div className="text-2xl mb-2">🏗️</div>
            <div className="font-medium">View Architecture</div>
            <div className="text-sm opacity-75">Dependency graphs</div>
          </a>

          <a
            href="/control-tower/standards-library"
            className="bg-tower-border hover:bg-gray-600 text-white p-4 rounded-lg transition-colors text-center"
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-medium">Standards Library</div>
            <div className="text-sm opacity-75">Project documentation</div>
          </a>

          <button
            onClick={() => window.location.reload()}
            className="bg-tower-border hover:bg-gray-600 text-white p-4 rounded-lg transition-colors text-center"
          >
            <div className="text-2xl mb-2">🔄</div>
            <div className="font-medium">Refresh Data</div>
            <div className="text-sm opacity-75">Update metrics</div>
          </button>
        </div>
      </div>

      {/* Architecture Health */}
      <div className="bg-tower-gray rounded-lg p-6 border border-tower-border">
        <h2 className="text-xl font-semibold text-white mb-4">Architecture Health</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Voice-First Compliance</span>
            <span className="text-green-400">✅ {stats.voiceCoverage}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Security Directives</span>
            <span className="text-yellow-400">⚠️ In Progress</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Test Coverage</span>
            <span className="text-red-400">❌ Needs Attention</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Code Quality</span>
            <span className="text-green-400">✅ Good</span>
          </div>
        </div>
      </div>
    </div>
  )
}