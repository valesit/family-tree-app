'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { clsx } from 'clsx';
import {
  TreePine,
  MessageSquare,
  Bell,
  CheckCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Plus,
  FileEdit,
  LogIn,
  UserPlus,
  Home,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { SessionUser } from '@/types';

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  // Navigation items for authenticated users
  const authNavItems = [
    { href: '/tree', label: 'Family Tree', icon: TreePine },
    { href: '/approvals', label: 'Approvals', icon: CheckCircle },
    { href: '/corrections', label: 'Corrections', icon: FileEdit },
    { href: '/messages', label: 'Messages', icon: MessageSquare },
  ];

  // Navigation items for guests
  const guestNavItems = [
    { href: '/', label: 'View Tree', icon: Home },
  ];

  const navItems = isAuthenticated ? authNavItems : guestNavItems;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TreePine className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 hidden sm:block">
              FamilyTree
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
            ) : isAuthenticated ? (
              <>
                {/* Search */}
                <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <Search className="w-5 h-5" />
                </button>

                {/* Add Person */}
                <Link href="/add-person">
                  <Button size="sm" className="hidden sm:flex">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Person
                  </Button>
                </Link>

                {/* Notifications */}
                <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                </button>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Avatar
                      src={user?.image}
                      name={user?.name || 'User'}
                      size="sm"
                    />
                  </button>

                  {isProfileOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsProfileOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="font-medium text-slate-900">{user?.name}</p>
                          <p className="text-sm text-slate-500">
                            {user?.email || user?.phone}
                          </p>
                        </div>
                        <Link
                          href="/profile"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </Link>
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Guest options */}
                <Link
                  href="/login"
                  className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                  href="/register"
                  className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Join</span>
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 py-3 px-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={clsx(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {isAuthenticated && (
              <Link
                href="/add-person"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-emerald-600 hover:bg-emerald-50"
              >
                <Plus className="w-5 h-5" />
                <span>Add Person</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
