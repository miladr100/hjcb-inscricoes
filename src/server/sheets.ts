import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Js72ABpSSEL78y4Ms4GxBQig6iA9ozRhAV2-2tpLdLA';
const DB = 'Banco de Dados';
const REG = 'Inscricoes';

export const BASE_HEADERS = [
  'id',
  'Group',
  'Country',
  'Family Name',
  'Given Name',
  'Date of birth\n(yyyy-mm-dd)',
  'Age',
  'Blessing',
  'TIS ID',
  'CPF',
  'RG/RNM/RNE',
];

const EXTRA_HEADERS = ['City', 'Registration Type', 'Paid', 'Representative TIS', 'Representative Name', 'taxa'];
const ALL = [...BASE_HEADERS, ...EXTRA_HEADERS];

export type SheetRow = {
  row: number;
  id: string;
  group: string;
  country: string;
  familyName: string;
  givenName: string;
  birthDate: string;
  age: number | null;
  blessing: string;
  tis: string;
  cpf: string;
  document: string;
  city: string;
  registrationType: string;
  paid: string;
  representativeTis: string;
  representativeName: string;
  taxa: number | null;
};

export type RegistrationBody = {
  id?: string;
  group?: string;
  country?: string;
  familyName?: string;
  givenName?: string;
  birthDate?: string;
  blessing?: string;
  tis?: string;
  cpf?: string;
  document?: string;
  city?: string;
  registrationType?: string;
  paid?: string;
  representativeTis?: string;
  representativeName?: string;
};

function sheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const val = (v: unknown) => (v == null ? '' : String(v));

function cpfCell(v: unknown) {
  const digits = val(v).replace(/^'/, '').replace(/\.0$/, '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(11, '0');
}

function documentCell(v: unknown) {
  const text = val(v).replace(/^'/, '');
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text;
}

function asSheetText(value: unknown) {
  const text = String(value ?? '');
  if (!text) return '';
  return text.startsWith("'") ? text : `'${text}`;
}

function iso(v: unknown) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val(v))) return val(v);
  const d = new Date(val(v));
  return isNaN(+d) ? val(v) : d.toISOString().slice(0, 10);
}

export function newPersonId() {
  return crypto.randomUUID();
}

function obj(row: unknown[], i: number): SheetRow {
  return {
    row: i + 2,
    id: val(row[0]).replace(/^'/, ''),
    group: val(row[1]),
    country: val(row[2]),
    familyName: val(row[3]),
    givenName: val(row[4]),
    birthDate: iso(row[5]),
    age: row[6] === '' || row[6] == null ? null : Number(row[6]),
    blessing: val(row[7]),
    tis: documentCell(row[8]),
    cpf: cpfCell(row[9]),
    document: documentCell(row[10]),
    city: val(row[11]),
    registrationType: val(row[12]),
    paid: val(row[13]),
    representativeTis: documentCell(row[14]),
    representativeName: val(row[15]),
    taxa: row[16] === '' || row[16] == null ? null : Number(val(row[16]).replace(/^'/, '')),
  };
}

function hasPerson(row: SheetRow) {
  return Boolean(row.givenName.trim() || row.familyName.trim());
}

function nameBirthKey(row: { givenName?: string; familyName?: string; birthDate?: string }) {
  return `${(row.givenName || '').trim().toLowerCase()}|${(row.familyName || '').trim().toLowerCase()}|${row.birthDate || ''}`;
}

function samePerson(
  a: { id?: string; givenName?: string; familyName?: string; birthDate?: string; cpf?: string },
  b: { id?: string; givenName?: string; familyName?: string; birthDate?: string; cpf?: string },
) {
  if (a.id && b.id && a.id === b.id) return true;
  const cpfA = (a.cpf || '').replace(/\D/g, '');
  const cpfB = (b.cpf || '').replace(/\D/g, '');
  if (cpfA && cpfB && cpfA === cpfB) return true;
  const nameA = `${a.givenName || ''} ${a.familyName || ''}`.trim().toLowerCase();
  const nameB = `${b.givenName || ''} ${b.familyName || ''}`.trim().toLowerCase();
  return Boolean(nameA && nameB && nameA === nameB && a.birthDate && a.birthDate === b.birthDate);
}

async function read(tab: string, range = 'A2:Q') {
  const r = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return (r.data.values || []).map((row, i) => obj(row, i));
}

let ensuringIds: Promise<void> | null = null;

async function fillMissingIds() {
  const [members, registrations] = await Promise.all([read(DB, 'A2:K'), read(REG)]);
  const used = new Set(
    [...members, ...registrations].map((row) => row.id.trim()).filter(Boolean),
  );
  const nextId = () => {
    let id = newPersonId();
    while (used.has(id)) id = newPersonId();
    used.add(id);
    return id;
  };

  const memberWrites: { range: string; values: string[][] }[] = [];
  for (const member of members) {
    if (!hasPerson(member) || member.id.trim()) continue;
    member.id = nextId();
    memberWrites.push({ range: `'${DB}'!A${member.row}`, values: [[member.id]] });
  }

  const byCpf = new Map<string, SheetRow>();
  const byName = new Map<string, SheetRow>();
  for (const member of members) {
    if (!hasPerson(member)) continue;
    if (member.cpf) byCpf.set(member.cpf.replace(/\D/g, ''), member);
    if (member.birthDate) byName.set(nameBirthKey(member), member);
  }

  const registrationWrites: { range: string; values: string[][] }[] = [];
  for (const registration of registrations) {
    if (!hasPerson(registration) || registration.id.trim()) continue;
    const cpf = registration.cpf.replace(/\D/g, '');
    const match = (cpf ? byCpf.get(cpf) : undefined) || (registration.birthDate ? byName.get(nameBirthKey(registration)) : undefined);
    registration.id = match?.id || nextId();
    registrationWrites.push({ range: `'${REG}'!A${registration.row}`, values: [[registration.id]] });
  }

  const data = [...memberWrites, ...registrationWrites];
  if (!data.length) return;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

export function ensurePersonIds() {
  if (!ensuringIds) ensuringIds = fillMissingIds().finally(() => { ensuringIds = null; });
  return ensuringIds;
}

export async function readMembers() {
  await ensurePersonIds();
  return read(DB, 'A2:K');
}

export async function readRegistrations() {
  return read(REG);
}

async function inscriptionSheetId() {
  const meta = await sheets().spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sh = meta.data.sheets?.find((x) => x.properties?.title === REG);
  const sheetId = sh?.properties?.sheetId;
  if (sheetId == null) throw new Error('Aba Inscricoes não encontrada');
  return sheetId;
}

async function insertColumn(startIndex: number) {
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId: await inscriptionSheetId(), dimension: 'COLUMNS', startIndex, endIndex: startIndex + 1 },
          },
        },
      ],
    },
  });
}

