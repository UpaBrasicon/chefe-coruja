# Gate de aprovação das fichas (LG10)

Decisões do RT de 17/11/2026, todas A. O diagnóstico está em `docs/regulatorio/LG10-GATE-APROVACAO-DIAGNOSTICO.md`.

## O que cobre

- **Guarda de versão (G2).** Num PR para o `master`, o CI falha se a ficha, o `TOPOS[id]`, o `GUIAS[id]` ou o arquivo que define a ficha mudou e a versão dela não subiu. Isso não tem dispensa.
- **Telas.** Se mudou uma tela da Central (`src/pages/plantonista/**` ou `src/components/plantonista/**`) que usa uma ficha, a versão dela também tem de subir. A exceção é o PR que traz no corpo a linha `Sem mudança clínica: <motivo>`.
- **Gate (G1).** Toda ficha com versão nova, ou ficha nova, precisa estar `aprovada` na produção. Enquanto não estiver, o PR não mescla e a versão anterior continua no ar.
- **Onde roda.** No job `web` do CI, nos passos "Testes do gate das fichas" e "Gate de aprovação das fichas". O script é `scripts/gate-fichas.mjs`, com as regras em `scripts/gate-fichas-regras.mjs`.

## O que não cobre

- **Alertas que rodam no banco** (sepse do adulto, interações, acuidade) e o conteúdo do Hermes. Decisão G7: ficam para o LG11 e o LG13.
- **Arquivo clínico sem ficha ligada.** Exemplos: `ToolLayout.tsx`, helpers do pacote e telas que não importam ficha. A guarda só lista esses arquivos no resumo do job, para conferir à mão.
- **Push direto no `master`.** O gate só roda em PR. O `master` é protegido e só recebe PR.
- **Fichas que nunca foram aprovadas e não mudaram.** Decisão G3: continuam no ar com a faixa "aguardando aprovação".

## Chaves envolvidas

- `GATE_SUPABASE_PUBLISHABLE_KEY` é uma **variável** do repositório no GitHub (Actions → Variables), não um segredo. Guarda a chave publicável da produção, que já é pública no pacote do site.
- Com ela, o CI chama só `public.status_versoes_fichas(jsonb)` (migration `20270414000082`). A função devolve id, versão e status, e nenhum nome, CRM ou dado de paciente.
- **Sem a variável, o gate falha** quando o PR tem versão nova. Na dúvida, não publica.
- A URL da produção está escrita no próprio `ci.yml`.

## Como usar num lote de fichas

1. Suba a versão de toda ficha cujo conteúdo, topo, guia ou tela mudou. Gere a migration com `npm run fichas:sql`.
2. Publique na homologação e abra o PR. O gate fica vermelho, listando as versões novas.
3. O RT dá o "ok produção". A migration vai à produção e registra as versões como aguardando.
4. O RT aprova as versões na Revisão Clínica da produção. A fila tem o link "Ver a versão … na homologação".
5. Rode de novo o job `web` do PR (GitHub → Actions → Re-run jobs, ou pela API). O gate lê o status e o corpo atuais do PR.
6. Com o CI verde, faça o merge. A versão nova vai ao ar já aprovada.

## Como reverter

- **Tirar o gate:** apagar os dois passos do LG10 no job `web` do `.github/workflows/ci.yml`. Também dá para voltar `fetch-depth` e `permissions`, que só existem por causa dele.
- **Tirar a função:** `DROP FUNCTION IF EXISTS public.status_versoes_fichas(jsonb);` (a volta está escrita na migration).
- **Telas:** o texto novo da faixa no `ToolLayout` e o link na Revisão Clínica não dependem do gate. Podem ficar.
