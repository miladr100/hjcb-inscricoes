'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { EMPTY_MEMBER } from '../constants';
import { birthLabel, calcAge, cpfDigits, cpfMask, isMemberInscribed, req, validCpf } from '../helpers';
import type { Member, Registration } from '../types';

export function MembersBoard({
  members,
  regs,
  onCreated,
  onInscribe,
}: {
  members: Member[];
  regs: Registration[];
  onCreated: () => Promise<void>;
  onInscribe: (member: Member) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Member>(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inscribed' | 'not'>('all');

  const blessings = useMemo(
    () =>
      Array.from(new Set(members.map((m) => m.blessing).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { numeric: true }),
      ),
    [members],
  );

  const inscribedCount = useMemo(
    () => members.filter((m) => isMemberInscribed(m, regs)).length,
    [members, regs],
  );

  const visible = useMemo(() => {
    return members.filter((m) => {
      const inscribed = isMemberInscribed(m, regs);
      if (statusFilter === 'inscribed') return inscribed;
      if (statusFilter === 'not') return !inscribed;
      return true;
    });
  }, [members, regs, statusFilter]);

  const set = (k: keyof Member, v: string) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'birthDate' ? { age: calcAge(v) } : {}) }));

  function closeForm() {
    setOpen(false);
    setForm(EMPTY_MEMBER);
    setMsg('');
  }

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
      await req('/members', { method: 'POST', body: JSON.stringify({ ...form, cpf: cpfDigits(form.cpf) }) });
      setMsg('Membro cadastrado com sucesso.');
      setForm(EMPTY_MEMBER);
      setOpen(false);
      await onCreated();
    } catch (error: any) {
      setMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="stats">
        <div>
          <b>{members.length}</b>
          <span>Membros</span>
        </div>
        <div>
          <b>{inscribedCount}</b>
          <span>Inscritos</span>
        </div>
        <div>
          <b>{members.length - inscribedCount}</b>
          <span>Não inscritos</span>
        </div>
      </section>
      <nav className="filters" aria-label="Filtro de inscrição">
        <button type="button" className={statusFilter === 'all' ? 'active' : undefined} onClick={() => setStatusFilter('all')}>
          Todos
        </button>
        <button
          type="button"
          className={statusFilter === 'inscribed' ? 'active' : undefined}
          onClick={() => setStatusFilter('inscribed')}
        >
          Inscritos
        </button>
        <button type="button" className={statusFilter === 'not' ? 'active' : undefined} onClick={() => setStatusFilter('not')}>
          Não inscritos
        </button>
      </nav>
      <div className="titleRow">
        <h2>Cadastro de Membros</h2>
        {open ? (
          <button type="button" className="ghost" onClick={closeForm} disabled={saving}>
            Cancelar
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(true)}>
            Cadastrar membro
          </button>
        )}
      </div>
      {open && (
        <section className="card">
          <h2>Novo membro</h2>
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
                Grupo
                <input value={form.group} onChange={(e) => set('group', e.target.value)} />
              </label>
              <label>
                País
                <input value={form.country} onChange={(e) => set('country', e.target.value)} />
              </label>
              <label>
                Grupo da Bênção
                <input list="member-blessings" required value={form.blessing} onChange={(e) => set('blessing', e.target.value)} />
                <datalist id="member-blessings">
                  {blessings.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </label>
              <div className="actions">
                <button type="submit" className={saving ? 'is-loading' : undefined}>
                  {saving && <span className="spinner" aria-hidden="true" />}
                  {saving ? 'Salvando...' : 'Cadastrar membro'}
                </button>
              </div>
            </fieldset>
          </form>
          {msg && <p className={msg.includes('sucesso') ? 'success' : 'error'}>{msg}</p>}
        </section>
      )}
      {msg && !open && <p className="success">{msg}</p>}
      <section className="cardsList">
        {members.length === 0 && <p className="empty">Nenhum membro cadastrado.</p>}
        {members.length > 0 && visible.length === 0 && (
          <p className="empty">
            {statusFilter === 'inscribed' ? 'Nenhum membro inscrito.' : 'Nenhum membro sem inscrição.'}
          </p>
        )}
        {visible.map((m) => {
          const inscribed = isMemberInscribed(m, regs);
          return (
          <article className={`personCard memberCard ${inscribed ? 'is-inscribed' : 'not-inscribed'}`} key={m.row}>
            <h3>
              {m.givenName} {m.familyName}
            </h3>
            {!inscribed && (
              <button type="button" className="inscribe" onClick={() => onInscribe(m)}>
                Inscrever
              </button>
            )}
            <dl>
              <div>
                <dt>TIS</dt>
                <dd>{m.tis || '—'}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{birthLabel(m.birthDate)}</dd>
              </div>
              <div>
                <dt>Idade</dt>
                <dd>{m.age ?? calcAge(m.birthDate) ?? '—'}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{m.cpf ? cpfMask(m.cpf) : '—'}</dd>
              </div>
              <div>
                <dt>RG / RNM / RNE</dt>
                <dd>{m.document || '—'}</dd>
              </div>
              <div>
                <dt>Grupo</dt>
                <dd>{m.group || '—'}</dd>
              </div>
              <div>
                <dt>País</dt>
                <dd>{m.country || '—'}</dd>
              </div>
              <div>
                <dt>Bênção</dt>
                <dd>{m.blessing || '—'}</dd>
              </div>
            </dl>
          </article>
          );
        })}
      </section>
    </>
  );
}
