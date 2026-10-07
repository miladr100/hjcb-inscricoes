'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { InstallPrompt } from './InstallPrompt';
import { EMPTY_REGISTRATION } from '../constants';
import { calcAge, cpfDigits, cpfMask, money, req, validCpf } from '../helpers';
import type { Member, Registration } from '../types';

export default function App() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Registration | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Registration>(EMPTY_REGISTRATION);

  const load = async () => {
    const [m, r] = await Promise.all([req('/members'), req('/registrations')]);
    setMembers(m);
    setRegs(r);
  };

  useEffect(() => {
    req('/session')
      .then(() => {
        setAuth(true);
        load();
      })
      .catch(() => setAuth(false));
  }, []);

  const blessings = useMemo(
    () =>
      Array.from(new Set(members.map((m) => m.blessing).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { numeric: true }),
      ),
    [members],
  );

  const found = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return [];
    return members
      .filter((m) => `${m.givenName} ${m.familyName} ${m.tis} ${m.cpf}`.toLowerCase().includes(s))
      .slice(0, 12);
  }, [q, members]);

  const fee = money(form.age);

  const pick = (m: Member) => {
    setForm({
      ...EMPTY_REGISTRATION,
      ...m,
      row: 0,
      age: calcAge(m.birthDate),
      city: 'Campo Grande',
      registrationType: 'Participante',
      paid: 'Não pago',
      representativeTis: '',
    });
    setQ('');
  };

  const set = (k: keyof Registration, v: any) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'birthDate' ? { age: calcAge(v) } : {}) }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMsg('');
    if (form.cpf && !validCpf(form.cpf)) {
      setMsg('CPF inválido.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, cpf: cpfDigits(form.cpf) };
      if (editing) await req(`/registrations/${editing.row}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await req('/registrations', { method: 'POST', body: JSON.stringify(payload) });
      setMsg(editing ? 'Inscrição atualizada.' : 'Inscrição realizada com sucesso.');
      setEditing(null);
      setForm(EMPTY_REGISTRATION);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  function edit(r: Registration) {
    setEditing(r);
    setForm({ ...EMPTY_REGISTRATION, ...r, age: calcAge(r.birthDate) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function del(r: Registration) {
    if (!confirm(`Excluir inscrição de ${r.givenName} ${r.familyName}?`)) return;
    await req(`/registrations/${r.row}`, { method: 'DELETE' });
    await load();
  }

  if (auth === null) {
    return (
      <>
        <InstallPrompt />
        <main className="center">Carregando…</main>
      </>
    );
  }

  if (!auth) {
    return (
      <>
        <InstallPrompt />
        <main className="login">
        <div className="card">
          <h1>Grandes Obras HJCB</h1>
          <p>23–25 de outubro de 2026</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await req('/login', { method: 'POST', body: JSON.stringify({ password }) });
                setAuth(true);
                load();
              } catch {
                setMsg('Senha incorreta');
              }
            }}
          >
            <label>
              Senha de acesso
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            <button>Entrar</button>
            {msg && <p className="error">{msg}</p>}
          </form>
        </div>
      </main>
      </>
    );
  }

  const paid = regs.filter((r) => r.paid === 'Pago').length;

  return (
    <>
      <InstallPrompt />
      <main>
      <header>
        <div>
          <h1>Grandes Obras HJCB</h1>
          <small>Inscrições • Outubro 2026</small>
        </div>
        <button
          className="ghost"
          onClick={async () => {
            await req('/logout', { method: 'POST' });
            setAuth(false);
          }}
        >
          Sair
        </button>
      </header>
      <section className="stats">
        <div>
          <b>{regs.length}</b>
          <span>Inscritos</span>
        </div>
        <div>
          <b>{paid}</b>
          <span>Pagos</span>
        </div>
        <div>
          <b>{regs.length - paid}</b>
          <span>Pendentes</span>
        </div>
      </section>
      <section className="card">
        <h2>{editing ? 'Editar inscrição' : 'Nova inscrição'}</h2>
        <label>
          Buscar membro cadastrado
          <input placeholder="Nome, TIS ou CPF" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {found.length > 0 && (
          <div className="results">
            {found.map((m) => (
              <button key={m.row} onClick={() => pick(m)}>
                <strong>
                  {m.givenName} {m.familyName}
                </strong>
                <small>
                  TIS {m.tis || '—'} • {m.birthDate || 'sem nascimento'}
                </small>
              </button>
            ))}
          </div>
        )}
        <button
          className="link"
          onClick={() => {
            setForm(EMPTY_REGISTRATION);
            setQ('');
          }}
        >
          + Nova pessoa
        </button>
        <form onSubmit={save}>
          <fieldset className="grid" disabled={saving}>
          <label>
            Nome
            <input required value={form.givenName} onChange={(e) => set('givenName', e.target.value)} />
          </label>
          <label>
            Sobrenome
            <input required value={form.familyName} onChange={(e) => set('familyName', e.target.value)} />
          </label>
          <label>
            Data de nascimento
            <input required type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          </label>
          <label>
            Idade
            <input readOnly value={form.age ?? ''} />
          </label>
          <label>
            Cidade
            <input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label>
            TIS ID
            <input value={form.tis} onChange={(e) => set('tis', e.target.value.replace(/\D/g, ''))} />
          </label>
          <label>
            CPF (opcional)
            <input inputMode="numeric" value={cpfMask(form.cpf)} onChange={(e) => set('cpf', e.target.value)} />
            <small className={form.cpf && !validCpf(form.cpf) ? 'error' : ''}>
              {form.cpf && !validCpf(form.cpf) ? 'CPF inválido' : ''}
            </small>
          </label>
          <label>
            RG / RNM / RNE (opcional)
            <input value={form.document} onChange={(e) => set('document', e.target.value)} />
          </label>
          <label>
            Grupo da Bênção
            <input list="blessings" required value={form.blessing} onChange={(e) => set('blessing', e.target.value)} />
            <datalist id="blessings">
              {blessings.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label>
            Tipo
            <select value={form.registrationType} onChange={(e) => set('registrationType', e.target.value)}>
              <option>Participante</option>
              <option>Representative</option>
              <option>JS Registration</option>
            </select>
          </label>
          {form.registrationType === 'JS Registration' && (
            <label>
              TIS do representante
              <input
                required
                value={form.representativeTis || ''}
                onChange={(e) => set('representativeTis', e.target.value.replace(/\D/g, ''))}
              />
            </label>
          )}
          <label>
            Pagamento
            <select value={form.paid} onChange={(e) => set('paid', e.target.value)}>
              <option>Não pago</option>
              <option>Pago</option>
            </select>
          </label>
          <div className="fee">
            <span>Taxa calculada</span>
            <b>{fee === null ? '—' : fee === 0 ? 'Isento' : `R$ ${fee},00`}</b>
            <small>Este valor é gravado na coluna taxa.</small>
          </div>
          <div className="actions">
            <button type="submit" className={saving ? 'is-loading' : undefined}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Confirmar inscrição'}
            </button>
            {editing && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_REGISTRATION);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          </fieldset>
        </form>
        {msg && <p className={msg.includes('sucesso') || msg.includes('atualizada') ? 'success' : 'error'}>{msg}</p>}
      </section>
      <section className="card">
        <div className="titleRow">
          <h2>Inscrições</h2>
          <a className="button" href="/api/export" target="_blank">
            Exportar CSV
          </a>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>TIS</th>
                <th>Bênção</th>
                <th>Tipo</th>
                <th>Pagamento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.row}>
                  <td>
                    {r.givenName} {r.familyName}
                  </td>
                  <td>{r.tis}</td>
                  <td>{r.blessing}</td>
                  <td>{r.registrationType || 'Participante'}</td>
                  <td>{r.paid || 'Não pago'}</td>
                  <td>
                    <button className="mini" onClick={() => edit(r)}>
                      Editar
                    </button>{' '}
                    <button className="mini danger" onClick={() => del(r)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </main>
    </>
  );
}
