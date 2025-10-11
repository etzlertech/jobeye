/**
 * MobileHeader - Consistent header component for mobile screens
 */

'use client';

import { ArrowLeft, WifiOff, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  isOffline?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  backTo,
  isOffline = false,
  rightContent,
  className
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backTo) {
      router.push(backTo);
    } else {
      router.back();
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOffline && (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="w-3 h-3" />
              Offline
            </Badge>
          )}
          {!isOffline && (
            <Signal className="w-4 h-4 text-primary" />
          )}
          {rightContent}
        </div>
      </div>
    </header>
  );
}
