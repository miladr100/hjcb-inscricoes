import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../../server/http';
import { deleteRegistrations, markRegistrationsPaid } from '../../../../server/sheets';

export const dynamic = 'force-dynamic';

type BulkBody = { action?: 'delete' | 'markPaid'; ids?: string[] };

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { action, ids } = (await request.json()) as BulkBody;
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'Nenhuma inscrição selecionada.' }, { status: 400 });
    }
    if (action === 'delete') return NextResponse.json({ ok: true, count: await deleteRegistrations(ids) });
    if (action === 'markPaid') return NextResponse.json({ ok: true, count: await markRegistrationsPaid(ids) });
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
