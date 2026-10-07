import { NextResponse } from 'next/server';
import { withSession } from '../../../server/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  return withSession(NextResponse.json({ ok: true }), 0);
}
