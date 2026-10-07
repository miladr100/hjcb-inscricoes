import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { exportCsv } from '../../../server/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const csv = await exportCsv();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="inscricoes-hjcb-outubro.csv"',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