async function fillRepresentativeNames() {
  const rows = await read(REG);
  const byTis = new Map<string, SheetRow>();
  for (const row of rows) {
    if (row.tis) byTis.set(row.tis, row);
  }
  const data = rows.flatMap((row) => {
    if (row.representativeName.trim() || !row.representativeTis) return [];
    const rep = byTis.get(row.representativeTis);
    const name = `${rep?.givenName || ''} ${rep?.familyName || ''}`.replace(/\s+/g, ' ').trim();
    if (!name) return [];
    return [{ range: `'${REG}'!P${row.row}`, values: [[name]] }];
  });
  if (!data.length) return;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

export async function ensureHeaders() {
  const s = sheets();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${REG}'!A1:Q1` });
  let h = (r.data.values?.[0] || []).map((cell) => String(cell));
  const stateIndex = h.findIndex((cell) => cell.trim() === 'State');
  if (stateIndex >= 0) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId: await inscriptionSheetId(), dimension: 'COLUMNS', startIndex: stateIndex, endIndex: stateIndex + 1 },
            },
          },
        ],
      },
    });
    h = h.filter((_, index) => index !== stateIndex);
  }
  if (!h.some((cell) => cell.trim() === 'Representative Name')) {
    const tisIndex = h.findIndex((cell) => cell.trim() === 'Representative TIS');
    const taxaIndex = h.findIndex((cell) => cell.trim() === 'taxa');
    const insertAt = tisIndex >= 0 ? tisIndex + 1 : taxaIndex >= 0 ? taxaIndex : h.length;
    await insertColumn(insertAt);
    h.splice(insertAt, 0, 'Representative Name');
  }
  const needsTaxa = !h.includes('taxa');
  const same = h.length === ALL.length && h.every((cell, index) => cell === ALL[index]);
  if (!same) {
    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${REG}'!A1:Q1`,
      valueInputOption: 'RAW',
      requestBody: { values: [ALL] },
    });
  }
  if (needsTaxa) {
    const rows = await read(REG);
    if (rows.length) {
      const last = rows[rows.length - 1].row;
      await s.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${REG}'!Q2:Q${last}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows.map((row) => [feeAmount(row.birthDate)]) },
      });
    }
  }
  await fillRepresentativeNames();
  await fillRepresentativeTypes();
  await ensurePersonIds();
}

