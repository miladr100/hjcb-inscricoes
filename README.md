# Inscrições Grandes Obras HJCB — Outubro 2026

PWA em Next.js conectado ao Google Sheets informado pelo projeto.

## Planilha
- ID: `1Js72ABpSSEL78y4Ms4GxBQig6iA9ozRhAV2-2tpLdLA`
- `Banco de Dados`: leitura A:J
- `Inscricoes`: A:J preserva exatamente o modelo recebido. O sistema cria K:O para dados administrativos: City, Registration Type, Paid, Representative TIS, taxa.
- A coluna `taxa` guarda o valor calculado pela idade: 0–6 = 0; 7–17 = 20; 18+ = 50.

## Google Sheets API
1. Crie/abra um projeto no Google Cloud e habilite Google Sheets API.
2. Crie uma Service Account e uma chave JSON.
3. Compartilhe a planilha Google Sheets com o e-mail da Service Account como **Editor**.
4. Copie `.env.example` para `.env` e preencha `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY`.

## Rodar
```bash
npm install
npm run dev
```
Aplicação: http://localhost:3000

## Produção
```bash
npm run build
npm start
```

A senha padrão é `verdadeirospais`, validada no servidor. Em produção defina `SESSION_SECRET` forte.

## Regras implementadas
- Busca de membros por nome, TIS ou CPF.
- Preenchimento automático a partir de `Banco de Dados`.
- Grupo da Bênção extraído dinamicamente da planilha; aceita novo valor.
- CPF opcional, com máscara e dígitos verificadores.
- RG/RNM/RNE opcional.
- Cidade/UF padrão Campo Grande/MS, editáveis.
- Participante / Representative / JS Registration.
- JS Registration exige TIS do Representative.
- Pago / Não pago.
- Bloqueio de duplicidade por TIS, CPF ou Nome + Nascimento.
- Edição e exclusão.
- Exportação CSV com as 10 colunas oficiais A:J.
- Layout mobile-first e manifest PWA.
