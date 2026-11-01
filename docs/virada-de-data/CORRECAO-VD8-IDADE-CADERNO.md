# VD8 — Idade no caderno do leito

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P1**. O RT mandou seguir em 01/11/2026 ("Vamos aos próximos passos por aqui").

## Diagnóstico

O caderno do leito (`rascunhoLeito.ts`) mostra a idade com `idadeTexto(nascimento, hoje)` de `src/lib/rascunho.ts`. A data de hoje chega como `AAAA-MM-DD` e era lida assim:

```ts
const da = new Date(dataAtual)
```

`new Date('AAAA-MM-DD')` é meia-noite UTC, ou seja, 21h da véspera em Brasília. As contas usam o dia local (`getFullYear`, `getMonth`, `getDate`), por isso a idade ficava um dia atrás **o dia todo**:
- no aniversário, aparecia a idade anterior: 9 anos para quem fazia 10 hoje;
- meses e dias também ficavam um dia atrás.

A folha impressa recalcula a idade por outro caminho e já estava certa. Só o caderno usa `idadeTexto`.

## Correção

- **Leitura da data:** `idadeTexto` lê a data de hoje como dia local, a partir das partes ano, mês e dia, sem passar por UTC.
- **Import:** `rascunho.ts` passa a importar `./cofreLocal.ts` em vez de `@/lib/cofreLocal`, no mesmo estilo de `./formato.ts`, para o teste em Node conseguir carregar o arquivo.
- Só de tela: sem banco e sem RPC.

## Testes

`src/lib/rascunhoIdade.test.ts` roda na CI no passo `src/lib`, no fuso de Brasília. Confere:
- o dia do aniversário: 10 anos, e não 9;
- meses e dias contados a partir de hoje;
- a virada do ano.

Evidência local:
- sem a correção, falham os 3 testes: deu `9 anos` no lugar de `10 anos` e `1 meses` no lugar de `2 meses`;
- com a correção, passam os 3, e o passo `src/lib` inteiro também (216 testes);
- o `tsc`, o `eslint` e o padrão do frontend passam: nada piorou.

## Riscos

- Muda só a idade mostrada no caderno do leito.
- A data de hoje continua vindo de `hojeLocal()`, que é o dia do navegador. Na UPA o navegador roda no fuso de Brasília.
