# VD7 — Início da validade da APAC

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P1**. O RT mandou seguir em 01/11/2026 ("Vamos aos próximos passos por aqui").

## Diagnóstico

Na regulação, ao autorizar uma APAC, o campo "Validade: início" já vinha preenchido assim:

```ts
const [ini, setIni] = React.useState(new Date().toISOString().slice(0, 10))
```

`toISOString` dá a data UTC. Das 21h às 24h de Brasília, o campo já vinha com o dia seguinte:
- no último dia do mês, vinha o mês seguinte, e a APAC perdia a competência atual;
- em 31/12, vinha o ano seguinte.

Quem autoriza pode corrigir o campo à mão, mas o valor que já vem preenchido induz ao erro.

## Correção

O campo passa a vir com `dataIso()` de `src/lib/formato.ts`, que dá a data de Brasília, como na tela da regulação. Só de tela: sem banco e sem RPC.

## Testes

`src/lib/viradaDeData.test.ts`, que roda na CI no passo `src/lib`:
- **Data de Brasília:** 31/12/2026 às 23h30 em Brasília dá 2027-01-01 em UTC, e `dataIso` dá 2026-12-31.
- **Campo da APAC:** o formulário de autorização começa com `dataIso()`, e a tela não usa mais `toISOString().slice(0, 10)`.

Evidência local:
- sem a correção, o teste da APAC falha (1 de 2);
- com a correção, passam os 2.
- O `tsc`, o `eslint` e o padrão do frontend passam: nada piorou.

Não houve conferência no navegador: a diferença só aparece das 21h às 24h, e o teste cobre a regra.

## Riscos

- Muda só o valor que já vem preenchido no campo. O valor gravado continua sendo o que está no campo na hora de confirmar.
- APACs autorizadas antes com o dia seguinte não são corrigidas aqui.
