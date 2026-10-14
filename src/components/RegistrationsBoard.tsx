import { birthLabel, cpfMask, feeOf, formatFee } from '../helpers';
import type { Registration } from '../types';

export function RegistrationsBoard({ regs }: { regs: Registration[] }) {
  const paidRegs = regs.filter((r) => r.paid === 'Pago');
  const collected = paidRegs.reduce((sum, r) => sum + (feeOf(r) ?? 0), 0);

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
      <section className="cardsList">
        {regs.length === 0 && <p className="empty">Nenhuma inscrição ainda.</p>}
        {regs.map((r) => (
          <article className="personCard" key={r.row}>
            <h3>
              {r.givenName} {r.familyName}
            </h3>
            <dl>
              <div>
                <dt>TIS</dt>
                <dd>{r.tis || '—'}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{birthLabel(r.birthDate)}</dd>
              </div>
              <div>
                <dt>Idade</dt>
                <dd>{r.age ?? '—'}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{r.cpf ? cpfMask(r.cpf) : '—'}</dd>
              </div>
              <div>
                <dt>RG / RNM / RNE</dt>
                <dd>{r.document || '—'}</dd>
              </div>
              <div>
                <dt>Cidade</dt>
                <dd>{r.city || '—'}</dd>
              </div>
              <div>
                <dt>Bênção</dt>
                <dd>{r.blessing || '—'}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{r.registrationType || 'Participante'}</dd>
              </div>
              {r.registrationType === 'JS Registration' && (
                <>
                  <div>
                    <dt>Representante</dt>
                    <dd>{r.representativeName || '—'}</dd>
                  </div>
                  <div>
                    <dt>TIS do representante</dt>
                    <dd>{r.representativeTis || '—'}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Pagamento</dt>
                <dd>{r.paid || 'Não pago'}</dd>
              </div>
              <div>
                <dt>Taxa</dt>
                <dd>{formatFee(feeOf(r))}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </>
  );
}
