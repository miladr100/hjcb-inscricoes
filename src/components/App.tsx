'use client';

import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react';
import { InstallPrompt } from './InstallPrompt';
import { SettingsModal } from './SettingsModal';
import { applyStoredTheme } from './ThemeToggle';
import { MembersBoard } from './MembersBoard';
import { RegistrationsBoard } from './RegistrationsBoard';
import { EMPTY_REGISTRATION } from '../constants';
import { DEFAULT_EVENT, readEventSettings, writeEventSettings, type EventSettings } from '../eventSettings';
import { calcAge, cpfDigits, cpfMask, feeOf, formatFee, fullName, memberCadastroChanged, money, req, validCpf } from '../helpers';
import type { Member, Registration } from '../types';

const TABLE_PAGE_SIZE = 15;
const TYPE_SHORT: Record<string, string> = { Participante: 'P', 'JS Registration': 'JS', Representative: 'R' };

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
  const [tableQuery, setTableQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sourceMember, setSourceMember] = useState<Member | null>(null);
  const [memberPrompt, setMemberPrompt] = useState<'update' | 'create' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [event, setEvent] = useState<EventSettings>(DEFAULT_EVENT);

  const [form, setForm] = useState<Registration>(EMPTY_REGISTRATION);

  useLayoutEffect(() => {
    applyStoredTheme();
    setEvent(readEventSettings());
  }, []);

  useEffect(() => {
    document.title = event.title;
  }, [event.title]);

  function saveEvent(next: EventSettings) {
    setEvent(writeEventSettings(next));
  }

  async function logout() {
    await req('/logout', { method: 'POST' });
    setSettingsOpen(false);
    setAuth(false);
    setReady(false);
    setMembers([]);
    setRegs([]);
  }

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

  const tableRegs = useMemo(() => {
    const s = tableQuery.trim().toLowerCase();
    return [...regs]
      .filter((r) => !s || fullName(r).toLowerCase().includes(s))
      .sort((a, b) => b.row - a.row);
  }, [regs, tableQuery]);
  const tablePageCount = Math.max(1, Math.ceil(tableRegs.length / TABLE_PAGE_SIZE));
  const visibleRegs = tableRegs.slice(tablePage * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);

  useEffect(() => {
    if (tablePage > tablePageCount - 1) setTablePage(Math.max(0, tablePageCount - 1));
  }, [tablePage, tablePageCount]);

  const selectedRegs = useMemo(() => regs.filter((r) => r.id && selected.has(r.id)), [regs, selected]);
  const selectableVisible = visibleRegs.filter((r) => r.id);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.id!));

  function toggleSelected(id: string) {
    setBulkMsg(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of selectableVisible) {
        if (allVisibleSelected) next.delete(r.id!);
        else next.add(r.id!);
      }
      return next;
    });
  }

  async function runBulk(action: 'delete' | 'markPaid') {
    const ids = selectedRegs.map((r) => r.id!);
    if (!ids.length || bulkBusy) return;
    if (action === 'delete' && !confirm(`Excluir ${ids.length} inscrição(ões) selecionada(s)?`)) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const { count } = await req('/registrations/bulk', { method: 'POST', body: JSON.stringify({ action, ids }) });
      setSelected(new Set());
      if (editing && ids.includes(editing.id || '')) {
        setEditing(null);
        setSourceMember(null);
        setForm(EMPTY_REGISTRATION);
        setRepQ('');
      }
      await load();
      setBulkMsg({
        ok: true,
        text: action === 'delete' ? `${count} inscrição(ões) excluída(s).` : `${count} inscrição(ões) marcada(s) como paga(s).`,
      });
    } catch (e: any) {
      setBulkMsg({ ok: false, text: e.message });
    } finally {
      setBulkBusy(false);
    }
  }

  const fee = money(form.age);
  const exempt = fee === 0;

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
      const payload = {
        ...form,
        paid: exempt ? 'Pago' : form.paid,
        cpf: cpfDigits(form.cpf),
        id: form.id || crypto.randomUUID(),
      };
      const action = editing ? 'Inscrição atualizada' : 'Inscrição realizada';
      let done = editing ? 'Inscrição atualizada.' : 'Inscrição realizada com sucesso.';
      if (updateCadastro && !sourceMember) {
        await req('/members', { method: 'POST', body: JSON.stringify(payload) });
        done = `${action} e pessoa adicionada ao cadastro de membros.`;
      }
      if (editing) await req(`/registrations/${editing.row}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await req('/registrations', { method: 'POST', body: JSON.stringify(payload) });
      if (updateCadastro && sourceMember) {
        try {
          await req(`/members/${sourceMember.row}`, { method: 'PUT', body: JSON.stringify(payload) });
          done = `${action} e cadastro do membro atualizado.`;
        } catch (memberError: any) {
          done = `${action}, mas o cadastro do membro não foi atualizado: ${memberError.message}`;
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
    if (sourceMember && memberCadastroChanged(sourceMember, form)) {
      setMemberPrompt('update');
      return;
    }
    if (!sourceMember) {
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
    const id = (r.id || '').trim();
    setEditing(r);
    setSourceMember((id && members.find((m) => (m.id || '').trim() === id)) || null);
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
          <h1>{event.title}</h1>
          <p>{event.date}</p>
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
          <h1>{event.title}</h1>
          <small>Inscrições • {event.date}</small>
        </div>
        <button type="button" className="iconButton" aria-label="Configurações" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.1 12.9a7.5 7.5 0 0 0 .1-.9 7.5 7.5 0 0 0-.1-.9l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.5-.9l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-1.5.9l-2.4-1a.5.5 0 0 0-.6.2L2.7 9.9a.5.5 0 0 0 .1.6l2 1.6a7.5 7.5 0 0 0-.1.9 7.5 7.5 0 0 0 .1.9l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.5.9l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7 7 0 0 0 1.5-.9l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zm-7.1 2.6A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
            />
          </svg>
        </button>
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
        <RegistrationsBoard regs={regs} goal={event.goal} />
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
            <select value={exempt ? 'Pago' : form.paid} disabled={exempt} onChange={(e) => set('paid', e.target.value)}>
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
                  setSourceMember(null);
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
        <label className="filterSearch tableSearch">
          Buscar por nome
          <input
            type="search"
            value={tableQuery}
            placeholder="Nome ou sobrenome"
            aria-label="Filtro por nome na tabela"
            onChange={(e) => {
              setTableQuery(e.target.value);
              setTablePage(0);
            }}
          />
        </label>
        {selectedRegs.length > 0 && (
          <div className="bulkBar">
            <span>{selectedRegs.length} selecionada(s)</span>
            <button type="button" disabled={bulkBusy} onClick={() => runBulk('markPaid')}>
              Adicionar pago
            </button>
            <button type="button" className="dangerButton" disabled={bulkBusy} onClick={() => runBulk('delete')}>
              Deletar
            </button>
            <button type="button" className="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
              Limpar seleção
            </button>
          </div>
        )}
        {bulkMsg && <p className={bulkMsg.ok ? 'success' : 'error'}>{bulkMsg.text}</p>}
        {regs.length > 0 && tableRegs.length === 0 && <p className="empty">Nenhuma inscrição com este nome.</p>}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th className="selectCell">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas desta página"
                    checked={allVisibleSelected}
                    disabled={!selectableVisible.length}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>Nome</th>
                <th>Bênção</th>
                <th title="P = Participante, JS = JS Registration, R = Representative">Tipo</th>
                <th title="Pagamento">Pag.</th>
                <th>Taxa</th>
                <th>
                  <span className="srOnly">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRegs.map((r) => (
                <tr key={r.row} className={r.id && selected.has(r.id) ? 'is-selected' : undefined}>
                  <td className="selectCell">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${fullName(r)}`}
                      checked={!!r.id && selected.has(r.id)}
                      disabled={!r.id}
                      onChange={() => r.id && toggleSelected(r.id)}
                    />
                  </td>
                  <td className="nameCell" title={fullName(r)}>
                    {r.givenName} {r.familyName}
                  </td>
                  <td className="wrapCell">{r.blessing}</td>
                  <td title={r.registrationType || 'Participante'}>{TYPE_SHORT[r.registrationType || 'Participante'] || 'P'}</td>
                  <td>
                    {r.paid === 'Pago' ? (
                      <span className="paidMark is-paid" role="img" aria-label="Pago" title="Pago">
                        ✓
                      </span>
                    ) : (
                      <span className="paidMark is-unpaid" role="img" aria-label="Não pago" title="Não pago">
                        ✗
                      </span>
                    )}
                  </td>
                  <td>{formatFee(feeOf(r)).replace(',00', '')}</td>
                  <td>
                    <div className="rowActions">
                      <button
                        type="button"
                        className="mini iconAction"
                        aria-label={`Editar ${fullName(r)}`}
                        title="Editar"
                        onClick={() => edit(r)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="mini danger iconAction"
                        aria-label={`Excluir ${fullName(r)}`}
                        title="Excluir"
                        onClick={() => del(r)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                          />
                        </svg>
                      </button>
                    </div>
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
      {settingsOpen && (
        <SettingsModal event={event} onEventChange={saveEvent} onClose={() => setSettingsOpen(false)} onLogout={logout} />
      )}
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
                  {editing
                    ? 'Os dados desta inscrição estão diferentes do cadastro de membros. Deseja salvar essas alterações também na planilha de membros?'
                    : 'Os dados trazidos do cadastro foram alterados. Deseja salvar essas alterações também na planilha de membros?'}
                </p>
                <div className="actions">
                  <button type="button" onClick={() => submitInscription(true)}>
                    Sim, atualizar cadastro
                  </button>
                  <button type="button" className="ghost" onClick={() => submitInscription(false)}>
                    {editing ? 'Não, só salvar inscrição' : 'Não, só inscrever'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="member-prompt-title">Cadastro obrigatório</h2>
                <p>
                  {editing
                    ? 'Esta pessoa ainda não consta no cadastro de membros. Ao concordar, ela será cadastrada e a inscrição será salva. Se fechar este aviso, nada será gravado.'
                    : 'Toda pessoa inscrita precisa constar no cadastro de membros. Ao concordar, ela será cadastrada e inscrita. Se fechar este aviso, nada será gravado.'}
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
