# Ponto 10 — Uma admissão por internação, com reavaliação do quadro

Plano e registro da tarefa, no formato do "Plano de Trabalho — comando por
tarefa" do `BACKLOG.md`. Diagnóstico e opções estão em
`REVISAO-PLANTONISTA-2026-10.md`, no ponto 10.

**Decisão do RT (31/10/2026):** modelo B, "uma admissão + reavaliação".
O RT decidiu em 31/10/2026, e a sessão principal repassou a decisão a esta
sessão.

**Estado:**

- A migration `20270203000005_admissao_unica_reavaliacao` foi aplicada na
  homologação, com a versão registrada e o rollback testado.
- A tela foi publicada na homologação e juntada ao master no PR #383.
- Em produção desde 01/11/2026 (ver a seção 7).

```
Vamos trabalhar a tarefa: ponto 10, uma admissão por internação, com correção e reavaliação do quadro.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P2
Objetivo comercial: a admissão é o documento da entrada e da AIH; corrigir e acompanhar a mudança do quadro sem perder o original
Objetivo técnico: trava de uma admissão no banco; correção que leva a ficha; documento novo "Reavaliação do quadro"
Módulos afetados: aba Admissão do leito (FichaAdmissao), documentos clínicos, folha A4
```

## 1. Diagnóstico

- **"Uma por internação" só era conferido dentro de `registrar_evolucao`.**
  Nem `documentos_clinicos` nem `admissao_fichas` tinham trava.
- **O banco já aceitava corrigir a admissão** (`corrigir_evolucao`), mas a
  tela só tinha "Reimprimir".
- **Achado:** a correção pelo `corrigir_evolucao` não atualizava
  `admissao_fichas`. A ficha e a folha ficariam com a versão antiga.

## 2. Banco (migration `20270203000005`, expand)

- **Trava:**
  - índice único `uq_admissao_por_internacao`, em `documentos_clinicos`:
    uma admissão (versão 1) por internação;
  - índice único `uq_admissao_ficha_vigente`, em `admissao_fichas`: uma
    ficha vigente por internação.
- **Colunas novas em `admissao_fichas`:**
  - `vigente`, com padrão `true`; as linhas de antes ficam vigentes;
  - `justificativa`.
- **Correção:**
  - `public.corrigir_admissao(p_documento, p_conteudo, p_ficha, p_justificativa)`
    valida a ficha (as mesmas regras do registro) e corrige o texto por
    `corrigir_evolucao`. Valem as regras de lá: só o autor, justificativa de
    10 letras ou mais e só a versão mais recente.
  - A ficha nova fica vigente. A anterior continua ligada à versão antiga do
    documento, então a folha da versão antiga não muda.
- **Guarda:** o gatilho de restrição `trg_admissao_corrigida_com_ficha` é
  conferido no fim da transação. Ele recusa a correção de uma admissão que tem
  ficha quando a ficha não vai junto.
- **Validação:** `private.validar_ficha_admissao` é a validação que estava
  dentro de `registrar_admissao`, sem mudança. Agora o registro e a correção
  usam a mesma.
- **Leitura:** `public.admissao_ficha` passa a ler a ficha vigente.
- **Reavaliação:**
  - tipo novo de documento: `reavaliacao_quadro`, acrescentado ao `CHECK` de
    `tipo_documento`;
  - tabela `reavaliacoes_quadro`, com RLS e sem acesso direto;
  - `public.registrar_reavaliacao_quadro(p_internacao, p_conteudo, p_dados)`
    exige internação aberta, plantão no setor, papel de médico e admissão
    registrada antes. Todos os campos são obrigatórios: o que mudou, história,
    exame, hipótese diagnóstica e plano. O documento sai numerado;
  - `public.reavaliacoes_do_quadro(p_internacao)` tem o mesmo acesso da ficha
    da admissão.
- **Rollback:** está no cabeçalho da migration. Foi testado na homologação: as
  funções voltaram iguais (md5) e nenhum objeto sobrou.

## 3. Tela

Na aba Admissão do leito (`FichaAdmissao.tsx`):

- **"Corrigir"**:
  - aparece para quem registrou, na versão em vigor;
  - reabre a ficha preenchida;
  - pede a justificativa;
  - grava e imprime a folha corrigida.
  - A data e a hora da admissão não mudam.
- **"Reavaliação do quadro"** (`ReavaliacaoQuadro.tsx`):
  - o formulário tem o que mudou, história, exame, hipótese pela busca de CID
    e plano;
  - abaixo da admissão aparecem as reavaliações em ordem, cada uma com
    "Reimprimir".
- A admissão que vale é a versão em vigor (`admissaoVigente`). Antes, a tela
  pegava a primeira da lista.
- O rótulo e a folha "Reavaliação do quadro" estão em `documentos.ts`,
  `folhas.ts` e `ProntuarioLeitura.tsx`.
  - **Depende de outra ação:** o título certo na folha impressa depende de
    publicar a edge function `folha`. Até lá, a folha sai com o título
    "Documento clínico" e o texto completo.

## 4. Testes

- **pgTAP:** `supabase/tests/admissao_unica_reavaliacao.sql`. Cobre:
  - a segunda admissão é recusada pela função e pelo índice;
  - a correção sem a ficha é recusada;
  - justificativa curta, ficha incompleta, quem não é o autor e versão antiga
    são recusados;
  - a correção grava a ficha nova e guarda a anterior;
  - na reavaliação: sem admissão, enfermagem e campos faltando são recusados;
    o documento sai numerado e ligado à admissão, que não muda.
- **Na homologação**, com o médico de teste: a mesma sequência rodou numa
  transação desfeita, e tudo passou.
  - O teste do repositório depende do seed local; quem o roda é o CI.
- **Node:** `src/lib/admissaoReavaliacao.test.ts`. Cobre a escolha da versão
  em vigor, as pendências, o texto e os dados da reavaliação.

## 5. Critérios de aceite

| Critério | Evidência |
|---|---|
| A segunda admissão é recusada pelo banco | pgTAP e rodada na homologação |
| A correção atualiza a ficha e guarda a anterior | pgTAP e rodada na homologação |
| A reavaliação fica ligada à admissão, numerada | pgTAP e rodada na homologação |
| "Corrigir" e "Reavaliação do quadro" na aba Admissão | O RT confere na homologação |

## 6. Riscos

| Risco | Cuidado |
|---|---|
| Alguma internação já ter duas admissões | Conferido na homologação: nenhuma. Na produção, o índice único falha antes de gravar se houver, e nada muda |
| Correção pelo caminho antigo sem a ficha | O gatilho recusa no fim da transação |
| Ampliar o `CHECK` de `tipo_documento` | Ampliar é expand: os valores antigos continuam valendo, e a validação roda depois de criar a restrição (`NOT VALID` seguido de `VALIDATE`) |

## 7. Produção

- 01/11/2026: com o "ok produção" do RT, a migration
  `20270203000005_admissao_unica_reavaliacao` foi aplicada na produção (`db push --include-all`), com a
  versão registrada e as permissões conferidas.
- 01/11/2026: PR #383 juntado ao master; o CI ficou verde e a Vercel publicou.
- 01/11/2026: a função `folha` foi publicada na produção a partir do master
  `9a23850f`, com o `folhas.ts` dos pontos 10 e 15. Sem token, ela
  responde 401.
