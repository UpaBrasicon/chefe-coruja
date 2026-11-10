# Lacuna 7: documento e checklist de transferência (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 7 (P2), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `7.resumo_transferencia` (paciente #7, transferência externa).

## 1. Fontes (conferidas em 10/11/2026)

- **Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1**
  (https://bvsms.saude.gov.br/bvs/saudelegis/gm/2002/prt2048_05_11_2002.html):
  - (a) solicitar a vaga à Central e fazer contato prévio com o serviço que
    vai receber;
  - (b) estabilizar o paciente antes de removê-lo;
  - (d) a decisão de transferir é do médico;
  - (f) um documento de transferência acompanha o paciente e vai para o
    prontuário da unidade que recebe. Leva o diagnóstico de entrada, os
    exames e as condutas, com nome, CRM e assinatura do médico;
  - (g) autorização escrita do paciente ou do responsável, salvo quando não
    for possível;
  - (h) o médico que solicita responde pelo paciente até ele ser recebido;
  - (l) onde há Central de Regulação, nenhuma transferência sem contato com
    ela;
  - 3.3 (e): as intercorrências do transporte são registradas no documento.
- **Res. CFM nº 1.672/2003, Art. 1º:**
  - estabilização prévia;
  - contato e concordância do médico que recebe;
  - relatório completo, legível e assinado, com CRM, também assinado por
    quem recebe;
  - consentimento escrito;
  - neonato em ambulância com incubadora.
- **Res. CFM nº 2.079/2014 (UPA):**
  - passagem de plantão de médico para médico;
  - registro completo;
  - diálogo com o regulador;
  - transferência do paciente instável depois de estabilizado.
- **Res. CFM nº 2.110/2014 (SAMU), Art. 18:** o paciente transferido vai com
  relatório completo do quadro clínico.
- **Res. COFEN nº 588/2018:** trata só do transporte dentro do serviço (entre
  setores).
- Os textos extraídos estão no scratchpad da sessão
  (`transferencia-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

- **A transferência externa existe nas três telas** (porta, observação e
  internação). Hoje ela pede só o destino.
  - A regulação guarda quadro clínico, CID, sinais vitais, exames,
    medicações, transporte e o aceite do destino. Ela não tem folha impressa.
- **Documento:** não há documento de transferência. O mais próximo é o
  encaminhamento (modelo SMS003a), que já preenche sozinho os vitais da
  triagem e o número e o destino da regulação.
- **Modelo de resumo automático:** a contrarreferência à UBS. Ela tira uma
  "fotografia" na saída: unidade, datas, desfecho, CID, relato e documentos.
- **Checklist:** não há checklist de transferência. Na transferência, quase
  nenhum impeditivo de alta vale; só o agravo sem notificação ainda impede.
- **Não modelados:** acompanhante e pertences.

## 3. Pontos para o RT decidir (recomendação em A)

### T1. Documento
- **A:** um tipo novo, "Documento de transferência", com o nome que a
  Portaria 2.048 usa.
- **B:** ampliar o encaminhamento.

### T2. Conteúdo
- **A:** o mínimo das normas (diagnóstico, exames, condutas, médico com CRM),
  mais:
  - alergias;
  - últimos vitais crus;
  - prescrição vigente com a validade;
  - exames com resultado;
  - dispositivos, isolamento, contenção ativa e controlados em uso;
  - dados da regulação: número, destino, aceite e transporte.
  - A folha tem espaço para as intercorrências do transporte e para a
    assinatura do médico que recebe.
- **B:** só o mínimo das normas.

### T3. Preenchimento
- **A:** o app preenche tudo sozinho, como uma fotografia do momento, no
  modelo da contrarreferência.
  - O médico escreve o resumo clínico, as condutas e o motivo da
    transferência.
  - O resto fica só para leitura.
- **B:** tudo editável.

### T4. Checklist
- **A:**
  - contato prévio e aceite do destino (nome de quem aceitou);
  - número da regulação, ou o motivo de não haver;
  - autorização escrita do paciente ou do responsável, ou a exceção
    justificada;
  - paciente estabilizado (declaração do médico);
  - tipo de transporte e quem acompanha (médico, enfermagem);
  - isolamento informado ao destino;
  - incubadora, no neonato.
  - Cada item fica marcado ou com o motivo de não se aplicar.
- **B:** sem checklist; só o documento.

### T5. O que trava a transferência
- **A:** só trava a falta do documento de transferência emitido, que as
  normas exigem. Os itens do checklist ficam registrados, mas não travam,
  para não segurar a vaga zero nem a emergência.
- **B:** todos os itens travam.

### T6. Quem emite e quem assina
- **A:**
  - O médico transferente emite e assina, com o login e o CRM do cadastro.
  - O enfermeiro marca os itens de enfermagem: isolamento, incubadora e
    acompanhante da equipe.
  - O NIR vê o documento.
  - A folha leva o campo de assinatura do médico que recebe.

### T7. Escopo
- **A:** só a transferência externa (porta, observação, internação). A
  transferência entre setores (COFEN 588) fica para depois.

### T8. Impressão
- **A:** folha A4 em duas vias, uma para o destino e outra para o prontuário,
  com os espaços de intercorrências e da assinatura de quem recebe.

### T9. Onde aparece
- **A:**
  - na aba de desfecho ou alta, nas três telas;
  - na Regulação e no NIR;
  - na chegada regulada dentro da rede: o destino vê o documento, como já
    vê as alergias.

## 4. Fora do escopo
- O transporte em si: viatura e equipe.
- Termo de consentimento próprio. O tipo `termo_consentimento` já existe e
  pode ser usado.
- Envio à RNDS.
- Acompanhante e pertences.

## 5. Decisão do RT (10/11/2026)

"Sim": A em T1 a T9.

## 6. Implementação (10/11/2026, branch `lacunas/transferencia`)

### Banco: `supabase/migrations/20270329000001_documento_transferencia.sql`
- **T1:** o tipo `documento_transferencia` entra na CHECK de
  `documentos_clinicos.tipo_documento` (DROP IF EXISTS, ADD NOT VALID,
  VALIDATE). O documento só nasce pela RPC própria. `emitir_documento` e
  `salvar_rascunho` continuam recusando o tipo, e a tabela não aceita
  inserção direta. Assim ninguém grava um documento de transferência sem a
  fotografia do servidor.
- **T2 e T3:** `public.dados_transferencia(paciente)` monta a fotografia no
  servidor, no modelo da contrarreferência:
  - identificação, origem (unidade, setor, leito, entrada) e diagnóstico de
    entrada (o primeiro registro do atendimento e o CID da internação);
  - alergias e últimos sinais vitais crus;
  - prescrição ativa com a validade do item (lacuna 6) e controlados em uso;
  - exames com resultado, dispositivos, isolamento e contenção ativa;
  - regulação: número, protocolo, destino, aceite e transporte.
- **Emissão:** `public.emitir_documento_transferencia(paciente, textos,
  retifica, motivo)` grava a fotografia, os três textos do médico, o
  médico com o registro do cadastro e o checklist da emissão. O conteúdo é
  jsonb, com hash e número. Há um documento em vigor por atendimento; para
  mudar, emite-se uma nova versão com o motivo.
- **T4:** tabela `public.transferencia_checklist`, com um item por
  atendimento (porta: episódio; observação e internação: internação). RLS
  ligado e sem grant: leitura e escrita só pelas RPCs.
  `public.marcar_item_transferencia` grava cada item feito, ou "não se aplica"
  com motivo de 10 letras. A incubadora só vale no recém-nascido (até 27 dias,
  a faixa de `cadastrar_rn`).
- **T5:** a única trava. A transferência externa é recusada sem documento em
  vigor (nem cancelado nem substituído) daquele atendimento. A mensagem é:
  "Emita o documento de transferência antes de transferir (Portaria GM/MS
  2.048/2002, Anexo, Cap. VI, item 3.1 f)."
  - Porta: `registrar_desfecho` 'transferencia'.
  - Internação: `dar_alta` 'transferencia_externa'.
  - Observação: `finalizar_observacao` 'transferencia', que passa por
    `dar_alta`.
- **T6:**
  - Emite o médico em cuidado do paciente. Também emite o médico da porta que
    abriu a observação, enquanto ela está aberta: é a mesma regra do
    encerramento (20270305000001), do parecer e da alergia; sem ela, esse
    médico não conseguiria emitir o documento da transferência que pode
    registrar.
  - O enfermeiro marca os itens de enfermagem e o médico marca os dele.
  - O NIR da unidade lê o painel.
- **T9:** `public.transferencia_da_regulacao(solicitação)` dá a leitura com a
  regra de quem vê o pedido (`private.regulacao_pode_ver`). Também leem a
  enfermagem de plantão no destino, enquanto o paciente chega, e quem cuida
  dele no destino depois da chegada. A leitura fica na auditoria (só o tipo).
- **Cancelamento:** `cancelar_documento` aceita o tipo novo. O autor cancela
  com o motivo, e o documento cancelado deixa de contar para a trava.
- **Impressão:** `folha_documento` passa o checklist do momento da impressão
  (`checklist_atual`).
- **Auditoria:** só códigos. Não leva nome de quem aceitou, motivo, nome do
  paciente nem texto clínico.

### Funções trocadas trecho a trecho (md5 na homologação)
Trecho que some faz a migration parar; aplicar de novo não muda nada; o
rollback volta ao md5 de antes. "Sem CR" é o md5 com o `\r` retirado.

| Função | Antes (bruto / sem CR) | Depois (bruto / sem CR) |
|---|---|---|
| `registrar_desfecho(uuid,text,text,jsonb)` | bc89bea077be08bc3da38077cb40b495 / igual | 28e8c8704ca41d96853a3a2f13ac14ec / igual |
| `dar_alta(uuid,text,text,timestamptz,text,text,jsonb)` | 4f6a4fcd90e0ff59d2fdb3c206611c50 / igual | aefab9ad035ae060f3cde6076ae21eb7 / igual |
| `cancelar_documento(uuid,text)` | 55b7778457c88da1b5fc626491f15e48 / igual | 3798572438baec56c1b02b21a5657c5c / igual |
| `folha_documento(uuid,text)` (CRLF) | 7e21be598019800688cb629fa83ca99e / a6a05b35b64cd51b5c902fdba565a7ef | e5a5f82bbacb2755801d844247765a26 / 767f6b23a78bb87ecf90782669839bc4 |

`finalizar_observacao` não mudou (9e222b0feda67f2ca72c4e77b6773855): a trava da observação vem
de `dar_alta`.

### Telas
- **Desfecho e alta:** `src/components/transferencia/DocumentoTransferencia.tsx`
  aparece nas três telas quando a saída é transferência (porta, observação e
  internação). Mostra:
  - a fotografia só para leitura e os três textos do médico;
  - o checklist, com os itens de cada papel;
  - o botão "Emitir" e "Imprimir (2 vias)".
  - O botão de transferir só se habilita com o documento emitido.
- **Leitura (`LeituraTransferencia`):** no detalhe da Regulação, nas
  pendências de regulação do NIR e na chegada reservada da enfermagem do
  destino.
- **Folha A4** (`src/lib/folhas.ts`, copiada para
  `supabase/functions/_shared/folhas.ts`):
  - duas vias: "Via do destino" e "Via do prontuário da origem";
  - espaço para as intercorrências do transporte e para a assinatura e o CRM
    de quem recebe;
  - sinais vitais crus.
- **Lista de documentos:** o tipo aparece com o nome e pode ser cancelado pelo
  autor.

### Testes e evidências
- **`supabase/tests/transferencia.sql`:** 58 conferências, que passaram na
  homologação em transação desfeita (seed, migration duas vezes, teste).
- **Rollback:** testado. O md5 das quatro funções volta ao de antes e nenhuma
  função nova sobra.
- **Testes de banco ligados ao assunto:** 50 foram rodados com a migration.
  - 36 passaram como estavam.
  - 2 precisaram do documento antes da transferência e foram ajustados:
    `fix_porta_encerra_observacao.sql` e `fix_regulacao_origem_encerrada.sql`.
  - 12 falham igual sem a migration (pré-existentes, fora do assunto):
    `fase1_segundo_fator`, `fase3_aih_ciclo` e dez que param em
    `classificar_risco` ("Informe o fluxograma e o discriminador").
- **Testes do aparelho:** `src/lib/transferencia.test.ts` tem 8 testes;
  `src/domain` e `src/lib` somam 577 testes passando.
- **Conferências do código:** `tsc`, eslint, `padrao-frontend --ci` e a trava
  expand/contract sem erro.

### Pendências
- Publicar a edge function `folha` com o `_shared/folhas.ts` novo. Sem isso, a
  folha do servidor sai como texto; a do aparelho (quando a função não
  responde) já sai certa.
- Os roteiros de `scripts/e2e` com transferência são registros de rodadas
  passadas e não foram mexidos. Se forem rodados de novo, cada passo de
  transferência precisa de um passo antes que emita o documento.
- A tela não foi conferida no navegador: o login é necessário e a migration
  não está aplicada na homologação.
