'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  const variants = {
    default: 'bg-[#f1ebe5] text-[#66574f] ring-1 ring-[#e3d8cf]',
    success: 'bg-[#e9f3ec] text-[#4e725a] ring-1 ring-[#d4e5d9]',
    warning: 'bg-[#f6efe1] text-[#8a653d] ring-1 ring-[#eadbc1]',
    danger: 'bg-[#f5e8e5] text-[#8a4e48] ring-1 ring-[#e8d3cf]',
    info: 'bg-[#eaf0f1] text-[#526c72] ring-1 ring-[#d6e1e3]',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
