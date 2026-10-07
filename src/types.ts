export type Member = {
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
};

export type Registration = Member & {
  city?: string;
  registrationType?: string;
  paid?: string;
  representativeTis?: string;
};
