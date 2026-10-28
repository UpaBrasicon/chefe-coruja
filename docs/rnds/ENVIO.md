# Envio à RNDS — o banco (5C-5.3a)

Migration `20270205000001_rnds_envio_banco.sql`. O serviço de envio (5.3b, no
VPS na 5.3c) não lê tabela: chama três funções com a chave de serviço.
Nenhum documento sai do banco sem o serviço.

## As três funções

| Função | O que faz |
|---|---|
| `rnds_pegar_lote(limite)` | Devolve até 100 itens `pendente` ou `retido` cuja hora chegou, só de unidade com o envio ligado e sem pausa. Trava cada item por 5 min, e outro pedido não os pega. |
| `rnds_dados_documento(item)` | A carga. `dados` vem no formato de `src/interop/fhir/tipos.ts` (RAC, SA) ou é o retrato MIRA (5.1). `envio` traz o ambiente, a UF da unidade, o identificador do solicitante, o id RNDS do último documento aceito (para substituí-lo) e o CNS de quem assina. Falta de configuração vira erro com o prefixo `retido:`. |
| `rnds_registrar_resultado(item, resultado, …)` | Grava o que a RNDS respondeu. Os resultados estão na tabela abaixo. |

| Resultado | Quando | O que acontece |
|---|---|---|
| `enviado` | 201 | Grava o id RNDS, a hora, o Bundle enviado e a resposta. |
| `retido` | falta dado (o mapper ou a carga recusaram com `retido:`) | Grava o motivo. O item volta a ser tentado de hora em hora, até o dado ser corrigido. |
| `reenviar` | rede ou 5xx | Tenta de novo depois de 1, 2, 4… minutos, no máximo 1 h. Na 30ª tentativa (cerca de 24 h) vira `erro`. |
| `erro` | 422 (recusa definitiva) | Grava o `OperationOutcome` e não tenta de novo. Volta só à mão (painel da 5.4). |
| `credencial` | 401, ERR882–884 | O item volta à fila e a unidade **pausa**, com o motivo, até alguém olhar. |

## Configuração por unidade (`rnds_config_unidade`)

- Ambiente: homologação ou produção.
- Identificador do solicitante: o que a RNDS dá na aprovação da credencial.
- Financiamento padrão (`BRFinanciamento`; 07 = Municipal SUS).
- Envio ligado.
- A pausa, quando a credencial é recusada.

A configuração nasce com o envio desligado. Só o gestor e o super admin a leem.
Pela API ninguém grava: a tela é a 5.4, e até lá a configuração é ajustada por SQL na homologação.

## De onde vem cada dado

| Dado | RAC (porta) | SA (internação ou observação) |
|---|---|---|
| Início e fim | `chegada_em` → hora do desfecho (`desfecho_detalhes.alta_em`, se retroativa) | `data_admissao` → `data_alta` |
| Profissional | o médico do atendimento; na falta, quem deu o desfecho | quem deu a alta |
| Diagnóstico | `diagnosticos_episodio` ativos (o primário é o principal); na falta, o CID da alta | `diagnosticos_episodio` da internação; na falta, `cid_alta` ou `cid_principal` |
| Procedimento | `procedimentos_realizados` do episódio; na falta, a conta | a conta da internação; na falta, o que foi lançado no episódio depois da admissão |
| Medidas | a última PAS, PAD, peso e estatura do episódio | — |
| Resumo | — | o último `resumos_clinicos` da internação |

Um procedimento repetido no mesmo dia vai uma vez só, com a quantidade somada, porque a RNDS recusa a repetição (ERR789).

## Códigos (CodeSystems oficiais, definições de 07/2026)

| Campo | Regra |
|---|---|
| Modalidade | porta e observação **06**; internação **04** |
| Caráter | eletiva **01**; o resto **02** (a 06 não aceita eletivo, ERR784) |
| Procedência | internação vinda de outra unidade **12**; o resto **99** (informação ausente) |
| Desfecho | alta e alta após medicação **01**; a pedido **02**; evasão **04**; óbito **06**; transferência **09** |

## Quem assina (header `Authorization`)

- **RAC e SA:** o profissional do documento.
- **MIRA:** quem mudou o status. Se a mudança veio de uma rotina, sem usuário, assina o autor do último evento da solicitação.

Sem CNS, o serviço deixa o item retido (5.3b).

## Conferência noturna

Roda às 01:00 de Brasília (`rnds-conferencia-noturna`). Pega o que mudou no dia anterior e não está na fila, e põe na fila:
- as solicitações com evento no dia;
- os atendimentos da porta encerrados sem internar;
- as altas.

Item com erro não volta. O resultado de cada dia fica em `private.rnds_conferencias`.

## Rollback

Está no cabeçalho da migration e foi testado na homologação.
- **Sai:** as funções, a configuração, a conferência e o LOINC das quatro medidas. O que estava retido volta a pendente.
- **Fica:** as colunas novas da fila (nulas, sem uso) e o enfileiramento novo, que funciona sem o resto.
