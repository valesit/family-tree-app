'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, Lock, TreePine, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { loginSchema, LoginInput } from '@/lib/validators';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/tree';
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      phone: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: loginMethod === 'email' ? data.email : undefined,
        phone: loginMethod === 'phone' ? data.phone : undefined,
        password: data.password,
      });

      if (result?.error) {
        setError('Invalid credentials. Please try again.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-2xl mb-4 shadow-lg shadow-maroon-500/30">
          <TreePine className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
        <p className="text-slate-500 mt-1">Sign in to your family tree</p>
      </div>

      {/* Login method toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
        <button
          type="button"
          onClick={() => setLoginMethod('email')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            loginMethod === 'email'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="w-4 h-4 inline-block mr-2" />
          Email
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('phone')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            loginMethod === 'phone'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone className="w-4 h-4 inline-block mr-2" />
          Phone
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {loginMethod === 'email' ? (
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="w-5 h-5" />}
            error={errors.email?.message}
            {...register('email')}
          />
        ) : (
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            leftIcon={<Phone className="w-5 h-5" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
        )}

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          leftIcon={<Lock className="w-5 h-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500"
            />
            <span className="ml-2 text-slate-600">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-maroon-600 hover:text-maroon-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} size="lg">
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-maroon-600 hover:text-maroon-700 font-medium">
          Create one
        </Link>
      </p>
    </Card>
  );
}

function LoginFallback() {
  return (
    <Card className="w-full max-w-md flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-50 via-rose-50 to-amber-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-maroon-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-maroon-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />
      </div>

      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
