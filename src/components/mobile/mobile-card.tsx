/**
 * MobileCard - Enhanced card component optimized for mobile
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface MobileCardProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  animate?: boolean;
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-primary/50 bg-primary/5',
  success: 'border-green-500/50 bg-green-500/5',
  warning: 'border-yellow-500/50 bg-yellow-500/5',
  destructive: 'border-destructive/50 bg-destructive/5',
};

export function MobileCard({
  title,
  icon: Icon,
  children,
  onClick,
  className,
  contentClassName,
  variant = 'default',
  animate = true
}: MobileCardProps) {
  const Wrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 }
  } : {};

  return (
    <Wrapper {...animationProps}>
      <Card
        className={cn(
          variantStyles[variant],
          onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
          className
        )}
        onClick={onClick}
      >
        {title && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {Icon && <Icon className="w-5 h-5" />}
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn('p-4', contentClassName)}>
          {children}
        </CardContent>
      </Card>
    </Wrapper>
  );
}
