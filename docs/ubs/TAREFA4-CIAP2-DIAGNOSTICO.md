# 5A, tarefa 4: CIAP-2

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada em 03/11/2026, na ordem combinada com o RT, depois das tarefas 2 e 3 concluídas.

O aceite do backlog é: "Atendimento UBS aceita CIAP-2". As subtarefas são importar a terminologia, criar a busca e vincular ao atendimento.

Este documento é o diagnóstico. **Decisões do RT em 03/11/2026: A em G1 a G4** ("Sim, todas A").

## Fonte

**Ministério da Saúde, e-SUS APS, *Layout e-SUS APS de Dados e Interface* (LEDI), versão 8.7.0, página "Relação entre CIAP2 e CID10"** (integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/referencias/relacao_ciap_cid.html).

- É a tabela que o e-SUS APS usa e que o SISAB aceita: 686 códigos da CIAP-2. Cada um traz a descrição e a CID-10 relacionada (por exemplo, A03 "Febre" com R50).
- Os códigos vão de A01 a Z29, nos capítulos da CIAP-2 (A geral, B sangue, D digestivo, F olho, H ouvido, K circulatório, L musculoesquelético, N neurológico, P psicológico, R respiratório, S pele, T endócrino, U urinário, W gravidez e planejamento familiar, X genital feminino, Y genital masculino, Z problemas sociais).
- **A CID-10 relacionada não é uma tradução exata.** Uma CIAP pode cobrir mais de um diagnóstico; a relação serve de referência.
- **Direito autoral:** a CIAP-2 é da WONCA, e a tradução brasileira é da SBMFC (2ª edição, 2009). O Ministério publica a tabela para os sistemas que se integram ao e-SUS APS; o app usaria essa mesma tabela, com a fonte citada.

A Ficha de Atendimento Individual (Manual do CDS 2.1, p. 62 a 65) pede, em "Problema/condição avaliada", a lista da ficha e, em "Outros", a CIAP-2 e/ou a CID-10.

## 1. Diagnóstico do estado atual

- **A CIAP-2 não existe no app.** Não há tabela, busca nem campo no atendimento.
- **Terminologias que existem** (esquema `terminologia`): CID-10 (14.233 códigos na produção), SIGTAP, CBO, CMED e LOINC.
  - A busca é `terminologia_buscar(tabela, termo, limite)`, em português, sem acento, por prefixo e pelo código.
  - Os dados grandes entram por arquivo à parte (`supabase/homolog/partes`); a CIAP-2, com 686 linhas, cabe numa migration.
- **No atendimento da UBS**, a aba Conduta já aceita o problema/condição pela lista da ficha e pela CID-10 (`episodios.problemas_aps` e `cid_aps`, em `registrar_conduta_aps`). Falta a CIAP-2.

## 2. Decisões do RT (G1 a G4): todas A em 03/11/2026

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| G1 | De onde vem a CIAP-2 | **A)** a tabela oficial do LEDI do e-SUS APS (MS, v8.7.0): 686 códigos com a CID-10 relacionada, carregada por migration. **B)** o PDF da SBMFC (2ª edição, 2009), transcrito | A: é a que o SISAB aceita, e já vem em formato de tabela |
| G2 | Onde a CIAP-2 entra | **A)** no problema/condição avaliada da aba Conduta: a busca mostra a lista da ficha, depois a CIAP-2, depois a CID-10, e a CIAP fica gravada no episódio. **B)** também no SOAP, ao lado da CID-10 da Avaliação | A: é onde a ficha do e-SUS APS pede |
| G3 | A CID-10 relacionada | **A)** ao escolher uma CIAP, a tela mostra a CID-10 relacionada da tabela do e-SUS como referência, com um botão para acrescentar; nada entra sozinho. **B)** não mostrar | A |
| G4 | Escuta inicial | **A)** fica de fora nesta tarefa; a CIAP entra só na consulta. **B)** motivo da consulta em CIAP-2, opcional, na escuta | A: mantém a escuta curta; volta se o RT quiser |

## 3. Proposta técnica (com as recomendações)

Duas partes, cada uma com o próprio PR:

| Parte | Entrega |
|---|---|
| 4.1 banco | `terminologia.ciap2` (código, descrição, capítulo, CID-10 relacionada) com os 686 códigos; `terminologia_buscar('ciap2', ...)`; `episodios.ciap_aps text[]`; `registrar_conduta_aps` aceita a CIAP-2 (conferida na tabela) como problema; testes |
| 4.2 tela | a busca da aba Conduta com a CIAP-2 entre a lista da ficha e a CID-10, a etiqueta da CIAP e a CID relacionada (G3); as saídas e a janela mostram a CIAP |

