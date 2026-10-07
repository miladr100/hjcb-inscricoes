import { NextResponse } from 'next/server';
import { isAuthed } from './auth';

export function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Erro';
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth() {
  if (await isAuthed()) return null;
  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
}
