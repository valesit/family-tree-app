import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { messageSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/messages - Get conversations and messages
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId'); // For direct messages

    if (conversationId) {
      // Get messages from a specific conversation
      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          conversationId,
          receiverId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, data: messages });
    }

    if (userId) {
      // Get direct messages with a specific user
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.id, receiverId: userId },
            { senderId: userId, receiverId: user.id },
          ],
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          senderId: userId,
          receiverId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, data: messages });
    }

    // Get all conversations
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: user.id },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
        participants: {
          include: {
            // We can't include user here, so we'll handle it separately
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get recent direct message contacts
    const recentDMs = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
        conversationId: null,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['senderId', 'receiverId'],
    });

    // Process to get unique contacts
    const contactMap = new Map();
    recentDMs.forEach(msg => {
      const contact = msg.senderId === user.id ? msg.receiver : msg.sender;
      if (contact && !contactMap.has(contact.id)) {
        contactMap.set(contact.id, {
          user: contact,
          lastMessage: msg,
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        conversations,
        directMessages: Array.from(contactMap.values()),
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

// POST /api/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();

    // Validate message data
    const validationResult = messageSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { content, receiverId, conversationId } = validationResult.data;

    // Create the message
    const message = await prisma.message.create({
      data: {
        content,
        senderId: user.id,
        receiverId,
        conversationId,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Update conversation timestamp if exists
    if (conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    // Create notification for receiver
    if (receiverId) {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'NEW_MESSAGE',
          title: 'New Message',
          message: `${user.name} sent you a message`,
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

