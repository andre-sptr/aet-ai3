import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ApiError, readJson, errorResponse } from '@/lib/http';
import { validateTeam } from '@/lib/cms-validation';
type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireAdmin(request);
    const { id } = await params;
    await prisma.teamMember.delete({ where: { id } });
    return Response.json({ message: 'Data dihapus' });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Data tidak ditemukan.');
    const expectedVersion = request.headers.get('if-match')?.replace(/^\"|\"$/g, '');
    if (expectedVersion && expectedVersion !== existing.updatedAt.toISOString()) throw new ApiError(409, 'Konten sudah diubah di sesi lain. Muat ulang daftar sebelum menyimpan.', 'EDIT_CONFLICT');
    const patch = await readJson(request);
    const data = validateTeam({ ...existing, ...patch });
    try {
      return Response.json(await prisma.teamMember.update({ where: { id, updatedAt: existing.updatedAt }, data }));
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') throw new ApiError(409, 'Konten berubah saat penyimpanan. Muat ulang dan coba lagi.', 'EDIT_CONFLICT');
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
