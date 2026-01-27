import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface NegotiationBadgeProps {
  text: string;
  variant: 'comfort' | 'data' | 'emotion' | 'warning';
  icon?: ReactNode;
}

export function NegotiationBadge({ text, variant, icon }: NegotiationBadgeProps) {
  const variantClasses = {
    comfort: 'bg-green-500/20 text-green-400 border-green-500/30',
    data: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    emotion: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    warning: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium',
        variantClasses[variant]
      )}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{text}</span>
    </motion.div>
  );
}
