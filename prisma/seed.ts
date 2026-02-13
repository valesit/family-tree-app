import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Set up Prisma with the adapter (required for Prisma 7+)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@familytree.com' },
    update: {},
    create: {
      email: 'admin@familytree.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create sample family members - The Sithole Family
  // Generation 1 - Great Grandparents
  const greatGrandfather = await prisma.person.upsert({
    where: { id: 'ggf-sithole-001' },
    update: {},
    create: {
      id: 'ggf-sithole-001',
      firstName: 'Mzwakhe',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('1920-03-15'),
      birthPlace: 'Bulawayo, Zimbabwe',
      deathDate: new Date('1995-08-22'),
      deathPlace: 'Harare, Zimbabwe',
      occupation: 'Farmer & Community Elder',
      biography: 'Mzwakhe was a respected farmer and community leader who helped establish the Sithole family homestead. He was known for his wisdom and fair judgment in settling local disputes.',
      isLiving: false,
      isNotable: true,
      notableTitle: 'Family Patriarch & Community Leader',
      notableDescription: 'Founded the Sithole family homestead and served as a community elder for over 40 years. His legacy of hard work and integrity continues to inspire generations.',
      notableAchievements: JSON.stringify(['Founded family homestead in 1945', 'Community elder for 40+ years', 'Sent 8 children to university']),
    },
  });

  const greatGrandmother = await prisma.person.upsert({
    where: { id: 'ggm-sithole-001' },
    update: {},
    create: {
      id: 'ggm-sithole-001',
      firstName: 'Thandiwe',
      lastName: 'Sithole',
      maidenName: 'Moyo',
      gender: 'FEMALE',
      birthDate: new Date('1925-07-10'),
      birthPlace: 'Gweru, Zimbabwe',
      deathDate: new Date('2010-12-05'),
      deathPlace: 'Harare, Zimbabwe',
      occupation: 'Teacher & Midwife',
      biography: 'Thandiwe was a beloved teacher and traditional midwife who delivered hundreds of babies in her community. She was known for her herbal remedies and caring nature.',
      isLiving: false,
      isNotable: true,
      notableTitle: 'Educator & Traditional Healer',
      notableDescription: 'A pioneer in rural education who also served as a midwife, delivering over 500 babies. She established the first reading group for women in her village.',
      notableAchievements: JSON.stringify(['Delivered 500+ babies', 'Founded women\'s reading group', 'Taught for 35 years']),
    },
  });

  // Create spouse relationship for great grandparents
  await prisma.relationship.upsert({
    where: { id: 'rel-gg-spouse-001' },
    update: {},
    create: {
      id: 'rel-gg-spouse-001',
      type: 'SPOUSE',
      spouse1Id: greatGrandfather.id,
      spouse2Id: greatGrandmother.id,
      startDate: new Date('1942-06-15'),
    },
  });

  // Generation 2 - Grandparents
  const grandfather = await prisma.person.upsert({
    where: { id: 'gf-sithole-001' },
    update: {},
    create: {
      id: 'gf-sithole-001',
      firstName: 'Joseph',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('1948-11-20'),
      birthPlace: 'Harare, Zimbabwe',
      deathDate: new Date('2018-04-10'),
      deathPlace: 'Johannesburg, South Africa',
      occupation: 'Engineer',
      biography: 'Joseph was a civil engineer who worked on major infrastructure projects across Southern Africa. He was instrumental in mentoring young engineers.',
      isLiving: false,
    },
  });

  const grandmother = await prisma.person.upsert({
    where: { id: 'gm-sithole-001' },
    update: {},
    create: {
      id: 'gm-sithole-001',
      firstName: 'Grace',
      lastName: 'Sithole',
      maidenName: 'Ndlovu',
      gender: 'FEMALE',
      birthDate: new Date('1952-05-08'),
      birthPlace: 'Mutare, Zimbabwe',
      occupation: 'Nurse',
      biography: 'Grace is a retired nurse who dedicated her life to healthcare. She continues to volunteer at local clinics.',
      isLiving: true,
    },
  });

  // Parent-child relationships for grandparents
  await prisma.relationship.upsert({
    where: { id: 'rel-gf-child-001' },
    update: {},
    create: {
      id: 'rel-gf-child-001',
      type: 'PARENT_CHILD',
      parentId: greatGrandfather.id,
      childId: grandfather.id,
    },
  });

  await prisma.relationship.upsert({
    where: { id: 'rel-gm-child-001' },
    update: {},
    create: {
      id: 'rel-gm-child-001',
      type: 'PARENT_CHILD',
      parentId: greatGrandmother.id,
      childId: grandfather.id,
    },
  });

  // Spouse relationship for grandparents
  await prisma.relationship.upsert({
    where: { id: 'rel-g-spouse-001' },
    update: {},
    create: {
      id: 'rel-g-spouse-001',
      type: 'SPOUSE',
      spouse1Id: grandfather.id,
      spouse2Id: grandmother.id,
      startDate: new Date('1972-12-20'),
    },
  });

  // Generation 3 - Parents
  const father = await prisma.person.upsert({
    where: { id: 'f-sithole-001' },
    update: {},
    create: {
      id: 'f-sithole-001',
      firstName: 'David',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('1975-09-14'),
      birthPlace: 'Johannesburg, South Africa',
      occupation: 'Software Developer',
      biography: 'David is a software developer who has worked for several tech companies. He enjoys hiking and photography.',
      isLiving: true,
    },
  });

  const mother = await prisma.person.upsert({
    where: { id: 'm-sithole-001' },
    update: {},
    create: {
      id: 'm-sithole-001',
      firstName: 'Sarah',
      lastName: 'Sithole',
      maidenName: 'Dube',
      gender: 'FEMALE',
      birthDate: new Date('1978-02-28'),
      birthPlace: 'Cape Town, South Africa',
      occupation: 'Doctor',
      biography: 'Sarah is a general practitioner who runs her own clinic. She is passionate about community health.',
      isLiving: true,
      isNotable: true,
      notableTitle: 'Community Health Champion',
      notableDescription: 'Founded a free clinic for underserved communities and has provided healthcare to thousands of patients who otherwise would have no access to medical care.',
      notableAchievements: JSON.stringify(['Founded free community clinic', 'Treated 10,000+ patients', 'Medical outreach program leader']),
    },
  });

  // Uncle
  const uncle = await prisma.person.upsert({
    where: { id: 'u-sithole-001' },
    update: {},
    create: {
      id: 'u-sithole-001',
      firstName: 'Michael',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('1973-04-05'),
      birthPlace: 'Johannesburg, South Africa',
      occupation: 'Lawyer',
      biography: 'Michael is a human rights lawyer who has worked on several landmark cases.',
      isLiving: true,
    },
  });

  // Parent-child relationships for parents
  await prisma.relationship.upsert({
    where: { id: 'rel-f-child-001' },
    update: {},
    create: {
      id: 'rel-f-child-001',
      type: 'PARENT_CHILD',
      parentId: grandfather.id,
      childId: father.id,
    },
  });

  await prisma.relationship.upsert({
    where: { id: 'rel-f-child-002' },
    update: {},
    create: {
      id: 'rel-f-child-002',
      type: 'PARENT_CHILD',
      parentId: grandmother.id,
      childId: father.id,
    },
  });

  await prisma.relationship.upsert({
    where: { id: 'rel-u-child-001' },
    update: {},
    create: {
      id: 'rel-u-child-001',
      type: 'PARENT_CHILD',
      parentId: grandfather.id,
      childId: uncle.id,
    },
  });

  await prisma.relationship.upsert({
    where: { id: 'rel-u-child-002' },
    update: {},
    create: {
      id: 'rel-u-child-002',
      type: 'PARENT_CHILD',
      parentId: grandmother.id,
      childId: uncle.id,
    },
  });

  // Spouse relationship for parents
  await prisma.relationship.upsert({
    where: { id: 'rel-p-spouse-001' },
    update: {},
    create: {
      id: 'rel-p-spouse-001',
      type: 'SPOUSE',
      spouse1Id: father.id,
      spouse2Id: mother.id,
      startDate: new Date('2002-08-15'),
    },
  });

  // Generation 4 - Children (Current Generation)
  const child1 = await prisma.person.upsert({
    where: { id: 'c-sithole-001' },
    update: {},
    create: {
      id: 'c-sithole-001',
      firstName: 'Tendai',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('2005-06-12'),
      birthPlace: 'Johannesburg, South Africa',
      occupation: 'Student',
      biography: 'Tendai is a university student studying Computer Science. He is passionate about technology and gaming.',
      isLiving: true,
    },
  });

  const child2 = await prisma.person.upsert({
    where: { id: 'c-sithole-002' },
    update: {},
    create: {
      id: 'c-sithole-002',
      firstName: 'Rudo',
      lastName: 'Sithole',
      gender: 'FEMALE',
      birthDate: new Date('2008-03-25'),
      birthPlace: 'Johannesburg, South Africa',
      occupation: 'High School Student',
      biography: 'Rudo is a high school student who loves music and art. She dreams of becoming a graphic designer.',
      isLiving: true,
    },
  });

  const child3 = await prisma.person.upsert({
    where: { id: 'c-sithole-003' },
    update: {},
    create: {
      id: 'c-sithole-003',
      firstName: 'Tafadzwa',
      lastName: 'Sithole',
      gender: 'MALE',
      birthDate: new Date('2012-11-08'),
      birthPlace: 'Johannesburg, South Africa',
      occupation: 'Primary School Student',
      biography: 'Tafadzwa is the youngest of the family. He loves soccer and animals.',
      isLiving: true,
    },
  });

  // Cousin
  const cousin = await prisma.person.upsert({
    where: { id: 'cousin-sithole-001' },
    update: {},
    create: {
      id: 'cousin-sithole-001',
      firstName: 'Chipo',
      lastName: 'Sithole',
      gender: 'FEMALE',
      birthDate: new Date('2003-09-18'),
      birthPlace: 'Pretoria, South Africa',
      occupation: 'Law Student',
      biography: 'Chipo is studying law, following in her father\'s footsteps.',
      isLiving: true,
    },
  });

  // Parent-child relationships for current generation
  const childRelations = [
    { parentId: father.id, childId: child1.id, id: 'rel-c1-f' },
    { parentId: mother.id, childId: child1.id, id: 'rel-c1-m' },
    { parentId: father.id, childId: child2.id, id: 'rel-c2-f' },
    { parentId: mother.id, childId: child2.id, id: 'rel-c2-m' },
    { parentId: father.id, childId: child3.id, id: 'rel-c3-f' },
    { parentId: mother.id, childId: child3.id, id: 'rel-c3-m' },
    { parentId: uncle.id, childId: cousin.id, id: 'rel-cousin-u' },
  ];

  for (const rel of childRelations) {
    await prisma.relationship.upsert({
      where: { id: rel.id },
      update: {},
      create: {
        id: rel.id,
        type: 'PARENT_CHILD',
        parentId: rel.parentId,
        childId: rel.childId,
      },
    });
  }

  // Link admin to the father person (so they can edit the tree)
  await prisma.person.update({
    where: { id: father.id },
    data: { userId: admin.id },
  });

  // Create a sample wiki article
  await prisma.wikiArticle.upsert({
    where: { slug: 'sithole-family-history' },
    update: {},
    create: {
      title: 'The Sithole Family History',
      slug: 'sithole-family-history',
      content: `# The Sithole Family Legacy

Our family story begins in the rolling hills of Bulawayo, Zimbabwe, where our great-grandfather **Mzwakhe Sithole** established the family homestead in 1945.

## The Early Years

Mzwakhe was a visionary farmer who believed in the power of education. Despite the challenges of his time, he ensured all eight of his children received a proper education.

## Migration to South Africa

In the 1970s, several family members moved to South Africa seeking better opportunities. Joseph Sithole, Mzwakhe's eldest son, became a civil engineer and contributed to major infrastructure projects.

## Our Values

The Sithole family has always valued:
- **Education** - Every generation has prioritized learning
- **Community Service** - Giving back to those in need
- **Family Unity** - Staying connected across distances
- **Hard Work** - Building our own success through dedication

## Looking Forward

Today, our family spans multiple countries and continents, but we remain connected through our shared history and values. This family tree application is one way we're preserving our legacy for future generations.`,
      excerpt: 'Discover the rich history of the Sithole family, from the rolling hills of Zimbabwe to cities across Southern Africa.',
      isPublished: true,
      authorId: admin.id,
      viewCount: 42,
    },
  });

  // Create Family record so home page shows the tree
  await prisma.family.upsert({
    where: { rootPersonId: greatGrandfather.id },
    update: { name: 'Sithole/Moyo Family' },
    create: {
      rootPersonId: greatGrandfather.id,
      name: 'Sithole/Moyo Family',
      createdById: admin.id,
    },
  });

  console.log('✅ Sample family tree created with 12 members across 4 generations');
  console.log('✅ Sample wiki article created');
  console.log('✅ Family record created for home page');
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ADMIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Email:    admin@familytree.com');
  console.log('  Password: Admin123!');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

