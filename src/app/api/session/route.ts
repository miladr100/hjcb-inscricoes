import { NextResponse } from 'next/server';
import { isAuthed } from '../../../server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (await isAuthed()) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
}
