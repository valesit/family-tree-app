import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { Navbar } from '@/components/shared/navbar';

interface MainLayoutProps {
  children: ReactNode;
}

// Pages that require authentication
const protectedPaths = [
  '/add-person',
  '/approvals',
  '/corrections',
  '/messages',
  '/profile',
];

export default async function MainLayout({ children }: MainLayoutProps) {
  const session = await getServerSession(authOptions);
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Check if current path requires authentication
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath && !session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
  );
}