**Banco (expand):**
- só tabela e coluna novas, anuláveis;
- `registrar_conduta_aps` ganha um parâmetro opcional `p_ciaps` no fim, sem mudar quem já chama;
- o rollback derruba a tabela e a coluna, que só a CIAP usa.

**Riscos:**
- a tabela do MS pode mudar de versão: o teste confere a contagem e alguns códigos, e a migration diz de qual versão veio;
- a relação com a CID-10 é só referência e não entra sozinha (G3).

## Parte 4.1, banco (03/11/2026)

Migration `20270215000001_ciap2.sql` (gerada da página do LEDI por um script, com os 686 códigos); teste `supabase/tests/5a_ciap2.sql`.

- **`terminologia.ciap2`:** código, descrição, capítulo e CID-10 relacionada, esta no formato da CID do app, com ponto (R688 vira R68.8). Busca por `terminologia_buscar('ciap2', ...)`, por nome e por código; o `extra` traz o capítulo e a CID relacionada.
- **`episodios.ciap_aps`** (anulável).
- **`registrar_conduta_aps`:** ganha `p_ciaps` opcional no fim.
  - A CIAP-2, conferida na tabela e sem repetir, conta como problema/condição avaliada.
  - A versão de 6 parâmetros sai na mesma transação, e não há duas funções com o mesmo nome. Os grants continuam os mesmos.
  - Quem chama sem a CIAP-2 continua igual.
- **Também corrigido:** o teste `5a_agenda.sql` dependia da hora em que rodava. Depois da meia-noite, "agora menos 1 hora" caía no dia anterior. Agora usa o meio-dia e as 00:00 de hoje.

**Homologação (03/11/2026):**
- migration aplicada duas vezes (idempotente) e versão registrada;
- `5a_ciap2.sql` passa; `5a_atendimento_ubs`, `5a_consulta_ubs_ponta_a_ponta`, `5a_escuta_inicial` e `5a_agenda` seguem passando;
- rollback: a busca volta ao md5 de antes (39729d9d…) e a conduta ao de 6 parâmetros (eb104c86…, o da produção); o teste falha; reaplicada, o retrato fica igual ao de depois (busca 077c596b…, conduta cd9b711d…).

**Produção (03/11/2026, ok do RT):** migration `20270215000001` aplicada por `producao:push`. Versão registrada; retrato igual ao da homologação: 686 códigos, busca 077c596b…, conduta de 7 parâmetros cd9b711d…, mesmos grants, coluna presente, leitura da tabela pelo `authenticated`.

## Parte 4.2, tela (03/11/2026)

Sem migration.

- **Aba Conduta:**
  - a busca única do problema/condição mostra a lista da ficha, depois a CIAP-2 e depois a CID-10;
  - a CIAP escolhida vira etiqueta ("K86 · HIPERTENSÃO SEM COMPLICAÇÕES"), na descrição oficial em maiúsculas;
  - o envio leva `p_ciaps`.
- **G3:** para cada CIAP escolhida, a tela mostra a CID-10 relacionada da tabela do e-SUS APS, como referência, com um botão para acrescentar ("K86 → I10"). Nada entra sozinho.
- **Saídas do plantão:** a coluna da CID passa a mostrar também a CIAP-2.
- **Conferência:**
  - teste de tela em `telaUbsConduta.test.ts` (a ordem lista → CIAP → CID, `p_ciaps` e a CID relacionada só pelo botão);
  - `src/lib` (256), testes clínicos (1105), tipos, lint e padrão passando;
  - na página de teste: as opções na ordem certa, a referência e o envio com `p_ciaps: [K86]` e `p_cids: [I10]`.

## Fechamento da tarefa 4 (03/11/2026)

| Critério de aceite | Evidência |
|---|---|
| Atendimento UBS aceita CIAP-2 | `supabase/tests/5a_ciap2.sql`, rodado na homologação: tabela, busca, conduta só com a CIAP, código fora da tabela recusado, chamada sem a CIAP igual a antes; tela da Conduta conferida |
| Importar a terminologia | `terminologia.ciap2` com os 686 códigos do LEDI 8.7.0, na produção |
| Criar a busca | `terminologia_buscar('ciap2')`, por nome e por código |

PRs: #421 (banco) e o desta parte (tela). Migration na produção com o ok do RT: `20270215000001`.

**Fica para depois:** a CIAP-2 na escuta inicial (G4); a conduta com login na tela da homologação.
