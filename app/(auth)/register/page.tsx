'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, Lock, User, TreePine, CheckCircle, LinkIcon } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { registerSchema, RegisterInput } from '@/lib/validators';
import { signIn } from 'next-auth/react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if user is claiming a profile
  const claimPersonId = searchParams.get('claimPersonId');
  const claimPersonName = searchParams.get('name');
  
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      name: claimPersonName || '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError(null);

    try {
      // Register the user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email: registerMethod === 'email' ? data.email : undefined,
          phone: registerMethod === 'phone' ? data.phone : undefined,
          claimPersonId, // Pass the person ID to claim
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      setSuccess(true);
      
      // If claiming a profile, sign in and redirect to the profile
      if (claimPersonId) {
        const signInResult = await signIn('credentials', {
          email: registerMethod === 'email' ? data.email : undefined,
          phone: registerMethod === 'phone' ? data.phone : undefined,
          password: data.password,
          redirect: false,
        });

        if (signInResult?.ok) {
          // Claim the profile
          await fetch(`/api/persons/${claimPersonId}/claim`, {
            method: 'POST',
          });
          
          setTimeout(() => {
            router.push(`/person/${claimPersonId}`);
          }, 1500);
        } else {
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        }
      } else {
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="heritage-auth-shell flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border border-[#e6dcd3] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight text-[#332720] mb-2">
            {claimPersonId ? 'Welcome to the Family!' : 'Account Created!'}
          </h2>
          <p className="text-[#66574f]">
            {claimPersonId 
              ? `Your account has been created and linked to ${claimPersonName || 'your profile'}. Redirecting...`
              : 'Your account has been created successfully. Redirecting you to login...'
            }
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="heritage-auth-shell flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md relative z-10 border border-[#e6dcd3] bg-[#fffdf9] shadow-[0_20px_60px_-34px_rgba(74,46,32,0.3)]">
        {/* Claiming profile banner */}
        {claimPersonId && (
          <div className="mb-6 p-4 bg-[#f5ece7] border border-[#e3ccc6] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ead9ce] rounded-full flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-maroon-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-maroon-700">Claiming Profile</p>
                <p className="text-xs text-maroon-600">
                  Creating account for <strong>{claimPersonName || 'family member'}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-maroon-500 rounded-xl mb-4 shadow-sm">
            <TreePine className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#332720]">
            {claimPersonId ? 'Create Your Account' : 'Join Your Family Tree'}
          </h1>
          <p className="text-[#66574f] mt-1">
            {claimPersonId 
              ? 'Sign up to connect with your family'
              : 'Create an account to get started'
            }
          </p>
        </div>

        {/* Register method toggle */}
        <div className="flex bg-[#f5efe9] rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setRegisterMethod('email')}
            className={`flex-1 min-h-11 py-2 px-4 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 ${
              registerMethod === 'email'
                ? 'bg-white text-[#332720] shadow-sm'
                : 'text-[#66574f] hover:text-[#4b3d36]'
            }`}
          >
            <Mail className="w-4 h-4 inline-block mr-2" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setRegisterMethod('phone')}
            className={`flex-1 min-h-11 py-2 px-4 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 ${
              registerMethod === 'phone'
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
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            leftIcon={<User className="w-5 h-5" />}
            error={errors.name?.message}
            {...register('name')}
          />

          {registerMethod === 'email' ? (
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
            hint="Min 8 characters with uppercase, lowercase, and number"
            {...register('password')}
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="w-5 h-5" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="flex items-start">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-[#d8c8bc] text-maroon-600 focus:ring-maroon-500 mt-0.5"
              required
            />
            <span className="ml-2 text-sm text-[#66574f]">
              I agree to the{' '}
              <Link href="/terms" className="text-maroon-600 hover:text-maroon-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-maroon-600 hover:text-maroon-700">
                Privacy Policy
              </Link>
            </span>
          </div>

          <Button type="submit" fullWidth isLoading={isLoading} size="lg">
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#66574f]">
          Already have an account?{' '}
          <Link 
            href={claimPersonId ? `/login?callbackUrl=/person/${claimPersonId}` : '/login'} 
            className="text-maroon-600 hover:text-maroon-700 font-medium"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="heritage-auth-shell flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md text-center">
          <div className="animate-pulse">Loading...</div>
        </Card>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

