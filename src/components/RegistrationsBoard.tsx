'use client';

import { useEffect, useMemo, useState } from 'react';
import { birthLabel, cpfMask, feeOf, formatFee, fullName } from '../helpers';
import type { Registration } from '../types';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type PaidFilter = 'all' | 'paid' | 'unpaid';
type FeeFilter = 'all' | 50 | 20 | 0;
type TypeFilter = 'all' | 'Participante' | 'Representative' | 'JS Registration';

function parseFeeFilter(value: string): FeeFilter {
  if (value === '50') return 50;
  if (value === '20') return 20;
  if (value === '0') return 0;
  return 'all';
}

function typeOf(r: Registration) {
  return r.registrationType || 'Participante';
}

export function RegistrationsBoard({ regs, goal }: { regs: Registration[]; goal: number }) {
  const [open, setOpen] = useState<Registration | null>(null);
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [feeFilter, setFeeFilter] = useState<FeeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [nameQuery, setNameQuery] = useState('');
  const paidRegs = regs.filter((r) => r.paid === 'Pago');
  const collected = paidRegs.reduce((sum, r) => sum + (feeOf(r) ?? 0), 0);
  const safeGoal = goal >= 1 ? goal : 1;
  const reachedPct = Math.round((regs.length / safeGoal) * 100);
  const remaining = Math.max(0, safeGoal - regs.length);
  const visible = useMemo(
    () =>
      regs.filter((r) => {
        const paid = r.paid === 'Pago';
        if (paidFilter === 'paid' && !paid) return false;
        if (paidFilter === 'unpaid' && paid) return false;
        if (feeFilter !== 'all' && feeOf(r) !== feeFilter) return false;
        if (typeFilter !== 'all' && typeOf(r) !== typeFilter) return false;
        const q = nameQuery.trim().toLowerCase();
        if (q && !fullName(r).toLowerCase().includes(q)) return false;
        return true;
      }),
    [regs, paidFilter, feeFilter, typeFilter, nameQuery],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <section className="stats stats-4">
        <div>
          <b>{regs.length}</b>
          <span>Inscritos</span>
        </div>
        <div>
          <b>{paidRegs.length}</b>
          <span>Pagos</span>
        </div>
        <div>
          <b>{regs.length - paidRegs.length}</b>
          <span>Não pagos</span>
        </div>
        <div>
          <b>{`R$ ${collected},00`}</b>
          <span>Arrecadado</span>
        </div>
      </section>
      <section className="stats">
        <div>
          <b>{safeGoal}</b>
          <span>Meta</span>
        </div>
        <div>
          <b>{`${reachedPct}%`}</b>
          <span>Alcançado</span>
        </div>
        <div>
          <b>{remaining}</b>
          <span>Faltam</span>
        </div>
      </section>
      <div className="filterGroups">
        <label className="filterSearch">
          Buscar por nome
          <input
            type="search"
            value={nameQuery}
            placeholder="Nome ou sobrenome"
            aria-label="Filtro por nome"
            onChange={(e) => setNameQuery(e.target.value)}
          />
        </label>
        <div className="filterSelects">
          <label>
            Pagamento
            <select
              value={paidFilter}
              aria-label="Filtro de pagamento"
              onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}
            >
              <option value="all">Todos</option>
              <option value="paid">Pagos</option>
              <option value="unpaid">Não pagos</option>
            </select>
          </label>
          <label>
            Taxa
            <select value={String(feeFilter)} aria-label="Filtro de taxa" onChange={(e) => setFeeFilter(parseFeeFilter(e.target.value))}>
              <option value="all">Todas as taxas</option>
              <option value="50">R$ 50</option>
              <option value="20">R$ 20</option>
              <option value="0">Isento</option>
            </select>
          </label>
          <label>
            Tipo
            <select
              value={typeFilter}
              aria-label="Filtro de tipo"
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">Todos os tipos</option>
              <option value="Participante">Participante</option>
              <option value="Representative">Representative</option>
              <option value="JS Registration">JS Registration</option>
            </select>
          </label>
        </div>
      </div>
      <section className="cardsList">
        {regs.length === 0 && <p className="empty">Nenhuma inscrição ainda.</p>}
        {regs.length > 0 && visible.length === 0 && <p className="empty">Nenhum inscrito neste filtro.</p>}
        {visible.map((r) => (
          <button type="button" className="regCard" key={r.row} onClick={() => setOpen(r)}>
            <h3>{fullName(r)}</h3>
            <div className="regMeta">
              <span>
                <small>TIS</small>
                {r.tis || '—'}
              </span>
              <span>
                <small>Nascimento</small>
                {birthLabel(r.birthDate)}
              </span>
              <span>
                <small>Idade</small>
                {r.age ?? '—'}
              </span>
              <span>
                <small>Bênção</small>
                {r.blessing || '—'}
              </span>
              <span>
                <small>Tipo</small>
                {r.registrationType || 'Participante'}
              </span>
              <span>
                <small>Taxa</small>
                {formatFee(feeOf(r))}
              </span>
            </div>
          </button>
        ))}
      </section>
      {open && (
        <div
          className="dialogBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-detail-title"
          onClick={() => setOpen(null)}
        >
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="dialogClose" aria-label="Fechar" onClick={() => setOpen(null)}>
              ×
            </button>
            <h2 id="reg-detail-title">{fullName(open)}</h2>
            <dl className="regDetail">
              <Detail label="TIS" value={open.tis || '—'} />
              <Detail label="Nascimento" value={birthLabel(open.birthDate)} />
              <Detail label="Idade" value={String(open.age ?? '—')} />
              <Detail label="CPF" value={open.cpf ? cpfMask(open.cpf) : '—'} />
              <Detail label="RG / RNM / RNE" value={open.document || '—'} />
              <Detail label="Cidade" value={open.city || '—'} />
              <Detail label="País" value={open.country || '—'} />
              <Detail label="Grupo" value={open.group || '—'} />
              <Detail label="Bênção" value={open.blessing || '—'} />
              <Detail label="Tipo" value={open.registrationType || 'Participante'} />
              {open.registrationType === 'JS Registration' && (
                <>
                  <Detail label="Representante" value={open.representativeName || '—'} />
                  <Detail label="TIS do representante" value={open.representativeTis || '—'} />
                </>
              )}
              <Detail label="Pagamento" value={open.paid || 'Não pago'} />
              <Detail label="Taxa" value={formatFee(feeOf(open))} />
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
