'use client';

import { Fragment, ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  return (
    <Fragment>
      <div
        className="fixed inset-0 z-40 bg-[#2f2521]/45 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={clsx(
            'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#e5d9ce] bg-[#fffdf9] shadow-[0_28px_90px_-30px_rgba(45,31,24,0.42)]',
            'animate-in fade-in zoom-in-95 duration-200',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between border-b border-[#e9dfd6] px-6 py-4">
              <h2 className="font-serif text-xl font-semibold text-[#332720]">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full text-[#7a6b62] transition hover:bg-[#f5efe9] hover:text-[#332720]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </Fragment>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={clsx(
        'mt-4 flex items-center justify-end gap-3 border-t border-[#e9dfd6] pt-4',
        className
      )}
    >
      {children}
    </div>
  );
}
