# VD2 — Idade do atendimento pela data UTC da chegada

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P0 clínico**, por decisão do RT em 01/11/2026 ("Registra, clínicos P0" e "Sim, VD2").

## Diagnóstico

A tela do médico (`src/pages/plantao/porta/JanelaAtendimento.tsx:168`) e a fila do PS (`src/pages/plantao/porta/FilaPS.tsx:96`) calculam a faixa etária com `faixaEtaria(data_nascimento, chegada_em)`.

`chegada_em` chega do banco como instante em UTC, por exemplo `2026-11-02T00:30:00+00:00`. `comoData` em `src/domain/idade.ts` cortava o texto (`slice(0, 10)`) e ficava com a **data UTC**. Das 21h às 24h de Brasília, essa data já é o dia seguinte.

Na véspera dos 14 anos, a chegada nesse horário fazia a idade ser calculada como no aniversário. A criança entrava como adulto:
- a tela do médico oferecia receita padrão e favoritos de adulto, NEWS2/qSOFA e protocolos de adulto, e tirava as salvaguardas pediátricas;
- a fila do PS tirava o rótulo "pediatria".

A classificação (`Classificar.tsx`) já usava o dia de Brasília e dizia pediátrico, então as duas telas discordavam.

## Correção

Uma só, na causa. `comoData` em `src/domain/idade.ts` passa a converter o instante (texto com hora) para o dia de Brasília com `dataIso` de `src/lib/formato.ts`. Isso segue o padrão do frontend: só `formato.ts` formata com `Intl`, e `plantao.ts` já importa dele.

- Data pura (`AAAA-MM-DD`, como `data_nascimento`): continua igual.
- Date: continua igual.
- Texto inválido: continua dando `null`.

Valem com isso todas as chamadas de `idadeEm`, `ehPediatrico`, `faixaEtaria` e `rotuloIdade` que recebem instante: a tela do médico, a fila do PS e qualquer outra que vier. As chamadas existentes com "hoje" já usavam o dia de Brasília (`dataIso`, `dataSP`, `hojeSP`) e não mudam.

Só tela, sem migration.

## Testes

Em `src/domain/dominio.test.ts`, rodando no CI pelo `npm run test:dominio`:

- **Chegada às 21h30 da véspera:** `2026-11-02T00:30:00+00:00`, para quem nasceu em 02/11/2012, dá pediátrico. À meia-noite de Brasília (`03:00 UTC`) já é adulto.
- **Rótulo de idade:** nascido em 31/10, às 22h de 01/11 em Brasília, mostra "1d". Antes mostrava "2d".
- **Texto inválido:** continua dando `null`.

Sem a correção, os dois testes novos falham: o primeiro recebe `false` quando esperava `true`, o segundo recebe `'2d'` quando esperava `'1d'`. Com ela, passam os 32 de domínio e os 1105 clínicos. `typecheck`, `eslint` e o padrão do frontend também passam ("nada piorou").

A tela não foi aberta no navegador. Para reproduzir, seria preciso um paciente que faz 14 anos amanhã chegando entre 21h e 24h, e a homologação fica atrás do login da Vercel. A regra está coberta pelo teste do domínio, que é a função que as duas telas chamam.

## Riscos

- Instante em texto sem fuso (`2026-11-02T00:30:00`) é lido como hora local do navegador e convertido para Brasília. O banco sempre manda com fuso.
- VD3 (escores pediátricos no banco com `current_date`) e VD8 (idade no caderno do leito) são outros itens do lote.
