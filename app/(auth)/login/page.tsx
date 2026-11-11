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
    <Card className="w-full max-w-md relative z-10 border border-[#e6dcd3] bg-[#fffdf9] shadow-[0_20px_60px_-34px_rgba(74,46,32,0.3)]">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-maroon-500 rounded-xl mb-4 shadow-sm">
          <TreePine className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-[#332720]">Welcome Back</h1>
        <p className="text-[#66574f] mt-1">Sign in to your family tree</p>
      </div>

      {/* Login method toggle */}
      <div className="flex bg-[#f5efe9] rounded-xl p-1 mb-6">
        <button
          type="button"
          onClick={() => setLoginMethod('email')}
          className={`flex-1 min-h-11 py-2 px-4 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 ${
            loginMethod === 'email'
              ? 'bg-white text-[#332720] shadow-sm'
              : 'text-[#66574f] hover:text-[#4b3d36]'
          }`}
        >
          <Mail className="w-4 h-4 inline-block mr-2" />
          Email
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('phone')}
          className={`flex-1 min-h-11 py-2 px-4 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 ${
            loginMethod === 'phone'
              ? 'bg-white text-[#332720] shadow-sm'
              : 'text-[#66574f] hover:text-[#4b3d36]'
          }`}
        >
          <Phone className="w-4 h-4 inline-block mr-2" />
          Phone
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#fbf7f2] border border-[#e5d9ce] rounded-xl text-red-700 text-sm">
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
              className="w-4 h-4 rounded border-[#d8c8bc] text-maroon-600 focus:ring-maroon-500"
            />
            <span className="ml-2 text-[#66574f]">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-maroon-600 hover:text-maroon-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} size="lg">
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#66574f]">
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
    <Card className="w-full max-w-md flex items-center justify-center border border-[#e6dcd3] py-20">
      <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="heritage-auth-shell flex items-center justify-center px-4 py-10">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
