'use client';

import { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className,
  hover = false,
  padding = 'md',
  ...divProps
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      {...divProps}
      className={clsx(
        'rounded-2xl border border-[#e6dcd3] bg-[#fffdf9] shadow-[0_10px_28px_-20px_rgba(74,46,32,0.32)]',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8c8bc] hover:shadow-[0_16px_34px_-20px_rgba(74,46,32,0.34)]',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between', className)}>
      <div>
        <h3 className="font-serif text-lg font-semibold text-[#2f2521]">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-[#7d6e66]">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx('mt-4', className)}>{children}</div>;
}
