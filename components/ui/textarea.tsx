'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-[#5e4f47]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'block w-full resize-none rounded-xl border bg-[#fffdf9] px-4 py-2.5 text-[#2f2521] placeholder-[#a99a90] shadow-sm',
            'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-maroon-500/10',
            error
              ? 'border-[#cf8b83] focus:border-[#a94f47]'
              : 'border-[#ded2c8] hover:border-[#cdbdb1] focus:border-maroon-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-[#9b4943]">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-[#85766d]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