function age(d: string) {
  const b = new Date(d + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

function feeAmount(birthDate: string) {
  if (!birthDate) return '';
  const years = age(birthDate);
  if (Number.isNaN(years)) return '';
  if (years <= 6) return 0;
  if (years <= 17) return 20;
  return 50;
}

function resolveId(x: { id?: string }, fallback = '') {
  return (x.id || fallback || '').trim() || newPersonId();
}

function rowForSheet(x: RegistrationBody, fallbackId = '') {
  const row = rowOf({ ...x, id: resolveId(x, fallbackId) });
  row[8] = asSheetText(row[8]);
  row[9] = asSheetText(row[9]);
  row[10] = asSheetText(row[10]);
  row[14] = asSheetText(row[14]);
  return row;
}

export function rowOf(x: RegistrationBody) {
  return [
    x.id || '',
    x.group || 'Group 3',
    x.country || 'Brazil',
    x.familyName,
    x.givenName,
    x.birthDate,
    age(x.birthDate || ''),
    x.blessing,
    x.tis || '',
    (x.cpf || '').replace(/\D/g, ''),
    x.document || '',
    x.city || '',
    x.registrationType || 'Participante',
    x.paid || 'Não pago',
    x.representativeTis || '',
    x.representativeName || '',
    feeAmount(x.birthDate || ''),
  ];
}

export type MemberBody = {
  id?: string;
  group?: string;
  country?: string;
  familyName?: string;
  givenName?: string;
  birthDate?: string;
  blessing?: string;
  tis?: string;
  cpf?: string;
  document?: string;
};

function memberRow(x: MemberBody, fallbackId = '') {
  return [
    resolveId(x, fallbackId),
    x.group || 'Group 3',
    x.country || 'Brazil',
    x.familyName,
    x.givenName,
    x.birthDate,
    age(x.birthDate || ''),
    x.blessing,
    asSheetText(x.tis || ''),
    asSheetText((x.cpf || '').replace(/\D/g, '')),
    asSheetText(x.document || ''),
  ];
}

export async function findDuplicateMember(x: MemberBody, ignoreRow = 0) {
  const all = await readMembers();
  return all.find((r) => r.row !== ignoreRow && samePerson(x, r));
}

export async function appendMember(x: MemberBody) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${DB}'!A:K`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [memberRow(x)] },
  });
}

export async function updateMember(row: number, x: MemberBody) {
  const existing = (await readMembers()).find((r) => r.row === row);
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${DB}'!A${row}:K${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [memberRow(x, existing?.id)] },
  });
}

function matchRepresentative(all: SheetRow[], name?: string, tis?: string, ignoreRow = 0) {
  const n = (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const t = String(tis || '').trim();
  return all.find((r) => {
    if (r.row === ignoreRow) return false;
    const full = `${r.givenName} ${r.familyName}`.replace(/\s+/g, ' ').trim().toLowerCase();
    if (n && full === n) return true;
    return Boolean(t && r.tis && r.tis === t);
  });
}

export async function findInscribedRepresentative(name?: string, tis?: string, ignoreRow = 0) {
  return matchRepresentative(await readRegistrations(), name, tis, ignoreRow);
}

export async function markAsRepresentative(row: number) {
  if (!row) return;
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${REG}'!M${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Representative']] },
  });
}

export async function ensureRepresentativeType(rep: { row: number; registrationType?: string }) {
  if (!rep.row || rep.registrationType === 'Representative') return;
  await markAsRepresentative(rep.row);
}

async function fillRepresentativeTypes() {
  const rows = await read(REG);
  const seen = new Set<number>();
  const data = rows.flatMap((row) => {
    if (row.registrationType !== 'JS Registration') return [];
    const rep = matchRepresentative(rows, row.representativeName, row.representativeTis, row.row);
    if (!rep || rep.registrationType === 'Representative' || seen.has(rep.row)) return [];
    seen.add(rep.row);
    return [{ range: `'${REG}'!M${rep.row}`, values: [['Representative']] }];
  });
  if (!data.length) return;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

export async function findDuplicate(x: RegistrationBody, ignoreRow = 0) {
  const all = await readRegistrations();
  return all.find((r) => r.row !== ignoreRow && samePerson(x, r));
}

export async function appendRegistration(x: RegistrationBody) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${REG}'!A:Q`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowForSheet(x)] },
  });
}

export async function updateRegistration(row: number, x: RegistrationBody) {
  const existing = (await readRegistrations()).find((r) => r.row === row);
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${REG}'!A${row}:Q${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowForSheet(x, existing?.id)] },
  });
}

export async function deleteRegistration(row: number) {
  const meta = await sheets().spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sh = meta.data.sheets?.find((x) => x.properties?.title === REG);
  const sheetId = sh?.properties?.sheetId;
  if (sheetId == null) throw new Error('Aba Inscricoes não encontrada');
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        },
      ],
    },
  });
}

export async function exportCsv() {
  const rows = await readRegistrations();
  rows.sort((a, b) => (a.representativeTis || a.tis).localeCompare(b.representativeTis || b.tis));
  const esc = (x: unknown) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  const csv = [BASE_HEADERS, ...rows.map((r) => rowOf(r).slice(0, 11))].map((r) => r.map(esc).join(',')).join('\n');
  return '\ufeff' + csv;
}
