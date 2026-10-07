import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Js72ABpSSEL78y4Ms4GxBQig6iA9ozRhAV2-2tpLdLA';
const DB = 'Banco de Dados';
const REG = 'Inscricoes';

export const BASE_HEADERS = [
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

const EXTRA_HEADERS = ['City', 'Registration Type', 'Paid', 'Representative TIS', 'taxa'];
const ALL = [...BASE_HEADERS, ...EXTRA_HEADERS];

export type SheetRow = {
  row: number;
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
};

export type RegistrationBody = {
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

function obj(row: unknown[], i: number): SheetRow {
  return {
    row: i + 2,
    group: val(row[0]),
    country: val(row[1]),
    familyName: val(row[2]),
    givenName: val(row[3]),
    birthDate: iso(row[4]),
    age: row[5] === '' || row[5] == null ? null : Number(row[5]),
    blessing: val(row[6]),
    tis: val(row[7]).replace(/\.0$/, ''),
    cpf: cpfCell(row[8]),
    document: documentCell(row[9]),
    city: val(row[10]),
    registrationType: val(row[11]),
    paid: val(row[12]),
    representativeTis: val(row[13]).replace(/\.0$/, ''),
  };
}

async function read(tab: string, range = 'A2:O') {
  const r = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return (r.data.values || []).map((row, i) => obj(row, i));
}

export function readMembers() {
  return read(DB, 'A2:J');
}

export function readRegistrations() {
  return read(REG);
}

export async function ensureHeaders() {
  const s = sheets();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${REG}'!A1:O1` });
  let h = (r.data.values?.[0] || []).map((cell) => String(cell));
  const stateIndex = h.findIndex((cell) => cell.trim() === 'State');
  if (stateIndex >= 0) {
    const meta = await s.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sh = meta.data.sheets?.find((x) => x.properties?.title === REG);
    const sheetId = sh?.properties?.sheetId;
    if (sheetId == null) throw new Error('Aba Inscricoes não encontrada');
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: stateIndex, endIndex: stateIndex + 1 },
            },
          },
        ],
      },
    });
    h = h.filter((_, index) => index !== stateIndex);
  }
  const needsTaxa = !h.includes('taxa');
  const same = h.length === ALL.length && h.every((cell, index) => cell === ALL[index]);
  if (!same) {
    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${REG}'!A1:O1`,
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
        range: `'${REG}'!O2:O${last}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows.map((row) => [feeAmount(row.birthDate)]) },
      });
    }
  }
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

function rowForSheet(x: RegistrationBody) {
  const row = rowOf(x);
  row[8] = asSheetText(row[8]);
  row[9] = asSheetText(row[9]);
  return row;
}

export function rowOf(x: RegistrationBody) {
  return [
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
    feeAmount(x.birthDate || ''),
  ];
}

export async function findDuplicate(x: RegistrationBody, ignoreRow = 0) {
  const all = await readRegistrations();
  const cpf = (x.cpf || '').replace(/\D/g, '');
  const name = `${x.givenName} ${x.familyName}`.trim().toLowerCase();
  return all.find(
    (r) =>
      r.row !== ignoreRow &&
      ((x.tis && r.tis === String(x.tis)) ||
        (cpf && r.cpf.replace(/\D/g, '') === cpf) ||
        (`${r.givenName} ${r.familyName}`.trim().toLowerCase() === name && r.birthDate === x.birthDate)),
  );
}

export async function appendRegistration(x: RegistrationBody) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${REG}'!A:O`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowForSheet(x)] },
  });
}

export async function updateRegistration(row: number, x: RegistrationBody) {
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${REG}'!A${row}:O${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowForSheet(x)] },
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
  const csv = [BASE_HEADERS, ...rows.map((r) => rowOf(r).slice(0, 10))].map((r) => r.map(esc).join(',')).join('\n');
  return '\ufeff' + csv;
}
