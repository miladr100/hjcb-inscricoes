'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { InstallPrompt } from './InstallPrompt';
import { ThemeToggle } from './ThemeToggle';
import { MembersBoard } from './MembersBoard';
import { RegistrationsBoard } from './RegistrationsBoard';
import { EMPTY_REGISTRATION } from '../constants';
import { calcAge, cpfDigits, cpfMask, feeOf, formatFee, fullName, memberCadastroChanged, money, req, validCpf } from '../helpers';
import type { Member, Registration } from '../types';

const TABLE_PAGE_SIZE = 15;

export default function App() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [q, setQ] = useState('');
  const [repQ, setRepQ] = useState('');
  const [editing, setEditing] = useState<Registration | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'form' | 'cards' | 'members'>('form');
  const [tablePage, setTablePage] = useState(0);
  const [sourceMember, setSourceMember] = useState<Member | null>(null);
  const [memberPrompt, setMemberPrompt] = useState<'update' | 'create' | null>(null);

  const [form, setForm] = useState<Registration>(EMPTY_REGISTRATION);

  const load = async () => {
    const [m, r] = await Promise.all([req('/members'), req('/registrations')]);
    setMembers(m);
    setRegs(r);
  };

  async function boot() {
    try {
      setLoadError('');
      await load();
      setReady(true);
    } catch (error: any) {
      setLoadError(error.message || 'Não foi possível carregar os dados.');
    }
  }

  useEffect(() => {
    req('/session')
      .then(() => {
        setAuth(true);
        boot();
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

  const foundReps = useMemo(() => {
    const s = repQ.toLowerCase().trim();
    if (!s || form.registrationType !== 'JS Registration') return [];
    if (form.representativeName && form.representativeName.toLowerCase().trim() === s) return [];
    return regs
      .filter((r) => {
        if (editing && r.row === editing.row) return false;
        if (form.id && r.id && r.id === form.id) return false;
        return `${fullName(r)} ${r.tis}`.toLowerCase().includes(s);
      })
      .slice(0, 12);
  }, [repQ, regs, form.registrationType, form.representativeName, form.id, editing]);

  const tableRegs = useMemo(() => [...regs].sort((a, b) => b.row - a.row), [regs]);
  const tablePageCount = Math.max(1, Math.ceil(tableRegs.length / TABLE_PAGE_SIZE));
  const visibleRegs = tableRegs.slice(tablePage * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);

  useEffect(() => {
    if (tablePage > tablePageCount - 1) setTablePage(Math.max(0, tablePageCount - 1));
  }, [tablePage, tablePageCount]);

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
      representativeName: '',
    });
    setSourceMember(m);
    setQ('');
    setRepQ('');
  };

  const pickRepresentative = (r: Registration) => {
    const name = fullName(r);
    setForm((f) => ({ ...f, representativeTis: r.tis || '', representativeName: name }));
    setRepQ(name);
  };

  const set = (k: keyof Registration, v: any) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'birthDate' ? { age: calcAge(v) } : {}) }));

  function closeMemberPrompt() {
    setMemberPrompt(null);
  }

  useEffect(() => {
    if (!memberPrompt) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMemberPrompt();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [memberPrompt]);

  async function submitInscription(updateCadastro: boolean) {
    setMemberPrompt(null);
    setSaving(true);
    try {
      const payload = { ...form, cpf: cpfDigits(form.cpf), id: form.id || crypto.randomUUID() };
      let done = editing ? 'Inscrição atualizada.' : 'Inscrição realizada com sucesso.';
      if (!editing && updateCadastro && !sourceMember) {
        await req('/members', { method: 'POST', body: JSON.stringify(payload) });
        done = 'Inscrição realizada e pessoa adicionada ao cadastro de membros.';
      }
      if (editing) await req(`/registrations/${editing.row}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await req('/registrations', { method: 'POST', body: JSON.stringify(payload) });
      if (updateCadastro && sourceMember) {
        try {
          await req(`/members/${sourceMember.row}`, { method: 'PUT', body: JSON.stringify(payload) });
          done = 'Inscrição realizada e cadastro do membro atualizado.';
        } catch (memberError: any) {
          done = `Inscrição realizada, mas o cadastro do membro não foi atualizado: ${memberError.message}`;
        }
      }
      setMsg(done);
      setEditing(null);
      setSourceMember(null);
      setForm(EMPTY_REGISTRATION);
      setRepQ('');
      setTablePage(0);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMsg('');
    if (form.cpf && !validCpf(form.cpf)) {
      setMsg('CPF inválido.');
      return;
    }
    if (form.registrationType === 'JS Registration' && !form.representativeName) {
      setMsg('Selecione o representante na lista de inscritos.');
      return;
    }
    if (!editing && sourceMember && memberCadastroChanged(sourceMember, form)) {
      setMemberPrompt('update');
      return;
    }
    if (!editing && !sourceMember) {
      setMemberPrompt('create');
      return;
    }
    await submitInscription(false);
  }

  function edit(r: Registration) {
    const representativeName =
      r.representativeName ||
      fullName(regs.find((x) => x.tis && x.tis === r.representativeTis) || {}) ||
      '';
    setEditing(r);
    setSourceMember(null);
    setForm({ ...EMPTY_REGISTRATION, ...r, age: calcAge(r.birthDate), representativeName });
    setRepQ(representativeName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function del(r: Registration) {
    if (!confirm(`Excluir inscrição de ${r.givenName} ${r.familyName}?`)) return;
    await req(`/registrations/${r.row}`, { method: 'DELETE' });
    await load();
  }

  if (auth === null || (auth && !ready)) {
    return (
      <>
        <InstallPrompt />
        <main className="center">
          <div className="pageLoading">
            {!loadError && <span className="spinner" aria-hidden="true" />}
            <p>{loadError ? 'Não foi possível carregar os dados.' : 'Carregando dados…'}</p>
            {loadError && (
              <>
                <p className="error">{loadError}</p>
                <button type="button" onClick={boot}>
                  Tentar de novo
                </button>
              </>
            )}
          </div>
        </main>
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
                await boot();
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
        <div className="headerActions">
          <ThemeToggle />
          <button
            className="ghost"
            onClick={async () => {
              await req('/logout', { method: 'POST' });
              setAuth(false);
              setReady(false);
              setMembers([]);
              setRegs([]);
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label="Seções">
        <button type="button" className={tab === 'form' ? 'active' : undefined} onClick={() => setTab('form')}>
          Formulário
        </button>
        <button type="button" className={tab === 'cards' ? 'active' : undefined} onClick={() => setTab('cards')}>
          Inscritos
        </button>
        <button type="button" className={tab === 'members' ? 'active' : undefined} onClick={() => setTab('members')}>
          Cadastro
        </button>
      </nav>
      {tab === 'cards' ? (
        <RegistrationsBoard regs={regs} />
      ) : tab === 'members' ? (
        <MembersBoard
          members={members}
          regs={regs}
          onCreated={load}
          onInscribe={(m) => {
            setEditing(null);
            pick(m);
            setTab('form');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
      <>
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
            setSourceMember(null);
            setQ('');
            setRepQ('');
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
            <input value={form.tis} onChange={(e) => set('tis', e.target.value)} />
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
            <select
              value={form.registrationType}
              onChange={(e) => {
                const registrationType = e.target.value;
                setForm((f) => ({
                  ...f,
                  registrationType,
                  ...(registrationType === 'JS Registration'
                    ? {}
                    : { representativeTis: '', representativeName: '' }),
                }));
                if (registrationType !== 'JS Registration') setRepQ('');
              }}
            >
              <option>Participante</option>
              <option>Representative</option>
              <option>JS Registration</option>
            </select>
          </label>
          {form.registrationType === 'JS Registration' && (
            <div className="repSearch">
              <label>
                Nome do representante
                <input
                  required
                  autoComplete="off"
                  placeholder="Nome do inscrito"
                  value={repQ}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRepQ(value);
                    if (value.trim() !== (form.representativeName || '').trim()) {
                      setForm((f) => ({ ...f, representativeName: '', representativeTis: '' }));
                    }
                  }}
                />
              </label>
              {foundReps.length > 0 && (
                <div className="results">
                  {foundReps.map((r) => (
                    <button type="button" key={r.row} onClick={() => pickRepresentative(r)}>
                      <strong>{fullName(r)}</strong>
                      <small>
                        TIS {r.tis || '—'} • {r.birthDate || 'sem nascimento'}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                  setRepQ('');
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          </fieldset>
        </form>
        {msg && (
          <p className={msg.includes('sucesso') || msg.includes('atualizad') || msg.includes('realizada') ? 'success' : 'error'}>
            {msg}
          </p>
        )}
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
                <th>Taxa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRegs.map((r) => (
                <tr key={r.row}>
                  <td>
                    {r.givenName} {r.familyName}
                  </td>
                  <td>{r.tis}</td>
                  <td>{r.blessing}</td>
                  <td>{r.registrationType || 'Participante'}</td>
                  <td>{r.paid || 'Não pago'}</td>
                  <td>{formatFee(feeOf(r))}</td>
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
        {tableRegs.length > 0 && (
          <div className="pager">
            <small>
              {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min(tableRegs.length, tablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE)} de{' '}
              {tableRegs.length}
            </small>
            <nav aria-label="Páginas da tabela de inscrições">
              <button type="button" className="ghost" disabled={tablePage === 0} onClick={() => setTablePage((p) => p - 1)}>
                Anterior
              </button>
              {Array.from({ length: tablePageCount }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  className={i === tablePage ? 'active' : 'ghost'}
                  onClick={() => setTablePage(i)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                disabled={tablePage >= tablePageCount - 1}
                onClick={() => setTablePage((p) => p + 1)}
              >
                Próxima
              </button>
            </nav>
          </div>
        )}
      </section>
      </>
      )}
      </main>
      {memberPrompt && (
        <div
          className="dialogBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-prompt-title"
          onClick={closeMemberPrompt}
        >
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="dialogClose" aria-label="Fechar" onClick={closeMemberPrompt}>
              ×
            </button>
            {memberPrompt === 'update' ? (
              <>
                <h2 id="member-prompt-title">Atualizar cadastro do membro?</h2>
                <p>
                  Os dados trazidos do cadastro foram alterados. Deseja salvar essas alterações também na planilha de
                  membros?
                </p>
                <div className="actions">
                  <button type="button" onClick={() => submitInscription(true)}>
                    Sim, atualizar cadastro
                  </button>
                  <button type="button" className="ghost" onClick={() => submitInscription(false)}>
                    Não, só inscrever
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="member-prompt-title">Cadastro obrigatório</h2>
                <p>
                  Toda pessoa inscrita precisa constar no cadastro de membros. Ao concordar, ela será cadastrada e
                  inscrita. Se fechar este aviso, nada será gravado.
                </p>
                <div className="actions">
                  <button type="button" onClick={() => submitInscription(true)}>
                    Concordar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
