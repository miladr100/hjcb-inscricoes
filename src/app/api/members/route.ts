import { NextResponse } from 'next/server';
import { jsonError, requireAuth } from '../../../server/http';
import { appendMember, findDuplicateMember, readMembers, type MemberBody } from '../../../server/sheets';

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

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await request.json()) as MemberBody;
    if (!body.givenName || !body.familyName || !body.birthDate || !body.blessing) {
      return NextResponse.json({ error: 'Preencha nome, sobrenome, nascimento e bênção.' }, { status: 400 });
    }
    if (await findDuplicateMember(body)) {
      return NextResponse.json({ error: 'Este membro já está cadastrado.' }, { status: 409 });
    }
    await appendMember(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
