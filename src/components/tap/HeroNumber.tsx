/**
 * TAP HeroNumber v3 — gradient glow numbers with CountUp
 *
 * @example
 * <HeroNumber value={2847} prefix="+" suffix="$" color="green" size="hero" />
 * <HeroNumber value={-540} prefix="-$" color="red" size="xl" />
 * <HeroNumber value={50024} prefix="$" size="2xl" live />
 */

import React from 'react';
import CountUp from 'react-countup';
import { cn } from '@/lib/utils';
import { formatTAP } from '@/lib/formatTAP';

export interface HeroNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: 'green' | 'red' | 'white' | 'amber' | 'metal' | 'auto';
  size?: 'xl' | '2xl' | 'hero';
  /** Glow drop-shadow matching color */
  glow?: boolean;
  /** Animate CountUp on mount and value change */
  animate?: boolean;
  /** Pulse glow for live data */
  live?: boolean;
  className?: string;
}

// Hero size: gradient text + filter glow via CSS classes (v3 signature)
const heroGradientStyles: Record<string, string> = {
  green:  'tap-hero-number-green',
  red:    'tap-hero-number-red',
  amber:  'tap-hero-number-amber',
  white:  'tap-hero-number-white',
  metal:  'tap-hero-number-metal',
  auto:   '',
};

// Smaller sizes: plain text color + optional glow
const colorStyles: Record<string, string> = {
  green:  'text-[var(--green-primary)]',
  red:    'text-[var(--red-danger)]',
  white:  'text-[var(--text-primary)]',
  amber:  'text-[var(--amber-warn)]',
  metal:  'text-[var(--metal-mid)]',
  auto:   '',
};

const glowStyles: Record<string, string> = {
  green:  'drop-shadow-[0_0_24px_rgba(74,222,128,0.45)]',
  red:    'drop-shadow-[0_0_24px_rgba(248,113,113,0.45)]',
  white:  'drop-shadow-[0_0_16px_rgba(255,255,255,0.20)]',
  amber:  'drop-shadow-[0_0_20px_rgba(251,191,36,0.40)]',
  metal:  'drop-shadow-[0_0_20px_var(--metal-glow)]',
  auto:   '',
};

const sizeBaseStyles: Record<string, string> = {
  xl:    'tap-metric-number text-[20px] sm:text-[28px]',
  '2xl': 'tap-display-number text-[28px] sm:text-[40px]',
  hero:  'text-[clamp(40px,6vw,72px)]',
};

export function HeroNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  color = 'auto',
  size = '2xl',
  glow = true,
  animate = true,
  live = false,
  className,
}: HeroNumberProps) {
  const resolvedColor = color === 'auto' ? (value >= 0 ? 'green' : 'red') : color;
  const isHero = size === 'hero';

  return (
    <div
      className={cn(
        sizeBaseStyles[size],
        'tabular',
        isHero
          ? heroGradientStyles[resolvedColor]
          : [
              colorStyles[resolvedColor],
              glow && glowStyles[resolvedColor],
            ],
        !isHero && live && resolvedColor === 'green' && 'drop-shadow-[0_0_32px_rgba(74,222,128,0.6)]',
        !isHero && live && resolvedColor === 'red' && 'drop-shadow-[0_0_32px_rgba(248,113,113,0.6)]',
        className
      )}
    >
      {prefix}
      <CountUp
        end={Math.abs(value)}
        decimals={decimals}
        duration={animate ? 0.8 : 0}
        formattingFn={(n) => formatTAP(n, decimals)}
        preserveValue
        useEasing
      />
      {suffix}
    </div>
  );
}

export default HeroNumber;
