import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { messageSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import { getUserFamilies } from '@/lib/family-membership';

async function familyIdsForUser(userId: string): Promise<string[]> {
  const memberships = await getUserFamilies(userId);
  return memberships.map((membership) => membership.family.id);
}

async function canDirectMessage(
  sender: SessionUser,
  receiverId: string
): Promise<boolean> {
  if (!receiverId || receiverId === sender.id) return false;

  // The recipient must have claimed a family-tree profile. That is what makes
  // them an active family profile rather than just an account in the database.
  const linkedRecipient = await prisma.person.findFirst({
    where: { userId: receiverId },
    select: { id: true },
  });
  if (!linkedRecipient) return false;

  if (sender.role === 'ADMIN') return true;

  const familyIds = await familyIdsForUser(sender.id);
  if (familyIds.length === 0) return false;

  const sharedMembership = await prisma.familyMembership.findFirst({
    where: {
      userId: receiverId,
      familyId: { in: familyIds },
    },
    select: { id: true },
  });
  return !!sharedMembership;
}

async function activeFamilyContacts(user: SessionUser) {
  const familyIds = user.role === 'ADMIN' ? [] : await familyIdsForUser(user.id);

  const people = await prisma.person.findMany({
    where: {
      userId: { not: null },
      NOT: { userId: user.id },
      ...(user.role === 'ADMIN'
        ? {}
        : {
            familyLinks: {
              some: { familyId: { in: familyIds } },
            },
          }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: { select: { url: true } },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          whatsappOptIn: true,
          role: true,
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const byUserId = new Map<string, {
    id: string;
    name: string;
    image: string | null;
    phone: string | null;
    whatsappOptIn: boolean;
    personId: string;
  }>();

  for (const person of people) {
    if (!person.user) continue;
    if (byUserId.has(person.user.id)) continue;
    byUserId.set(person.user.id, {
      id: person.user.id,
      name: `${person.firstName} ${person.lastName}`.trim() || person.user.name || 'Family member',
      image: person.profileImage?.url || person.user.image || null,
      phone:
        person.user.whatsappOptIn && person.user.phone
          ? person.user.phone
          : null,
      whatsappOptIn: person.user.whatsappOptIn,
      personId: person.id,
    });
  }

  return Array.from(byUserId.values());
}

// GET /api/messages - conversations, a DM thread, or the active family directory.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId: user.id } },
        },
        select: { id: true },
      });
      if (!conversation) {
        return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      await prisma.message.updateMany({
        where: { conversationId, receiverId: user.id, isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, data: messages });
    }

    if (userId) {
      if (!(await canDirectMessage(user, userId))) {
        return NextResponse.json(
          { success: false, error: 'You can only message active members of your family' },
          { status: 403 }
        );
      }

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.id, receiverId: userId },
            { senderId: userId, receiverId: user.id },
          ],
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      await prisma.message.updateMany({
        where: { senderId: userId, receiverId: user.id, isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, data: messages });
    }

    const [conversations, recentDMs, availableContacts] = await Promise.all([
      prisma.conversation.findMany({
        where: { participants: { some: { userId: user.id } } },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, name: true } } },
          },
          participants: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.message.findMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
          conversationId: null,
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      activeFamilyContacts(user),
    ]);

    type RecentDM = typeof recentDMs[number];
    const contactMap = new Map<string, { user: NonNullable<RecentDM['sender']>; lastMessage: RecentDM }>();
    for (const msg of recentDMs) {
      const contact = msg.senderId === user.id ? msg.receiver : msg.sender;
      if (contact && !contactMap.has(contact.id)) {
        contactMap.set(contact.id, { user: contact, lastMessage: msg });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        conversations,
        directMessages: Array.from(contactMap.values()),
        availableContacts,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages - send a direct or group message.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const validationResult = messageSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { content, receiverId, conversationId } = validationResult.data;

    if (receiverId && !(await canDirectMessage(user, receiverId))) {
      return NextResponse.json(
        { success: false, error: 'You can only message active members of your family' },
        { status: 403 }
      );
    }

    if (conversationId) {
      const participant = await prisma.conversationParticipant.findUnique({
        where: { userId_conversationId: { userId: user.id, conversationId } },
        select: { id: true },
      });
      if (!participant) {
        return NextResponse.json({ success: false, error: 'Not part of this conversation' }, { status: 403 });
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId: user.id,
        receiverId,
        conversationId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    if (conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    if (receiverId) {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'NEW_MESSAGE',
          title: 'New Message',
          message: `${user.name || 'A family member'} sent you a message`,
          data: { senderId: user.id, messageId: message.id },
        },
      });
    }

    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
