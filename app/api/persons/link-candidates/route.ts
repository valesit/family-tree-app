import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const id = (session?.user as {id?: string} | undefined)?.id;
  if (!id) return NextResponse.json({success:false,error:'Sign in required'}, {status:401});
  const account = await prisma.user.findUnique({where:{id},select:{role:true}});
  if (!account || account.role === 'VIEWER') return NextResponse.json({success:false,error:'Contributor access required'},{status:403});
  const query = (request.nextUrl.searchParams.get('query') || '').trim().slice(0,200);
  const page = Math.max(1, Math.min(100000, Number.parseInt(request.nextUrl.searchParams.get('page') || '1') || 1));
  const where = {deletedAt:null, AND:query.split(/\s+/).filter(Boolean).map(word=>({OR:[{firstName:{contains:word,mode:'insensitive' as const}},{lastName:{contains:word,mode:'insensitive' as const}},{nickname:{contains:word,mode:'insensitive' as const}}]}))};
  const [items,total] = await Promise.all([prisma.person.findMany({where,select:{id:true,firstName:true,lastName:true,nickname:true,birthDate:true,profileImage:{select:{url:true}}},orderBy:[{firstName:'asc'},{lastName:'asc'},{id:'asc'}],skip:(page-1)*30,take:30}),prisma.person.count({where})]);
  return NextResponse.json({success:true,data:{items,totalPages:Math.ceil(total/30)}},{headers:{'Cache-Control':'no-store'}});
}
