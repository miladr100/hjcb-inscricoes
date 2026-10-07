import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { readMembers } from '../../../server/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return NextResponse.json(await readMembers());
  } catch (error) {
    return jsonError(error);
  }
}
