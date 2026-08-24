'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-[#5e4f47]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'block w-full cursor-pointer appearance-none rounded-xl border bg-[#fffdf9] px-4 py-2.5 pr-10 text-[#2f2521] shadow-sm',
              'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-maroon-500/10',
              error
                ? 'border-[#cf8b83] focus:border-[#a94f47]'
                : 'border-[#ded2c8] hover:border-[#cdbdb1] focus:border-maroon-500',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#9b8d84]">
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
        {error && <p className="mt-1.5 text-sm text-[#9b4943]">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
