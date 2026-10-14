import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../../server/http';
import { findDuplicateMember, updateMember, type MemberBody } from '../../../../server/sheets';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ row: string }> };

export async function PUT(request: Request, context: Context) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { row: raw } = await context.params;
    const row = +raw;
    const body = (await request.json()) as MemberBody;
    if (await findDuplicateMember(body, row)) {
      return NextResponse.json({ error: 'Já existe outro membro com estes dados.' }, { status: 409 });
    }
    await updateMember(row, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
