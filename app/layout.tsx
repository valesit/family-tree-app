import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'FamilyTree - Build Your Family Tree Together',
  description: 'A collaborative platform for families to document their heritage, share stories, and preserve memories for generations to come.',
  keywords: ['family tree', 'genealogy', 'family history', 'ancestry'],
  openGraph: {
    title: 'FamilyTree - Build Your Family Tree Together',
    description: 'A collaborative platform for families to document their heritage.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
