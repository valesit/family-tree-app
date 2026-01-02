'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Button, Input, Avatar } from '@/components/ui';
import { profileSchema, passwordChangeSchema, ProfileInput, PasswordChangeInput } from '@/lib/validators';
import { SessionUser } from '@/types';
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Shield,
  LogOut,
  Camera,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [activeSection, setActiveSection] = useState<'profile' | 'password' | 'notifications'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const user = session?.user as SessionUser | undefined;

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  });

  const passwordForm = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const handleProfileUpdate = async (data: ProfileInput) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await update({ name: data.name });
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (data: PasswordChangeInput) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        passwordForm.reset();
      } else {
        throw new Error('Failed to change password');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to change password. Please check your current password.' });
    } finally {
      setIsLoading(false);
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-slate-600 mt-1">Manage your profile and preferences</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <Card padding="sm">
              <div className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === section.id
                          ? 'bg-maroon-50 text-maroon-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {section.label}
                    </button>
                  );
                })}
                <hr className="my-2" />
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </Card>
          </div>

          {/* Main content */}
          <div className="md:col-span-3">
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-maroon-50 text-maroon-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                {message.text}
              </div>
            )}

            {activeSection === 'profile' && (
              <Card>
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Profile Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <Avatar
                      src={user?.image}
                      name={user?.name || 'User'}
                      size="2xl"
                    />
                    <button className="absolute bottom-0 right-0 p-2 bg-maroon-500 text-white rounded-full shadow-lg hover:bg-maroon-600 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{user?.name}</h3>
                    <p className="text-sm text-slate-500">{user?.email || user?.phone}</p>
                    <p className="text-xs text-maroon-600 mt-1 capitalize">{user?.role?.toLowerCase()} Account</p>
                  </div>
                </div>

                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                  <Input
                    label="Full Name"
                    leftIcon={<User className="w-5 h-5" />}
                    error={profileForm.formState.errors.name?.message}
                    {...profileForm.register('name')}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    leftIcon={<Mail className="w-5 h-5" />}
                    error={profileForm.formState.errors.email?.message}
                    {...profileForm.register('email')}
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    leftIcon={<Phone className="w-5 h-5" />}
                    error={profileForm.formState.errors.phone?.message}
                    {...profileForm.register('phone')}
                  />

                  <div className="pt-4">
                    <Button type="submit" isLoading={isLoading}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {activeSection === 'password' && (
              <Card>
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Change Password</h2>

                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    leftIcon={<Lock className="w-5 h-5" />}
                    error={passwordForm.formState.errors.currentPassword?.message}
                    {...passwordForm.register('currentPassword')}
                  />

                  <Input
                    label="New Password"
                    type="password"
                    leftIcon={<Lock className="w-5 h-5" />}
                    error={passwordForm.formState.errors.newPassword?.message}
                    hint="Min 8 characters with uppercase, lowercase, and number"
                    {...passwordForm.register('newPassword')}
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    leftIcon={<Lock className="w-5 h-5" />}
                    error={passwordForm.formState.errors.confirmNewPassword?.message}
                    {...passwordForm.register('confirmNewPassword')}
                  />

                  <div className="pt-4">
                    <Button type="submit" isLoading={isLoading}>
                      Update Password
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card>
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Notification Preferences</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-slate-900 mb-4">Email Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { id: 'email-approvals', label: 'Approval requests', desc: 'Get notified when someone needs your approval' },
                        { id: 'email-messages', label: 'New messages', desc: 'Get notified when you receive a new message' },
                        { id: 'email-members', label: 'New family members', desc: 'Get notified when someone is added to the tree' },
                      ].map((item) => (
                        <label key={item.id} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500 mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-slate-900 mb-4">Push Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { id: 'push-approvals', label: 'Approval requests', desc: 'Real-time push notifications for approvals' },
                        { id: 'push-messages', label: 'New messages', desc: 'Real-time push notifications for messages' },
                      ].map((item) => (
                        <label key={item.id} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500 mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button>Save Preferences</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

