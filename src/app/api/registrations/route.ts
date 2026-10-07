import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { appendRegistration, ensureHeaders, findDuplicate, readRegistrations, type RegistrationBody } from '../../../server/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    await ensureHeaders();
    return NextResponse.json(await readRegistrations());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await request.json()) as RegistrationBody;
    await ensureHeaders();
    if (await findDuplicate(body)) {
      return NextResponse.json({ error: 'Esta pessoa já está inscrita.' }, { status: 409 });
    }
    if (body.registrationType === 'JS Registration' && !body.representativeTis) {
      return NextResponse.json({ error: 'Informe o TIS do representante.' }, { status: 400 });
    }
    await appendRegistration(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
