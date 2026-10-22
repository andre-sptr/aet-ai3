import { prisma } from '@/lib/prisma';
import { requireAdmin, isAdmin } from '@/lib/auth';
import { readJson, errorResponse } from '@/lib/http';
import { validateNews } from '@/lib/cms-validation';
export async function GET(request: Request) {
  try {
    
    const items = await prisma.news.findMany({ where: isAdmin(request) ? {} : { published: true }, orderBy: { createdAt: 'desc' } });
    return Response.json(items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const data = validateNews(await readJson(request));
    return Response.json(await prisma.news.create({ data }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
