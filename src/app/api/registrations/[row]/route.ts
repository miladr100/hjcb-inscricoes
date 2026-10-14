import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../../server/http';
import { deleteRegistration, ensureRepresentativeType, findDuplicate, findInscribedRepresentative, updateRegistration, type RegistrationBody } from '../../../../server/sheets';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ row: string }> };

export async function PUT(request: Request, context: Context) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { row: raw } = await context.params;
    const row = +raw;
    const body = (await request.json()) as RegistrationBody;
    if (await findDuplicate(body, row)) {
      return NextResponse.json({ error: 'Já existe outra inscrição para esta pessoa.' }, { status: 409 });
    }
    if (body.registrationType === 'JS Registration') {
      const rep = await findInscribedRepresentative(body.representativeName, body.representativeTis, row);
      if (!rep) {
        return NextResponse.json({ error: 'Selecione o representante na lista de inscritos.' }, { status: 400 });
      }
      body.representativeName = `${rep.givenName} ${rep.familyName}`.replace(/\s+/g, ' ').trim();
      body.representativeTis = rep.tis || body.representativeTis || '';
      await updateRegistration(row, body);
      await ensureRepresentativeType(rep);
      return NextResponse.json({ ok: true });
    }
    await updateRegistration(row, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { row } = await context.params;
    await deleteRegistration(+row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
