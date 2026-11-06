import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { inscriptionSheetUrl } from '../../../server/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return NextResponse.redirect(await inscriptionSheetUrl());
  } catch (error) {
    return jsonError(error);
  }
}
