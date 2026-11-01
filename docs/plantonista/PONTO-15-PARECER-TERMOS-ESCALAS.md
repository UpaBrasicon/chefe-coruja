# Ponto 15 — Parecer, Termo de consentimento, Cuidados paliativos e Escalas

Plano e registro da tarefa, no formato do "Plano de Trabalho — comando por
tarefa" do `BACKLOG.md`. Diagnóstico e pesquisa estão em
`REVISAO-PLANTONISTA-2026-10.md`, no ponto 15.

**Decisão do RT (31/10/2026)**, repassada pela sessão principal:

- As escalas da enfermagem (NIPS, FLACC, Braden e Morse) vão para uma aba
  "Escalas" própria.
- Parecer, Termo de consentimento e Termo de cuidados paliativos ficam em
  abas separadas.
- Escala paliativa só entra com a fonte completa lida: dose e escala só de
  fonte citada, nunca do adulto para a criança.
- Sem a fonte completa, entra só a Pergunta surpresa, que está confirmada.
- PPI e PaP, quando entrarem, valem só para câncer avançado no adulto.

**Estado:**

- A migration `20270203000006_termo_paliativo_pergunta_surpresa` foi aplicada
  na homologação, com a versão registrada e o rollback testado.
- A tela foi publicada na homologação e juntada ao master no PR #387.
- Em produção desde 01/11/2026 (ver a seção 7).

## 1. Diagnóstico

- A aba "Parecer e termos" do leito juntava três coisas: o Parecer, o Termo
  de consentimento e as escalas da enfermagem.
- O app não tinha termo de cuidados paliativos nem escala paliativa.

## 2. Banco (migration `20270203000006`, expand)

- **Categoria do modelo de termo:**
  - coluna `termos_modelos.categoria`, com o valor `consentimento` (o de
    antes, padrão) ou `cuidados_paliativos`;
  - a versão nova de um modelo herda a categoria das anteriores, por um
    gatilho;
  - `public.definir_categoria_modelo_termo` (só o gestor) muda a categoria
    de todas as versões do modelo, e a mudança fica na auditoria.
- **Termo emitido:** continua do tipo `termo_consentimento`. A categoria vem
  do modelo usado.
  - `termos_consentimento_do_paciente` devolve a categoria dos modelos e dos
    termos.
  - O resto da função não muda; ela foi conferida contra a versão da
    homologação.
- **Pergunta surpresa no catálogo das avaliações** (`private.escala_avaliacao`):
  - o resultado fica gravado em `avaliacoes_escala`, com o valor
    `pergunta_surpresa` acrescentado ao `CHECK`;
  - adulto apenas, versão `2026-10-31.1`;
  - resposta 0: ficaria surpreso (triagem negativa);
  - resposta 1: não ficaria surpreso (triagem positiva: avaliar as
    necessidades de cuidado paliativo).
- **`registrar_avaliacao`:**
  - na criança, recusa a pergunta surpresa, com a mensagem que cita a escala;
  - sem a data de nascimento, também recusa, porque a fonte é de adultos;
  - as outras regras não mudam.
- **Rollback:** está no cabeçalho da migration. Foi testado na homologação: as
  funções voltaram iguais (md5), e nenhum objeto nem `CHECK` diferente sobrou.

## 3. Fonte clínica

- **Pergunta surpresa:** "Você ficaria surpreso se este paciente morresse nos
  próximos 12 meses?"
  - Fonte: Downar J et al. CMAJ 2017;189(13):E484-E493, PMID 28385893,
    [doi:10.1503/cmaj.160775](https://doi.org/10.1503/cmaj.160775).
  - Resultado da revisão sistemática: sensibilidade de 67% e especificidade de
    80%, em 16 estudos e 11.621 pacientes, com desempenho de fraco a moderado.
  - A tela diz que é triagem, não prognóstico, e que não define conduta.
- **Ficha:** `src/clinico/paliativo/perguntaSurpresa.ts`, com público adulto e
  sem referência pediátrica. O teste fica em `perguntaSurpresa.test.ts`.
- **Não entram agora** (falta o texto completo da fonte, com a tabela de
  pontos): PPS, PPI, PaP, SPICT, NECPAL e PaPaS.

## 4. Tela

- **Leito:** a aba "Parecer e termos" virou quatro:
  - **Parecer**;
  - **Termo de consentimento**;
  - **Cuidados paliativos**;
  - **Escalas**.
  - O endereço antigo `?aba=comp` abre o Parecer.
- **Cuidados paliativos** (`AbaCuidadosPaliativos.tsx`):
  - a Pergunta surpresa aparece só no adulto. Na criança, ou sem nascimento,
    a tela diz por que não se aplica;
  - o termo de cuidados paliativos usa a mesma peça do termo de consentimento,
    com `categoria`. Ele sai só de um modelo da unidade; sem modelo, a tela
    avisa.
- **Escalas:** o histórico mostra só NIPS, FLACC, Braden e Morse.
- **Unidade › Termos de consentimento:** o gestor escolhe a categoria do
  modelo novo e pode passar um modelo de uma categoria para a outra.
- **Folha de avaliações:** traz o nome e a fonte da pergunta surpresa.
  - **Depende de outra ação:** o nome na folha impressa pelo servidor
    depende de publicar a edge function `folha`.

## 5. Testes

- **pgTAP:** `supabase/tests/termo_paliativo_pergunta_surpresa.sql`. Cobre:
  - categoria: só o gestor muda; categoria inválida é recusada; a versão nova
    herda; os modelos de antes continuam de consentimento;
  - pergunta surpresa: positiva no adulto; recusada na criança; resposta fora
    das opções é recusada; Braden na criança continua recusada.
- **Na homologação**, com o usuário de teste: a mesma sequência rodou numa
  transação desfeita, e tudo passou. Isso inclui o painel do termo devolvendo
  a categoria.
- **Node:** `src/clinico/paliativo/perguntaSurpresa.test.ts` e
  `src/lib/acoesLeito.test.ts` (`?aba=comp`).

## 6. Critérios de aceite

| Critério | Evidência |
|---|---|
| Quatro abas no lugar de "Parecer e termos" | O RT confere na homologação |
| Pergunta surpresa só no adulto, com a fonte | pgTAP, rodada na homologação e teste da ficha |
| Termo paliativo com modelo da unidade da categoria | pgTAP e rodada na homologação; o RT confere |
| Escalas da enfermagem na aba Escalas | O RT confere |

## 7. Produção

- 01/11/2026: com o "ok produção" do RT, a migration
  `20270203000006_termo_paliativo_pergunta_surpresa` foi aplicada na produção (`db push --include-all`), com a
  versão registrada e as permissões conferidas.
- 01/11/2026: PR #387 juntado ao master; o CI ficou verde e a Vercel publicou.
- 01/11/2026: a função `folha` foi publicada na produção a partir do master
  `9a23850f`, com o `folhas.ts` dos pontos 10 e 15. Sem token, ela
  responde 401.
