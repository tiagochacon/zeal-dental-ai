import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RapportGaugeProps {
  value: number;
  label: string;
  color: 'green' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

export function RapportGauge({ value, label, color, size = 'md' }: RapportGaugeProps) {
  const colorClasses = {
    green: {
      stroke: 'stroke-green-500',
      text: 'text-green-500',
      bg: 'text-green-500/20',
    },
    blue: {
      stroke: 'stroke-blue-500',
      text: 'text-blue-500',
      bg: 'text-blue-500/20',
    },
    purple: {
      stroke: 'stroke-purple-500',
      text: 'text-purple-500',
      bg: 'text-purple-500/20',
    },
  };
  
  const sizeClasses = {
    sm: { container: 'w-20 h-20', text: 'text-lg', label: 'text-xs' },
    md: { container: 'w-32 h-32', text: 'text-2xl', label: 'text-sm' },
    lg: { container: 'w-40 h-40', text: 'text-3xl', label: 'text-base' },
  };
  
  const circumference = 2 * Math.PI * 45; // raio = 45
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative', sizeClasses[size].container)}>
        <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className={colorClasses[color].bg}
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={colorClasses[color].stroke}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={cn('font-bold', sizeClasses[size].text, colorClasses[color].text)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {value}%
          </motion.span>
        </div>
      </div>
      <span className={cn('font-medium text-gray-400', sizeClasses[size].label)}>{label}</span>
    </div>
  );
}
