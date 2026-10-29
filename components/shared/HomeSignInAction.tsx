'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LogIn } from 'lucide-react';

/**
 * Adds a direct Sign in action beside the existing public Join action without
 * duplicating the homepage navigation. The host is inserted immediately before
 * the Join link so it participates in the same responsive flex layout.
 */
export function HomeSignInAction() {
  const pathname = usePathname();
  const { status } = useSession();
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== '/' || status !== 'unauthenticated') {
      setPortalHost(null);
      return;
    }

    const joinLink = document.querySelector<HTMLAnchorElement>('nav a[href="/register"]');
    const parent = joinLink?.parentElement;
    if (!joinLink || !parent) return;

    const existing = parent.querySelector<HTMLElement>('[data-home-signin-host="true"]');
    if (existing) {
      setPortalHost(existing);
      return;
    }

    const host = document.createElement('span');
    host.dataset.homeSigninHost = 'true';
    host.className = 'inline-flex';
    parent.insertBefore(host, joinLink);
    setPortalHost(host);

    return () => {
      host.remove();
      setPortalHost(null);
    };
  }, [pathname, status]);

  if (!portalHost || status !== 'unauthenticated') return null;

  return createPortal(
    <Link
      href="/login"
      aria-label="Sign in"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfd1c5] bg-[#fffdf9] px-3 text-xs font-semibold text-maroon-700 shadow-sm transition hover:border-[#c9ab98] hover:bg-white sm:px-3.5 sm:text-sm"
    >
      <LogIn className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign in</span>
    </Link>,
    portalHost
  );
}
