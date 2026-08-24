'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-[#5e4f47]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#9b8d84]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'block w-full rounded-xl border bg-[#fffdf9] px-4 py-2.5 text-[#2f2521] placeholder-[#a99a90] shadow-sm',
              'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-maroon-500/10',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-[#cf8b83] focus:border-[#a94f47]'
                : 'border-[#ded2c8] hover:border-[#cdbdb1] focus:border-maroon-500',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9b8d84]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-[#9b4943]">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-[#85766d]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
