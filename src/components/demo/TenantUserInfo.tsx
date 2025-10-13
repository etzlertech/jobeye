'use client';

import { TenantBadge } from '@/components/tenant';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function TenantUserInfo() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        setUserName(name);
      }
    }
    
    getUser();
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-blue-600 font-semibold text-sm">Current Tenant:</span>
            <div className="mt-1">
              <TenantBadge />
            </div>
          </div>
          {userName && (
            <div className="ml-8">
              <span className="text-blue-600 font-semibold text-sm">User:</span>
              <div className="text-gray-800 text-sm mt-1">
                {userName}
              </div>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-600">
          Session-based authentication active
        </div>
      </div>
    </div>
  );
}