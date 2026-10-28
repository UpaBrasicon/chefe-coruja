# Regulação assistencial na RNDS (MIRA)

Fase 5C, tarefa 5. A Portaria GM/MS 6.656/2025 manda todo sistema próprio de
regulação enviar à RNDS, todo dia, os pedidos no Modelo de Informação da
Regulação Assistencial (MIRA, Portaria Conjunta SAES/SEIDIGI 3/2023). Quem não
envia no prazo do Plano Operativo pode ficar fora dos programas de cirurgia
eletiva (art. 9º).

Decisões do RT em 28/10/2026: "1a 2a 3a 4a 5a 6a 7a" e "8a 9a" (ver `BACKLOG.md`).

## Fonte do modelo

O modelo oficial do MIRA (RIRA) não aparece na parte pública do Portal de
Serviços do DATASUS. Por decisão do RT, a base é o projeto da RNDS no
Simplifier, lido em 28/10/2026 pela API FHIR pública
(`https://fhir.simplifier.net/RedeNacionaldeDadosemSaude`):

| Perfil | Recurso | Versão |
|---|---|---|
| `BRRegulacaoAssistencial` | Composition | 1.0 (04/2023) |
| `BRRequisicaoRegulacaoAssistencial` | ServiceRequest | 1.0 (04/2023) |
| `BRAgendamentoRegulacaoAssistencial` | Appointment | 1.0 (04/2023) |
| `BRCID10Avaliado` | Condition | 1.1.0 |

Cópia dos perfis, listas de valores e sistemas de códigos, com SHA-256:
`produto/docs/pesquisa/rnds-simplifier-regulacao/`. A própria página do
Simplifier avisa que o repositório não é o oficial. Tudo é conferido contra o
modelo oficial antes da homologação (etapa 5.5).

## Como funciona (5.1)

1. **Gatilho:** cada mudança de status da solicitação (e a identificação do
   paciente) chama `private.rnds_enfileirar_regulacao`.
2. **Retrato:** `private.rnds_mira_regulacao` monta os dados MIRA daquele
   momento e grava um item `regulacao` na `interop_outbox`, em
   `payload.mira`, da unidade de origem.
3. **Sem repetição:** mudança que não troca o status MIRA (em análise →
   pendência) não grava nada. Um item ainda pendente é descartado quando chega
   um status mais novo, porque o MIRA guarda o estado, não o caminho.
4. **Documento:** `src/interop/fhir/regulacao.ts` monta o Bundle a partir do
   retrato. A hora do envio, o identificador do solicitante na RNDS e o
   documento anterior, que o novo substitui (`relatesTo replaces`), só o envio
   sabe (5.3).
5. **Envio:** ainda desligado. Nada sai do status `pendente`.

## Conversões

| Status do Chefe Coruja | Status MIRA | Requisição | Agendamento | Quem mudou (CNES) |
|---|---|---|---|---|
| enviada, em análise, pendência, aguardando destino | `pending` | active | proposed | origem |
| devolvida | `returned-to-requester` | on-hold | returned-to-requester | central |
| autorizada, agendada, em trânsito | `booked` | active | booked | central |
| realizada | `attended` (com a data) | completed | fulfilled | destino |
| falta | `absence` | revoked | noshow | destino |
| negada, cancelada | `cancelled` | revoked | cancelled | central, ou a origem quando ela cancelou |
| excluída | `excluded` | entered-in-error | excluded | central |
| rascunho | não vai | | | |

- **Modalidade** (o MIRA só aceita 04 e 09): leito e transferência são 04;
  consulta e exame, 09. A coluna `modalidade` da solicitação não muda.
- **Caráter:** eletivo é `routine`; urgência, `urgent`.
- **Paciente:** CPF primeiro, CNS na falta (`BRIndividuo-1.0`). Sem os dois,
  ou não identificado, a solicitação fica fora da fila até ser identificada.
- **CID:** sem o ponto (`I21.9` vai como `I219`), como no `BRCID10`.
- **Estabelecimentos:** por CNES (`BREstabelecimentoSaude-1.0`): origem
  (requisição), destino da rede (executante) e central (reguladora).

## A conferir no modelo oficial

- os status da requisição e do agendamento de cada status MIRA, e o do
  participante;
- o autor do documento (hoje, a unidade de origem, dona da credencial);
- o tipo `ESS` no estabelecimento do evento `pending`;
- a data do agendamento sem data prevista (hoje, a hora do evento: o FHIR
  exige início e fim fora de `proposed` e `cancelled`);
- se o paciente não identificado pode ir (o perfil tem a extensão
  `BRIndividuoNaoIdentificado`; hoje fica retido);
- a substituição: o manual do RAC diz que um documento só é substituído uma
  vez; aqui cada status novo substitui o último enviado, em cadeia.

## Testes

- `supabase/tests/fase5c_rnds_regulacao.sql`: o gatilho, o retrato, as regras
  de repetição, a retenção do não identificado e do sem documento.
- `scripts/interop/tests/regulacao.test.ts`: o Bundle contra as regras dos
  perfis (cardinalidade, códigos fixos, identificadores e referências).

## Como reverter

O rollback está no cabeçalho de `20270204000001_rnds_regulacao.sql`: tira o
gatilho e as funções, descarta os itens pendentes de regulação e volta a lista
de tipos da fila (`NOT VALID`). O fluxo da regulação não depende de nada disso.
