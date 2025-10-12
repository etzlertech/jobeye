'use client';

import { useState, useEffect } from 'react';

interface TenantUserInfo {
  tenantId: string;
  tenantName?: string;
  userId?: string;
  userName?: string;
}

export default function TenantUserInfo() {
  const [info, setInfo] = useState<TenantUserInfo | null>(null);

  useEffect(() => {
    // For demo purposes, we'll use the hardcoded values
    // In a real app, this would come from auth context or API
    setInfo({
      tenantId: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
      tenantName: 'Demo Company',
      userId: 'demo-user',
      userName: 'Demo User'
    });
  }, []);

  if (!info) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-blue-600 font-semibold">X-Tenant-ID:</span>
          <div className="text-gray-800 font-mono text-xs mt-1">
            {info.tenantName}
            <br />
            <span className="text-gray-600">{info.tenantId}</span>
          </div>
        </div>
        <div>
          <span className="text-blue-600 font-semibold">User:</span>
          <div className="text-gray-800 mt-1">
            {info.userName} <span className="text-gray-600">({info.userId})</span>
          </div>
        </div>
      </div>
    </div>
  );
}