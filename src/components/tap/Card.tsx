/**
 * TAP Card v3 — liquid glass cards (TAP signature)
 *
 * @example
 * <Card>content</Card>
 * <Card variant="glow-green" live>Live balance</Card>
 * <Card variant="glow-red">Loss alert</Card>
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Visual variant */
  variant?: 'default' | 'glow-green' | 'glow-blue' | 'glow-red' | 'glow-amber' | 'glow-metal' | 'flat';
  /** Enable pulse glow animation (for live data) */
  live?: boolean;
  /** Enable hover lift effect */
  lift?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  'default':    'tap-liquid-glass',
  'glow-green': 'tap-liquid-glass-green',
  'glow-blue':  'tap-liquid-glass-blue',
  'glow-red':   'tap-liquid-glass-red',
  'glow-amber': 'tap-liquid-glass-amber',
  'glow-metal': 'tap-liquid-glass-metal',
  'flat':       'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-xl)]',
};

const liveStyles: Record<string, string> = {
  'glow-green': 'tap-pulse-green',
  'glow-red':   'tap-pulse-red',
  'default': '', 'glow-blue': '', 'glow-amber': '', 'glow-metal': '', 'flat': '',
};

const paddingStyles = {
  none: '',
  sm:   'p-2.5 sm:p-3',
  md:   'p-4 sm:p-5',
  lg:   'p-4 sm:p-6',
};

export function Card({
  children,
  className,
  variant = 'default',
  live = false,
  lift = true,
  onClick,
  padding = 'md',
}: CardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={cn(
        'transition-all duration-[var(--duration-normal)]',
        variantStyles[variant],
        live && liveStyles[variant],
        lift && 'tap-lift',
        onClick && 'cursor-pointer w-full text-left',
        paddingStyles[padding],
        className
      )}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}

/** Convenience sub-components */
export function CardLabel({ children, className, dot }: { children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <div className={cn('tap-label flex items-center gap-1.5 mb-2', className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-[var(--green-primary)] animate-pulse" />}
      {children}
    </div>
  );
}

export function CardValue({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('tap-metric-number tabular', className)}>
      {children}
    </div>
  );
}

export default Card;
