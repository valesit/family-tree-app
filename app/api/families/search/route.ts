import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/families/search?surname=Moyo - Search for family trees by surname
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const surname = searchParams.get('surname');

    if (!surname) {
      return NextResponse.json({ success: false, error: 'Surname is required' }, { status: 400 });
    }

    // Find all root persons (people with no parents) with the given surname
    const rootPersons = await prisma.person.findMany({
      where: {
        lastName: {
          equals: surname,
          mode: 'insensitive', // Case-insensitive search
        },
        // Root persons have no parent relationships
        parentRelations: {
          none: {},
        },
      },
      include: {
        profileImage: true,
        // Include spouse to show family name like "Moyo/Smith"
        spouseRelations1: {
          include: {
            spouse2: {
              select: { lastName: true },
            },
          },
          take: 1,
        },
        spouseRelations2: {
          include: {
            spouse1: {
              select: { lastName: true },
            },
          },
          take: 1,
        },
        // Count descendants
        childRelations: {
          select: { id: true },
        },
      },
      orderBy: {
        birthDate: 'asc',
      },
    });

    // Also check for custom family names in the Family model
    const customFamilies = await prisma.family.findMany({
      where: {
        name: {
          contains: surname,
          mode: 'insensitive',
        },
      },
    });

    // Build family options
    const families = rootPersons.map((person) => {
      // Get spouse surname if available
      const spouseRelation = person.spouseRelations1[0] || person.spouseRelations2[0];
      const spouseSurname = spouseRelation
        ? (person.spouseRelations1[0]?.spouse2?.lastName || person.spouseRelations2[0]?.spouse1?.lastName)
        : null;

      // Check if there's a custom family name
      const customFamily = customFamilies.find(f => f.rootPersonId === person.id);

      // Build family name
      let familyName = customFamily?.name || person.lastName;
      if (!customFamily && spouseSurname && spouseSurname !== person.lastName) {
        familyName = `${person.lastName}/${spouseSurname}`;
      }

      return {
        id: person.id,
        familyName: `${familyName} Family`,
        rootPerson: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          profileImage: person.profileImage?.url || null,
          birthYear: person.birthDate ? new Date(person.birthDate).getFullYear() : null,
        },
        memberCount: person.childRelations.length + 1, // Rough estimate
        hasCustomName: !!customFamily,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        families,
        surname,
        count: families.length,
      },
    });
  } catch (error) {
    console.error('Error searching families:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search families' },
      { status: 500 }
    );
  }
}

