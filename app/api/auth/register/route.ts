import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { email, phone, password, name } = validationResult.data;

    // Check if user already exists
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 400 }
        );
      }
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        return NextResponse.json(
          { success: false, error: 'Phone number already registered' },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        name,
        role: 'MEMBER',
      },
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'WELCOME',
        title: 'Welcome to the Family Tree!',
        message: 'Start by exploring the tree or adding yourself and your family members.',
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'USER_JOINED',
        description: `${name} joined the family tree`,
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register. Please try again.' },
      { status: 500 }
    );
  }
}

