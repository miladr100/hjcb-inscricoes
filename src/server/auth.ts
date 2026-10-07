import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SECRET = process.env.SESSION_SECRET || 'troque-esta-chave-em-producao';

export const PASSWORD = process.env.APP_PASSWORD || 'verdadeirospais';

export function sessionToken() {
  return crypto.createHmac('sha256', SECRET).update('hjcb').digest('hex');
}

export async function isAuthed() {
  const jar = await cookies();
  return jar.get('hjcb_session')?.value === sessionToken();
}

export function withSession(res: NextResponse, maxAge: number) {
  res.cookies.set('hjcb_session', maxAge > 0 ? sessionToken() : '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
