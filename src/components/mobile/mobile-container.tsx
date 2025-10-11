/**
 * MobileContainer - Root container for all mobile screens
 * Ensures responsive, safe-area aware layout
 */

import { cn } from '@/lib/utils';

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileContainer({ children, className }: MobileContainerProps) {
  return (
    <div
      className={cn(
        "min-h-screen w-full max-w-lg mx-auto bg-background text-foreground flex flex-col",
        "safe-top safe-bottom",
        className
      )}
    >
      {children}
    </div>
  );
}
