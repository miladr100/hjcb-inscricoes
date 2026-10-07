import { API } from './constants';

export const money = (age: number | null) => (age == null ? null : age <= 6 ? 0 : age <= 17 ? 20 : 50);

export const cpfDigits = (v: string) => v.replace(/\D/g, '').slice(0, 11);

export function cpfMask(v: string) {
  const d = cpfDigits(v);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function validCpf(v: string) {
  const s = cpfDigits(v);
  if (!s) return true;
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += +s[i] * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === +s[9] && calc(10) === +s[10];
}

export function calcAge(d: string) {
  if (!d) return null;
  const b = new Date(d + 'T12:00:00');
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}

export async function req(path: string, opts: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> | undefined) },
    credentials: 'include',
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}
