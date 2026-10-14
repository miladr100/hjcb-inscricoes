import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { appendRegistration, ensureHeaders, ensureRepresentativeType, findDuplicate, findInscribedRepresentative, readRegistrations, type RegistrationBody } from '../../../server/sheets';

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
    if (body.registrationType === 'JS Registration') {
      const rep = await findInscribedRepresentative(body.representativeName, body.representativeTis);
      if (!rep) {
        return NextResponse.json({ error: 'Selecione o representante na lista de inscritos.' }, { status: 400 });
      }
      body.representativeName = `${rep.givenName} ${rep.familyName}`.replace(/\s+/g, ' ').trim();
      body.representativeTis = rep.tis || body.representativeTis || '';
      await appendRegistration(body);
      await ensureRepresentativeType(rep);
      return NextResponse.json({ ok: true });
    }
    await appendRegistration(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
