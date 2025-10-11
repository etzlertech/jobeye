/**
 * MobileFAB - Floating Action Button for mobile screens
 */

'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileFABProps {
  icon: LucideIcon;
  onClick?: () => void;
  label?: string;
  variant?: 'default' | 'primary';
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  className?: string;
}

const positionStyles = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-6 left-6',
};

export function MobileFAB({
  icon: Icon,
  onClick,
  label,
  variant = 'primary',
  position = 'bottom-center',
  className
}: MobileFABProps) {
  return (
    <motion.div
      className={cn(
        'fixed z-50',
        positionStyles[position],
        className
      )}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <Button
        size="lg"
        variant={variant === 'primary' ? 'default' : 'secondary'}
        className={cn(
          'h-14 rounded-full shadow-2xl',
          variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          label ? 'px-6' : 'w-14'
        )}
        onClick={onClick}
      >
        <Icon className={cn('w-6 h-6', label && 'mr-2')} />
        {label && <span className="font-semibold">{label}</span>}
      </Button>
    </motion.div>
  );
}
