import { NextResponse } from 'next/server';
import { PASSWORD, withSession } from '../../../server/auth';
import { jsonError } from '../../../server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.password !== PASSWORD) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }
    return withSession(NextResponse.json({ ok: true }), 2592000);
  } catch (error) {
    return jsonError(error);
  }
}
