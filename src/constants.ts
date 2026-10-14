import type { Member, Registration } from './types';

export const API = '/api';

export const EMPTY_REGISTRATION: Registration = {
  row: 0,
  group: 'Group 3',
  country: 'Brazil',
  familyName: '',
  givenName: '',
  birthDate: '',
  age: null,
  blessing: '',
  tis: '',
  cpf: '',
  document: '',
  city: 'Campo Grande',
  registrationType: 'Participante',
  paid: 'Não pago',
  representativeTis: '',
};

export const EMPTY_MEMBER: Member = {
  row: 0,
  group: 'Group 3',
  country: 'Brazil',
  familyName: '',
  givenName: '',
  birthDate: '',
  age: null,
  blessing: '',
  tis: '',
  cpf: '',
  document: '',
};
