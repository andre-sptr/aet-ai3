import { prisma } from '@/lib/prisma';
import { requireAdmin, isAdmin } from '@/lib/auth';
import { readJson, errorResponse } from '@/lib/http';
import { validateTeam } from '@/lib/cms-validation';
export async function GET(request: Request) {
  try {
    isAdmin(request);
    const items = await prisma.teamMember.findMany({ orderBy: { order: 'asc' } });
    return Response.json(items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const data = validateTeam(await readJson(request));
    return Response.json(await prisma.teamMember.create({ data }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
