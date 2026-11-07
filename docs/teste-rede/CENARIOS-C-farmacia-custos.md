# Cenários de teste ponta a ponta — Bloco C: farmácia, faturamento, custos e ERP

Catálogo de cenários da frente "Teste ponta a ponta da rede" (BACKLOG, pedido do RT em 06/11/2026), bloco C: o custo é o protagonista. Cada cenário percorre a rede de teste F5 na homologação, diz quem faz o quê em qual tela, onde o valor nasce no banco e o que o testador confere no fim. Base: `docs/teste-rede/MAPA.md` (seções 2.7, 3 e "Lacunas"); tudo que está aqui foi conferido em `src/` e `supabase/migrations/`. Nada foi executado contra banco.

## Índice

- [Convenções do bloco](#convenções-do-bloco)
- [C01 — Conta de porta com BPA-I e BPA-C e fechamento da competência](#c01--conta-de-porta-com-bpa-i-e-bpa-c-e-fechamento-da-competência)
- [C02 — Internação com AIH, pré-auditoria e glosa com recurso](#c02--internação-com-aih-pré-auditoria-e-glosa-com-recurso)
- [C03 — APAC com competências executadas](#c03--apac-com-competências-executadas)
- [C04 — Farmácia: validação, alta vigilância, dispensação, estoque e conta sem valor](#c04--farmácia-validação-alta-vigilância-dispensação-estoque-e-conta-sem-valor)
- [C05 — ERP: remuneração de plantões, versões da conta e reabertura pelo gestor](#c05--erp-remuneração-de-plantões-versões-da-conta-e-reabertura-pelo-gestor)
- [C06 — Leitura dos números pela API e pelo arquivo do ERP](#c06--leitura-dos-números-pela-api-e-pelo-arquivo-do-erp)
- [Resumo das lacunas tocadas](#resumo-das-lacunas-tocadas)

## Convenções do bloco

- **Valores em reais são FICTÍCIOS.** Toda tabela de custo começa com a linha "EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais". Na tela, o valor que aparece é o `valor_sa` (porta) ou `valor_sh + valor_sp` (internação) do SIGTAP carregado (competência 202609). O testador anota o valor real que a tela mostra na coluna "Valor na tela" da planilha e confere **a soma e o momento**, não o número fictício.
- **Rede de teste:** UPA Fase 5 24h (`f5100000-0000-4000-8000-000000000002`, CNES `9995028`), setores Pronto Socorro (`…-011`), Observação Adulto (`…-012`) e Internação (`…-013`); Central de Regulação Fase 5 (`…-009`). Contas `*.f5@teste.local` do MAPA, seção 5.1. Antes de cada sessão, rodar `scripts/e2e/41_checkin_fase5.sql` (a porta fecha 30 min depois do início sem check-in); gestor, faturamento e admin não dependem de escala.
- **Competência:** `M` = mês do teste no formato AAAAMM (horário de Brasília); `M-1` e `M+1` são o mês anterior e o seguinte.
- **O autor é o login.** Cada passo roda com a conta do papel indicado; nenhum passo é "em nome de" outra pessoa, exceto o faturamento lançar procedimento em nome de quem fez (`registrar_procedimento` com `p_profissional`), que é regra própria do sistema.
- **Regras clínicas:** nenhuma dose aparece aqui. Medicamento é citado pelo nome do catálogo de teste e "dose conforme a prescrição do cenário (fictícia, só para teste de fluxo)". Peso referido antes de prescrever (regra do MAPA, seção 6). A cor da classificação é decisão do enfermeiro.
- **Conferência no banco:** pelo SQL Editor da homologação, como o papel (`e2e.passo`) ou lendo as tabelas citadas. Auditoria = `public.log_auditoria` (coluna `acao`), escrita por `private.registrar_auditoria`. Histórico da conta = `conta_eventos` (`evento`).
- **Lacunas:** quando o cenário bate numa lacuna do MAPA, o passo diz "Lacuna (MAPA): …" e o que o testador confere no lugar. Um cenário nunca exige o que o sistema não faz.

---

### C01 — Conta de porta com BPA-I e BPA-C e fechamento da competência

- **Objetivo:** provar que a conta ambulatorial nasce com a ficha, ganha um item a cada fato (classificação, consulta, medicação checada, procedimento registrado), fecha com os itens congelados e sai na competência do BPA em dois instrumentos (BPA-I e BPA-C), sem valor no arquivo.
- **Rede e unidades:** UPA Fase 5 24h, setor Pronto Socorro.
- **Papéis e contas de teste:** `recepcao.upa.f5` (recepção), `enfermeiro.upa.f5` (enfermeiro), `medico.upa.f5` (plantonista), `faturamento.f5` (faturamento), `gestor.upa.f5` (gestor).
- **Paciente fictício:** Antônio C1 Corte na Mão, 42 anos, sexo M, raça/cor parda (IBGE), CNS de teste com dígito válido (o cadastro recusa CNS inválido), endereço preenchido. Queixa: corte na palma da mão com faca de cozinha.
- **Pré-condições:**
  1. `41_checkin_fase5.sql` rodado; enfermeiro e médico com check-in no PS.
  2. Faturamento em `/faturamento` (`Bpa.tsx`): cabeçalho do BPA preenchido (`definir_bpa_config`: órgão de origem, sigla, CNPJ, órgão de destino, M/E); códigos associados por fonte (`associar_procedimento_bpa`): `atendimento_medico` → `0301060096`, `classificacao` → `0301060118`, `medicacao` → `0301100012` (os três existem no SIGTAP carregado; `supabase/homolog/faturamento-teste.sql` usa os mesmos) e um código de `lista` para o procedimento do cenário (sutura ou curativo, escolhido em `buscar_sigtap`; registro 02 no SIGTAP para sair no BPA-I). Marcar o código da medicação como "sempre BPA-C" (`marcar_sempre_bpa_c`) para o cenário cobrir os dois instrumentos.
  3. CNES da UPA já é `9995028` (`definir_cnes_unidade` do gestor só se faltar).
  4. Perfis com CNS válido e CBO (`perfis.cns`, `perfis.cbo`): médico com CBO de médico (ex.: 225125), enfermeiro com CBO 2235xxxx. **Os perfis F5 não trazem CNS nem CBO de fábrica** (`40_rede_fase5.sql`); o RT preenche pelo SQL Editor como em `faturamento-teste.sql`. Sem isso, as linhas ganham crítica, vão para "fora" e o cenário segue pelo Caminho B (liberação do gestor), que também é válido.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` (Nova ficha) | Cadastra Antônio (sexo, nascimento, raça/cor, CNS) e abre ficha no PS com a queixa | Ficha aberta; conta ambulatorial criada sozinha, `status = 'aberta'`, número `A-AAAA.nnnnnn`, pagador `sus` (vem de `pacientes.categoria`) | `registrar_ficha`; gatilho `trg_conta_do_episodio`; `contas.tipo = 'ambulatorial'`, `episodio_id`; `conta_detalhe` com `itens = []` e `total_referencia = 0` |
| 2 | enfermeiro | `/triagem` | Chama, registra sinais e classifica pelo fluxograma de adulto; a cor é decisão do enfermeiro (ex.: verde) | 1ª classificação do episódio | `chamar_paciente`, `classificar_risco` → `classificacoes_risco`; em `conta_detalhe.itens` aparece `origem = 'classificacao'`, `procedimento = 0301060118`, `valor_unitario = valor_sa` |
| 3 | plantonista | `/atendimento` | Assume o paciente | `episodios.atendimento_medico_id` preenchido | `iniciar_atendimento`; item `origem = 'atendimento'`, `procedimento = 0301060096` |
| 4 | plantonista | `/atendimento` (Atendimento) | SOAP com CID existente (ferimento da mão) e peso referido | SOAP gravado com CID (sem CID, a pré-auditoria pode apontar `cid_exigido` se o SIGTAP exigir CID para o procedimento) | `registrar_soap(…, p_cid)`; `conta_detalhe.itens[].cid` |
| 5 | plantonista | `/atendimento` (Prescrição) | Prescreve Dipirona sódica injetável, dose conforme a prescrição do cenário (fictícia), horário "Agora" | Item ativo | `prescrever`; `prescricao_itens` |
| 6 | enfermeiro | `/checagem` | Checa o item como "feito" no horário | Administração registrada | `checar(p_item, 'feito', horário)` → `administracoes.situacao = 'feito'`; item `origem = 'medicacao'`, `procedimento = 0301100012`, **uma linha por paciente, profissional e dia** |
| 7 | faturamento | `/faturamento/contas` → "Lançar procedimento" | Lança a sutura em nome do médico (quem fez), quantidade 1, no episódio | Procedimento registrado pela via `faturamento` | `registrar_procedimento(p_paciente, código da lista, 1, p_episodio, NULL, p_profissional = médico)` → `procedimentos_realizados`; item `origem = 'registro'`, `retiravel = true`; borda: código fora da lista → "Procedimento fora da lista da unidade." |
| 8 | plantonista | `/atendimento` (Desfecho) | Desfecho `alta` | Episódio encerrado; a conta pode fechar | `registrar_desfecho(p_episodio, 'alta', …)`; `episodios.desfecho_em` |
| 9 | faturamento | `/faturamento/contas` (detalhe) | Abre a conta: 4 itens, total de referência, pendências | `total_referencia` = soma dos 4 `valor_total`; painel de pendências por grupo | `conta_detalhe`: `itens`, `total_referencia`, `pendencias` (`grupo`, `codigo`, `bloqueante`) |
| 10 | faturamento | idem | "Em conferência" | `status = 'em_conferencia'` | `mudar_etapa_conta(p_conta, 'em_conferencia')`; `conta_eventos.evento = 'conferencia'` |
| 11a | faturamento | idem (Caminho A, dados completos) | "Fechar" | `status = 'fechada'`; itens congelados | `mudar_etapa_conta(…, 'fechada')`; `contas.itens_congelados` (jsonb com `valor_unitario` e `valor_total`), `congelada_em`, `pendencias_fechamento`; `log_auditoria.acao = 'conta_fechada'` |
| 11b | faturamento → gestor | idem (Caminho B, crítica bloqueante) | Fechar é recusado; o gestor libera com justificativa; o faturamento fecha | Erro "A conta tem N pendência(s) bloqueante(s)…"; depois da liberação, fecha | `liberar_fechamento_conta(p_conta, motivo ≥ 10)` só pelo gestor (faturamento → "só o gestor da unidade libera"); `contas.liberada_em`, `liberacao_pendencias`; `conta_eventos.evento = 'liberada'`; `log_auditoria.acao = 'conta_fechamento_liberado'` |
| 12 | faturamento | idem | "Faturar" | `status = 'faturada'`; versão 1 para o ERP nasce sozinha | `mudar_etapa_conta(…, 'faturada')`; gatilho `trg_erp_versao` → `conta_versoes_erp` (`versao = 1`, `total`); `conta_eventos.evento = 'erp_disponivel'` |
| 13 | faturamento | `/faturamento` (BPA, competência M) | Conferência da competência | Linhas por origem; destino de cada linha: classificação, consulta e sutura em `bpa_i`; medicação em `bpa_c` ("Código marcado pela unidade como sempre BPA-C"); linha com crítica fora de identificação vai para `fora` | `bpa_conferencia(p_unidade, M)` → `por_origem`, `linhas[].destino`, `criticas`, `avisos` |
| 14 | faturamento | idem | "Fechar competência" M (processamento M) | Fechamento gravado; arquivo BPA Magnético gerado **sem valor** (só procedimento e quantidade) | `fechar_competencia_bpa(p_unidade, M, M)` → `bpa_fechamentos` (`linhas = 3`, `linhas_bpa_c = 1`, `folhas`, `controle`, `excluidas`, `avisos`, `sigtap_competencia`); `arquivo_bpa` → `BPA_9995028_M.txt`; `log_auditoria.acao = 'bpa_competencia_fechada'`, depois `'bpa_arquivo_baixado'` |
| 15 | faturamento | `/faturamento/contas` | Tenta lançar outro procedimento em M | Recusado: competência fechada | `registrar_procedimento` recusa com a competência fechada (MAPA 3.2, "Trava") |
| 16 | faturamento | `/faturamento` (BPA) | "Reabrir" com motivo | `situacao = 'reaberta'`, motivo gravado; fechar de novo gera outro fechamento | `reabrir_competencia_bpa(p_fechamento, motivo ≥ 10)`; `log_auditoria.acao = 'bpa_competencia_reaberta'` |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco` (1ª do episódio) → `private.conta_itens` (`origem = 'classificacao'`, `valor_sa`) |
| Consulta médica na UPA | 0301060096 | 1 | R$ 20,00 | R$ 20,00 | `episodios.atendimento_medico_id` → `conta_itens` (`origem = 'atendimento'`) |
| Administração de medicamentos | 0301100012 | 1 | R$ 5,00 | R$ 5,00 | `administracoes` "feito" agrupadas por paciente, profissional e dia → `conta_itens` (`origem = 'medicacao'`) |
| Sutura (procedimento da lista) | código da busca | 1 | R$ 30,00 | R$ 30,00 | `procedimentos_realizados` → `conta_itens` (`origem = 'registro'`) |
| Dipirona sódica (dispensada) | — | — | — (não existe) | — | `conta_detalhe.medicamentos`, sem coluna de valor |
| **Total da conta** | | | | **R$ 65,00** | `conta_detalhe.total_referencia`; no fechamento, `contas.itens_congelados[].valor_total` somados; na versão do ERP, `conta_versoes_erp.total` (só itens `faturavel`) |

**Planilha de conferência:** totais esperados

| Linha | Esperado (fictício) | Valor na tela (anotar) | Onde confere |
|---|---|---|---|
| Soma dos 4 itens antes de fechar | 65,00 | | `conta_detalhe.total_referencia` = Σ `itens[].valor_total` |
| Soma depois de fechar | igual à de antes | | `contas.itens_congelados` (não muda mais; `conta_detalhe` passa a ler o congelado) |
| Total da versão 1 do ERP | 65,00 se nenhuma linha foi "fora"; 65,00 − valor da linha "fora" no Caminho B | | `conta_versoes_erp.total` vs `dados.total_referencia`; `dados.itens[].faturavel` |
| Linhas do BPA em M | 3 em BPA-I + 1 em BPA-C | | `bpa_fechamentos.linhas`, `linhas_bpa_c`; o arquivo não traz valor |
| Valor no arquivo BPA | nenhum campo de valor | | `arquivo_bpa.conteudo` |

**Critérios de aceite:**
- A conta existe antes de qualquer item e cada item aparece **no momento do fato** (classificação, assunção, checagem "feito", registro), não no fechamento.
- `total_referencia` é a soma exata de `valor_total` dos itens; nenhum item de medicamento entra na soma.
- Fechar com pendência bloqueante é recusado para o faturamento e só passa com a liberação do gestor; voltar a "aberta" apaga a liberação (`liberada_em = NULL`).
- Depois de fechada, `itens_congelados` não muda mesmo que se registre outra administração.
- O arquivo BPA tem procedimento e quantidade, sem valor; a linha da medicação sai no BPA-C e as outras no BPA-I.
- Com a competência fechada, `registrar_procedimento` e `cancelar_procedimento_realizado` são recusados.

**Bordas a provar:**
- Recepção não lê contas (`contas_da_unidade` → "Acesso negado", como `F5.B.1.recepcao_sem_contas`).
- Faturamento não reabre conta fechada ("Reabrir conta fechada é do gestor da unidade"); gestor reabre com motivo ≥ 10.
- Duas checagens "feito" do mesmo enfermeiro no mesmo dia geram **uma** linha de medicação.
- Paciente sem CNS e sem CPF: só aviso (`documento`), a linha vai para o BPA-C se o SIGTAP aceitar; raça/cor ausente é crítica.
- Enfermeiro sem CBO 2235/3222 na medicação: crítica `cbo_enfermagem` (salvo se o SIGTAP tiver lista de CBO para o código).
- Fechar competência futura ou com cabeçalho incompleto é recusado.

**Lacunas tocadas:**
- Lacuna (MAPA): valor de medicamento na conta não existe; o cenário só confere que o item aparece sem valor.
- Lacuna (MAPA): não há TISS/TUSS nem tabela de convênio; trocar o pagador para `convenio` (`trocar_pagador_conta`) muda o rótulo, e o valor continua SIGTAP.
- Lacuna (ambiente F5): perfis sem CNS/CBO de fábrica; sem o preparo da pré-condição 4, o cenário roda só pelo Caminho B.

---

### C02 — Internação com AIH, pré-auditoria e glosa com recurso

- **Objetivo:** percorrer o ciclo da AIH (laudo → `solicitada` → decisão do regulador → `aprovada`), mostrar o valor principal `SH + SP` na conta de internação, lançar um procedimento especial, travar o fechamento enquanto a AIH não é aprovada, fechar, faturar e registrar duas glosas: uma com recurso e valor recuperado, outra marcada como perdida pelo gestor.
- **Rede e unidades:** UPA Fase 5 24h (PS → Internação, leito INT); Central de Regulação Fase 5 (regulador).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5` (PS), `medico.internacao.f5` (Internação), `nir.f5` (NIR), `regulador.f5` (regulador, CRM 950012), `faturamento.f5`, `gestor.upa.f5`.
- **Paciente fictício:** Benedita C2 Pneumonia, 68 anos, sexo F, com CNS de teste válido. Queixa: tosse com febre há 3 dias.
- **Pré-condições:**
  1. Check-ins (`41_checkin_fase5.sql`), inclusive do NIR e do regulador.
  2. **Vínculo do regulador na UPA.** `decidir_aih` exige `tenho_papel(unidade_da_AIH, 'regulador')` e a AIH nasce na UPA; na F5 a `regulador.f5` só tem vínculo na Central (`40_rede_fase5.sql`, l. 98). O RT dá à `regulador.f5` um vínculo `regulador` na UPA pelo SQL Editor antes do cenário. Sem isso, a AIH fica `solicitada` e a conta só fecha com a liberação do gestor (Caminho B do C01).
  3. Códigos do C01 associados (a conta da porta continua existindo); perfis com CNS/CBO como no C01.
  4. Gestor em `/unidade?aba=configuracoes` → críticas da AIH (`definir_critica_aih`): deixar o padrão do catálogo.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` | Ficha de Benedita no PS | Conta `A-…` aberta | `registrar_ficha`; `contas` (ambulatorial) |
| 2 | enfermeiro | `/triagem` | Classifica (cor do enfermeiro, ex.: amarelo) | Item de classificação na conta A | `classificar_risco`; `conta_detalhe` da conta A |
| 3 | plantonista (PS) | `/atendimento` | Assume; SOAP com CID de pneumonia existente no CID-10 carregado; peso referido | Item de consulta na conta A | `iniciar_atendimento`, `registrar_soap(…, p_cid)` |
| 4 | plantonista (PS) | `/atendimento` (Desfecho) | Desfecho `internacao` escolhendo leito INT livre | Internação criada com `internado_em`; **conta de internação** `I-…` nasce ligada à conta A | `leitos_para_ocupar`, `registrar_desfecho(p_episodio, 'internacao', …, p_detalhes.leito_id)`; gatilho `trg_conta_da_internacao`; `contas.tipo = 'internacao'`, `conta_origem_id` = conta A; `conta_detalhe` da A mostra `derivadas` |
| 5 | plantonista (Internação) | `/plantao/internacao/pacientes` (caderno do leito) | Admissão e diagnóstico | Registros no leito | `registrar_admissao`, `registrar_diagnostico` |
| 6 | plantonista (Internação) | caderno do leito → Laudo de AIH (`LaudoAih.tsx`) | Emite o laudo: procedimento principal escolhido na busca SIGTAP do laudo (instrumento AIH), CID principal, justificativa | Documento ativo; **AIH nasce sozinha** em `solicitada` | `emitir_documento(p_paciente, 'laudo_aih', conteúdo, …)` → `documentos_clinicos` (`conteudo->'aih'->>'procCod'`); gatilho `trg_aih_do_laudo` → `aihs.status = 'solicitada'`, `laudo_id`; `aih_eventos.evento = 'solicitada'`; `conferir_aih` lista as críticas |
| 7 | faturamento | `/faturamento/contas` (conta I) | Abre a conta de internação | Item `origem = 'aih'` com `valor_unitario = SH + SP` do `procCod`, `aih.status = 'solicitada'`; pendência **bloqueante** do grupo `documento`: "AIH ainda não aprovada pelo regulador." | `conta_detalhe`: `itens[0].aih`, `pendencias` (`grupo = 'documento'`, `bloqueante = true`) |
| 8 | NIR | `/nir` | Vê a pendência `aih_sem_decisao` e cobra | Cobrança registrada | `nir_pendencias`, `nir_cobrar` → `nir_cobrancas` |
| 9 | regulador | `/aih` | Aprova com número de 13 dígitos fictício (ex.: `1234567890123`) e competência M | `status = 'aprovada'`, `numero`, `competencia` | `aihs_da_unidade(UPA)`, `decidir_aih(p_aih, true, '1234567890123', M)`; `aih_eventos.evento = 'aprovada'`; bordas: número com 12 dígitos → "Número da AIH: 13 dígitos."; rejeitar com motivo < 10 → recusado; decidir de novo → "Só se decide AIH solicitada" |
| 10 | faturamento | `/faturamento/contas` (conta I) → "Lançar procedimento" | Lança um procedimento especial/secundário da internação (instrumento 04/05 no SIGTAP, escolhido na busca), quantidade 2, em nome do médico da internação | Item `origem = 'lancamento'`, `valor_total = 2 × (SH + SP)`, `retiravel = true`; críticas do lançamento (instrumento, CBO, quantidade máxima, sexo, idade) | `lancar_procedimento_conta(p_conta, código, 2, p_profissional)` → `conta_lancamentos`; `conta_eventos.evento = 'lancamento'`; `private.criticas_lancamento_aih` |
| 11 | plantonista (Internação) | caderno do leito → Alta | Alta melhorada com CID | Internação com `data_alta`; a conta I pode fechar | `impeditivos_alta` vazio; `dar_alta(p_internacao, 'alta_melhorada', cid, …)` |
| 12 | faturamento | `/faturamento/contas` (conta I) | Em conferência → Fechar → Faturar | Sem pendência bloqueante (AIH aprovada); `itens_congelados` com 2 itens; versão 1 do ERP | `mudar_etapa_conta` ×3; `contas.itens_congelados`, `congelada_em`; `conta_versoes_erp.versao = 1`; borda: fechar antes da alta → "A internação ainda não teve alta" |
| 13 | faturamento | `/faturamento/glosas` → "Registrar glosa" | Glosa 1 no item da AIH, motivo `cid`, competência M, valor sugerido aceito | `status = 'aberta'`, `valor = valor_sugerido = SH + SP` | `registrar_glosa(p_conta, 'aih', aih_id, 'cid', texto, NULL, M)` → `conta_glosas` (`valor`, `valor_sugerido`, `item_rotulo = 'AIH (principal) · código · nome'`); `conta_glosa_eventos.evento = 'registrada'`; `log_auditoria.acao = 'glosa_registrada'`; gatilho `trg_erp_glosa` atualiza `conta_versoes_erp.alterada_em` |
| 14 | faturamento | idem | Glosa 1 → "Em recurso", competência do recurso M+1, motivo ≥ 10 | `status = 'em_recurso'`, `competencia_recurso = M+1` | `mudar_glosa(p_glosa, 'em_recurso', motivo, M+1)`; evento `recurso`; borda: competência M-1 → "não pode ser anterior à da produção glosada" |
| 15 | faturamento | idem | Glosa 1 → "Recuperada", valor recuperado menor que o glosado (fictício: 240 de 300) | `status = 'recuperada'`, `valor_recuperado = 240` | `mudar_glosa(p_glosa, 'recuperada', motivo, NULL, 240)`; evento `recuperada` com `valor`; borda: valor maior que o glosado → "Valor recuperado entre zero e o valor glosado." |
| 16 | faturamento | idem | Glosa 2 no lançamento especial, motivo `quantidade` | `status = 'aberta'`, `valor = 2 × (SH + SP)` | `registrar_glosa(p_conta, 'lancamento', lancamento_id, 'quantidade')`; borda: registrar de novo no mesmo item → "Já há glosa em andamento para este item." |
| 17 | gestor | `/faturamento/glosas` | Glosa 2 → "Perdida", motivo ≥ 10 | `status = 'perdida'` | `mudar_glosa(p_glosa, 'perdida', motivo)`; borda: faturamento → "Só o gestor marca a glosa como perdida." |
| 18 | faturamento | `/faturamento/glosas` (painel) | Lê os totais da competência M | Glosado, recuperado, perdido e em andamento batem com a planilha; por motivo: `cid` e `quantidade` | `glosas_da_unidade(UPA, NULL, M)` → `totais`, `por_competencia`, `por_motivo`; a conta I continua `faturada` (a glosa não muda a etapa) |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Procedimento principal da AIH (clínico de internação) | `procCod` do laudo | 1 | SH R$ 250,00 + SP R$ 50,00 = R$ 300,00 | R$ 300,00 | `aihs` + `documentos_clinicos.conteudo->'aih'->>'procCod'` → `private.conta_itens` (`origem = 'aih'`, `valor_sh + valor_sp`) |
| Procedimento especial/secundário | código da busca (04/05) | 2 | SH R$ 20,00 + SP R$ 5,00 = R$ 25,00 | R$ 50,00 | `conta_lancamentos` → `conta_itens` (`origem = 'lancamento'`, `qt × (valor_sh + valor_sp)`) |
| **Total da conta I** | | | | **R$ 350,00** | `conta_detalhe.total_referencia`; `contas.itens_congelados`; `conta_versoes_erp.total` |
| Glosa 1 (AIH, motivo `cid`) | — | — | `valor_sugerido` R$ 300,00 | `valor` R$ 300,00 | `conta_glosas.valor`, `valor_sugerido` (= `private.glosaveis_da_conta`) |
| Glosa 1 recuperada | — | — | — | `valor_recuperado` R$ 240,00 | `conta_glosas.valor_recuperado`; `conta_glosa_eventos.valor` |
| Glosa 2 (lançamento, motivo `quantidade`) | — | — | `valor_sugerido` R$ 50,00 | `valor` R$ 50,00; perdida | `conta_glosas` (`status = 'perdida'`, `valor_recuperado = NULL`) |
| Diária, permanência, honorário | — | — | — (não existe) | — | Lacuna (MAPA): nada no sistema |

**Planilha de conferência:** totais esperados

| Linha | Esperado (fictício) | Valor na tela (anotar) | Onde confere |
|---|---|---|---|
| Conta I antes do lançamento | 300,00 | | `conta_detalhe.total_referencia` (1 item) |
| Conta I depois do lançamento | 350,00 | | idem (2 itens) |
| Conta A (porta) | só classificação + consulta (C01: 30,00); **não** inclui a AIH | | `conta_detalhe` da conta A; `derivadas` aponta a conta I |
| Versão 1 do ERP da conta I | 350,00 | | `conta_versoes_erp.total`; `dados.conta_origem` = número da conta A |
| Painel de glosas em M: glosado | 350,00 | | `glosas_da_unidade.totais.glosado` |
| Painel: recuperado | 240,00 | | `totais.recuperado` |
| Painel: perdido | 50,00 | | `totais.perdido` |
| Painel: em andamento | 0,00 | | `totais.em_andamento` |
| Por motivo | `cid`: 300 glosado / 240 recuperado; `quantidade`: 50 / 0 | | `por_motivo` |

**Critérios de aceite:**
- A conta de internação nasce em `internado_em` e aponta a conta da porta; o valor da AIH só aparece na conta I.
- O valor da AIH é `SH + SP` do `procCod` e não é gravado em `aihs` (a tabela não tem coluna de valor): só `conta_itens` e `glosaveis_da_conta` o calculam.
- Enquanto a AIH está `solicitada`, a pendência "AIH ainda não aprovada pelo regulador." é bloqueante e trava o fechamento; aprovada, some.
- Só o regulador com CRM e vínculo na unidade da AIH decide; o NIR cobra e não decide.
- A glosa só entra em conta `fechada` ou `faturada`; `valor_sugerido` vem do item congelado; recurso negado volta a `aberta`; só o gestor marca `perdida`.
- `glosas_da_unidade` fecha com a planilha; a conta não muda de etapa por causa da glosa.

**Bordas a provar:**
- Cancelar o laudo cancela a AIH (`aihs.status = 'cancelada'`); retificar laudo de AIH aprovada é recusado.
- `ajustar_competencia_aih` só em AIH aprovada, com motivo ≥ 10 e competência diferente.
- Lançamento com quantidade acima de `qt_maxima` ou CBO não aceito aparece em `criticas` do item (bloqueante se a crítica for bloqueante na unidade).
- `retirar_procedimento_conta(p_conta, 'lancamento', id, motivo)` só com a conta aberta ou em conferência; evento `retirada`.
- Reabrir a conta I pelo gestor depois de faturada: `itens_congelados = NULL` e a versão do ERP fica `substituida` (ver C05).

**Lacunas tocadas:**
- Lacuna (MAPA): não existe exportação da AIH (SISAIH01); o testador confere `aihs` e a conta, não um arquivo.
- Lacuna (MAPA): glosa é à mão; não há importação do retorno SIA/SIH.
- Lacuna (MAPA): diária de leito, tempo de permanência com valor e honorário não existem.
- Lacuna (ambiente F5): regulador só na Central; precisa do vínculo na UPA (pré-condição 2).

---

### C03 — APAC com competências executadas

- **Objetivo:** percorrer a APAC do pedido do médico à decisão do regulador, registrar execuções em duas competências, fechar a competência com arquivo e provar que a APAC **não tem valor** na conta (só na glosa, pelo `valor_sa`).
- **Rede e unidades:** UPA Fase 5 24h (PS); Central de Regulação Fase 5.
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5` (plantonista, CRM 950008), `nir.f5`, `regulador.f5`, `faturamento.f5`.
- **Paciente fictício:** Cícero C3 Sessões, 55 anos, sexo M, CNS de teste válido. Queixa: acompanhamento de procedimento de alta complexidade pedido pelo médico da UPA.
- **Pré-condições:**
  1. Check-ins; regulador com vínculo `regulador` na UPA (`decidir_apac` exige `tenho_papel(unidade_da_APAC, 'regulador')`; mesma lacuna F5 do C02).
  2. Executante da APAC com CBO no perfil (`registrar_execucao_apac` exige) e vínculo ativo na UPA: usar o próprio `medico.upa.f5` com CBO preenchido.
  3. Faturamento define o órgão emissor da APAC (`definir_apac_orgao_emissor`) se o fechamento pedir.
  4. Procedimento escolhido em `buscar_sigtap_apac` com instrumento 06/07 no SIGTAP e CID compatível (sem crítica bloqueante em `private.criticas_apac`).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção, enfermeiro, plantonista | `/recepcao`, `/triagem`, `/atendimento` | Ficha, classificação (cor do enfermeiro) e assunção, como no C01 | Conta A com classificação e consulta | `conta_detalhe` |
| 2 | plantonista | `/atendimento` → Solicitar APAC (`SolicitarApac.tsx`) | Pede APAC tipo 1 (inicial), caráter 01, procedimento da busca, CID principal, justificativa ≥ 10, ligada ao episódio | `apacs.status = 'solicitada'`, `criticas` sem bloqueante, `sigtap_competencia` | `solicitar_apac(p_paciente, {procedimento, cid, tipo: '1', carater: '01', justificativa: {justificativa}, episodio_id})`; `apac_eventos.evento = 'solicitada'`; `log_auditoria.acao = 'apac_solicitada'`; bordas: enfermeiro (sem CRM) → "A APAC é solicitada pelo médico (CRM no cadastro)."; tipo 2 sem `apac_anterior` → recusado; CID fora do formato → recusado |
| 3 | faturamento | `/faturamento/contas` (conta A) | Abre a conta | A APAC aparece nos documentos SUS com aviso "APAC ainda não autorizada." (**não** bloqueante); nenhum item com valor para a APAC | `conta_detalhe.documentos`, `pendencias` (`grupo = 'documento'`, `codigo = 'apac'`, `bloqueante = false`) |
| 4 | NIR | `/nir` | Vê `apac_sem_decisao` e cobra | Cobrança | `nir_pendencias`, `nir_cobrar` |
| 5 | regulador | `/apac` | Autoriza com número de 13 dígitos fictício (ex.: `2000000000001`) e validade de M até M+2 | `status = 'autorizada'`, `numero`, `validade_inicio`, `validade_fim` | `decidir_apac(p_apac, true, '2000000000001', início, fim)`; `apac_eventos.evento = 'autorizada'`; bordas: número repetido → "Este número de APAC já foi usado."; fim antes do início → recusado; rejeitar com motivo < 10 → recusado |
| 6 | plantonista | `/atendimento` (Desfecho) | Alta | Episódio encerrado | `registrar_desfecho('alta')` |
| 7 | faturamento | `/apac` → "Registrar execução" | Execução da competência M: tipo de atendimento e motivo de saída/permanência com 2 dígitos (a tela pede; tabela da Portaria SAS 719/2007), data, executante = médico, procedimentos `[{procedimento principal, quantidade 1}]` | Execução gravada em M | `registrar_execucao_apac(p_apac, M, tipo, motivo, data, executante, [{procedimento, quantidade}])` → `apac_execucoes` (`competencia`, `procedimentos` jsonb); `apac_eventos.evento = 'execucao_registrada'`; bordas: competência fora da validade → "Competência fora da validade da APAC"; procedimento sem instrumento 06/07 → "O SIGTAP não registra … em APAC."; quantidade acima de `qt_maxima` → recusado; executante sem CBO → recusado |
| 8 | faturamento | idem | Execução da competência M+1 (dentro da validade) | Segunda execução | `apac_execucoes` (2 linhas, `cancelado_em IS NULL`) |
| 9 | faturamento | `/apac` (aba Arquivo, competência M) | Conferência | Linha da APAC sem crítica; globais sem bloqueio | `apac_conferencia(UPA, M)` → `linhas`, `globais`, `fechamento = null` |
| 10 | faturamento | idem | "Fechar competência" M e baixar o arquivo | Fechamento com `apacs = 1`, `controle`; arquivo `APAC_9995028_M.txt` **sem valor** | `fechar_competencia_apac(UPA, M)` → `apac_fechamentos`; `arquivo_apac(p_fechamento)`; `log_auditoria.acao = 'apac_competencia_fechada'`, `'apac_arquivo_baixado'`; bordas: fechar de novo → "Competência da APAC já fechada."; nova execução em M → "já foi fechada pelo faturamento; peça a reabertura." |
| 11 | faturamento | idem | Reabrir com motivo | `situacao = 'reaberta'` | `reabrir_competencia_apac(p_fechamento, motivo ≥ 10)` |
| 12 | faturamento | `/faturamento/contas` (conta A) | Em conferência → Fechar → Faturar | `itens_congelados` só com classificação e consulta; a APAC não entra | `mudar_etapa_conta` ×3; `contas.itens_congelados` sem `origem = 'apac'` |
| 13 | faturamento | `/faturamento/glosas` → "Registrar glosa" | Lista de itens glosáveis mostra "APAC 2000000000001 · código · nome" com valor sugerido = `valor_sa` e competência = maior competência executada (M+1) | Glosa registrada na APAC, motivo `documento` | `private.glosaveis_da_conta` (origem `apac`); `registrar_glosa(p_conta, 'apac', apac_id, 'documento', texto)` → `conta_glosas.valor_sugerido = valor_sa` |
| 14 | faturamento | `/apac` | Cancela a execução de M+1 com motivo | `cancelado_em`, `motivo_cancelamento`; a competência glosável da APAC volta a M | `cancelar_execucao_apac(p_execucao, motivo ≥ 10)`; `apac_eventos.evento = 'execucao_cancelada'` |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `conta_itens` (`classificacao`) |
| Consulta médica na UPA | 0301060096 | 1 | R$ 20,00 | R$ 20,00 | `conta_itens` (`atendimento`) |
| Procedimento da APAC, competência M | código da busca (06/07) | 1 | — (não entra na conta) | — | `apac_execucoes.procedimentos`; **nenhum valor** em `apacs`, `apac_execucoes` ou `conta_itens` |
| Procedimento da APAC, competência M+1 | idem | 1 | — | — | idem |
| **Total da conta A** | | | | **R$ 30,00** | `conta_detalhe.total_referencia` (a APAC não soma) |
| Glosa da APAC (motivo `documento`) | — | — | `valor_sugerido` = `valor_sa` fictício R$ 100,00 | R$ 100,00 | `conta_glosas.valor_sugerido` (único lugar em que a APAC vira reais) |

**Planilha de conferência:** totais esperados

| Linha | Esperado (fictício) | Valor na tela (anotar) | Onde confere |
|---|---|---|---|
| Conta A, antes e depois das execuções | 30,00 (não muda com a APAC) | | `conta_detalhe.total_referencia` |
| APACs no fechamento de M | 1 | | `apac_fechamentos.apacs` |
| Execuções válidas da APAC | 2 antes do passo 14; 1 depois | | `apac_execucoes WHERE cancelado_em IS NULL` |
| Valor sugerido da glosa da APAC | `valor_sa` do procedimento (anotar) | | `conta_glosas.valor_sugerido`; `glosaveis_da_conta[].valor` |
| Valor no arquivo APAC | nenhum | | `arquivo_apac.conteudo` |

**Critérios de aceite:**
- Só médico com CRM solicita; só regulador com CRM e vínculo na unidade decide; só o faturamento executa e fecha.
- `autorizada` exige número de 13 dígitos e validade; a execução só cai dentro da validade e em competência não fechada.
- A APAC nunca altera `total_referencia`; aparece na conta como documento SUS com aviso não bloqueante.
- O fechamento guarda `apacs`, `controle`, `excluidas` e gera o arquivo sem valor; reabrir pede motivo.
- A glosa da APAC usa `valor_sa` como sugestão e a competência da última execução válida.

**Bordas a provar:**
- Decidir APAC já decidida → "Só APAC solicitada é decidida".
- Execução sem o procedimento principal ou com quantidade 0 → recusada.
- Fechar competência sem execução sem crítica → "Nenhuma APAC sem crítica com execução nesta competência."
- Faturamento de outra rede chamando `apac_conferencia(UPA F5)` → "Acesso negado".

**Lacunas tocadas:**
- Lacuna (MAPA): não há valor gravado na APAC; o cenário prova a ausência e usa a glosa como único ponto de valor.
- Lacuna (ambiente F5): regulador sem vínculo na UPA (pré-condição 1).

---

### C04 — Farmácia: validação, alta vigilância, dispensação, estoque e conta sem valor

- **Objetivo:** cobrir a validação do farmacêutico, a liberação de medicamento de alta vigilância, a administração sem liberação com justificativa, a dispensação com baixa e devolução no estoque (livro de movimentos), a retirada sem farmacêutico com conferência depois, o lançamento de material e a conferência de que medicamento e material entram na conta **sem valor**.
- **Rede e unidades:** UPA Fase 5 24h, setor Pronto Socorro (o paciente fica no PS aguardando medicação, no cuidado da enfermeira escalada ali).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `faturamento.f5`, `gestor.upa.f5`.
- **Paciente fictício:** Dalva C4 Observação, 60 anos, sexo F, peso referido no atendimento. Queixa: dor lombar intensa.
- **Pré-condições:**
  1. Check-ins, inclusive do farmacêutico (ele depende de escala).
  2. Catálogo de medicamentos de teste carregado na homologação (`supabase/homolog/demo-medicamentos.sql` ou `scripts/e2e/02_catalogo_e2e.sql`): precisa existir **Dipirona sódica, solução injetável, ampola 2 mL** (sem alta vigilância) e **Enoxaparina sódica, solução injetável, seringa 0,4 mL** (alta vigilância pela regra ISMP "Antitrombóticos" em `private.regras_alta_vigilancia`). Conferir em `/alta-vigilancia` (`alta_vigilancia_da_unidade`) que a enoxaparina está marcada "exige".
  3. Unidade de consumo das duas definida (`/unidade-consumo`, `definir_unidade_consumo`), para a sugestão de dispensação contar embalagens.
  4. Códigos do BPA do C01 associados (para os itens com valor da porta aparecerem).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção, enfermeiro, plantonista | `/recepcao`, `/triagem`, `/atendimento` | Ficha, classificação (cor do enfermeiro), assunção, SOAP, **peso referido** | Conta A com classificação e consulta | `registrar_ficha`, `classificar_risco`, `iniciar_atendimento`, `registrar_soap` |
| 2 | plantonista | `/atendimento` (Prescrição) | Prescreve item 1: Dipirona sódica injetável, dose conforme a prescrição do cenário (fictícia), horário "Agora"; item 2: Enoxaparina sódica, dose conforme a prescrição do cenário (fictícia), com horário | Dois itens ativos; o item 2 leva o selo de alta vigilância | `prescrever(p_paciente, p_item)` ×2 → `prescricao_itens`; `medicamento.alta_vigilancia_regra = 'Antitrombóticos'`; `SeloAltaVigilancia.tsx`; borda: prescrever sem peso → recusado |
| 3 | farmacêutico | `/farmacia` (fila) | Lê a fila: 2 itens, o item 2 com `alta_vigilancia = true` ordenado antes | Fila correta | `fila_validacao(UPA)` |
| 4 | farmacêutico | idem | Valida o item 1 "confere" | Validação gravada | `validar_item(item1, true)` → `validacoes_prescricao.situacao = 'confere'` |
| 5 | enfermeiro | `/checagem` | Tenta checar o item 2 (ainda sem validação) como "feito" sem motivo | Recusado: "Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras)…" | `checar(item2, 'feito', horário)`; tela: selo "alta vigilância · liberação da farmácia" (`liberacao_farmacia([itens])`) |
| 6 | enfermeiro | idem | Checa o item 2 "feito" com justificativa ≥ 10 | Administração registrada **marcada** `sem_liberacao = true` | `administracoes.sem_liberacao = true`, `motivo`; aparece em `administracoes_sem_liberacao(UPA)` para o farmacêutico |
| 7 | farmacêutico | `/farmacia` (fila) → item 2 | Devolve para correção com motivo ≥ 10 | `devolvido`; quem prescreveu é avisado | `validar_item(item2, false, motivo)` → `validacoes_prescricao.situacao = 'devolvido'`; `private.avisar_item_devolvido` → `notificacoes_plantonista`; a administração do passo 6 sai de `administracoes_sem_liberacao` (há validação depois dela); borda: devolver com motivo < 10 → recusado |
| 8 | plantonista | `/atendimento` (Prescrição) | Altera o item 2 (horários) | **Item alterado é item novo** (item 2'); a validação antiga não vale | `alterar_item_prescricao`; `prescricao_itens` (novo id); `fila_validacao` mostra o item 2' sem validação |
| 9 | farmacêutico | `/farmacia` (fila) | Valida o item 2' "confere" = liberação da alta vigilância | Liberado | `validar_item(item2', true)`; `private.liberado_pela_farmacia(item2') = true` |
| 10 | enfermeiro | `/checagem` | Checa o item 2' "feito" no horário, sem motivo | Aceito; `sem_liberacao = false`; a tela mostra "Liberado pela farmácia: Farmacêutico F5" | `checar(item2', 'feito', horário)`; `liberacao_farmacia` → `situacao = 'confere'`, `por` |
| 11 | — | — | **Dupla checagem.** Lacuna (MAPA): nenhuma tela chama `conferir_alta_vigilancia`, `estado_dupla_checagem` ou `duplas_pendentes`; a liberação da farmácia a substituiu em 09/10/2026. O testador confere no lugar: `liberacao_farmacia` e o selo na checagem (passos 5, 6 e 10) | — | `duplas_checagens` fica vazia no cenário |
| 12 | farmacêutico | `/farmacia` (estoque) | Entrada de 10 ampolas de Dipirona com documento "NF-TESTE-0001" | Saldo 10; movimento `entrada` +10 | `registrar_entrada_estoque(UPA, dipirona, 10, 'NF-TESTE-0001')` → `estoque_medicamento.quantidade = 10`; `movimentos_estoque` (`tipo = 'entrada'`, `quantidade = 10`, `saldo_depois = 10`, `documento`); `log_auditoria.acao = 'entrada_estoque'`; borda: documento com 2 letras → recusado |
| 13 | farmacêutico | `/dispensacao` | Lê os itens a dispensar (sugestão para 24 h) e dispensa 2 ampolas do item 1 | Dispensação `prescricao`, saldo 8; movimento `saida_prescricao` −2 ligado à dispensação | `itens_para_dispensar(UPA)` (`sugestao`, `saldo_estoque`); `dispensar_item(item1, 2)` → `dispensacoes` (`tipo = 'prescricao'`, `quantidade = 2`, `sem_farmaceutico = false`, `sugestao`); `movimentos_estoque.dispensacao_id`; `log_auditoria.acao = 'dispensar'` |
| 14 | farmacêutico | idem | Recebe a devolução de 1 ampola com motivo | Saldo 9; movimento `devolucao` +1 | `devolver_dispensacao(p_dispensacao, 1, motivo ≥ 10)` → `dispensacao_devolucoes`; borda: devolver 3 → "Quantidade a devolver entre 1 e 2" |
| 15 | farmacêutico | `/farmacia` (estoque → extrato) | Extrato da Dipirona | 3 linhas: entrada (10 → 10), saída por prescrição (−2 → 8), devolução (+1 → 9), com paciente na saída | `extrato_estoque(UPA, dipirona)`; `farmacia_estoque(UPA)` saldo 9 |
| 16 | enfermeiro | `/dispensacao` ("farmácia fechada") | Retira 1 seringa do item 2' com justificativa ≥ 10 | Dispensação `sem_farmaceutico = true`; a enoxaparina sem entrada fica com **saldo −1** (não bloqueia); movimento com motivo "retirada sem farmacêutico" | `dispensar_item(item2', 1, justificativa)` → `estoque_negativo = true`; `dispensacoes_da_unidade(UPA)` → `a_conferir = 1`, `estoque_negativo` lista a enoxaparina; borda: enfermeiro sem justificativa → recusado |
| 17 | farmacêutico | `/dispensacao` | Confere a retirada sem farmacêutico | `conferida_em`, `conferida_por` | `conferir_dispensacao(p_dispensacao)`; borda: conferir de novo → "Já conferida." |
| 18 | enfermeiro | `/checagem` | Checa o item 1 "feito" | Administração feita | `checar(item1, 'feito', horário)` |
| 19 | faturamento (ou gestor) | `/faturamento/materiais` | Cadastra "Gaze estéril 7,5 cm", unidade de consumo "pacote", sem código SIGTAP | Material ativo | `material_salvar(UPA, NULL, nome, 'pacote', NULL, true)` → `materiais_unidade`; `log_auditoria.acao = 'material_criado'` |
| 20 | faturamento | `/faturamento/contas` (conta A) → "Lançar material" | Lança 3 pacotes, observação "curativo" | Material na conta, **sem valor** | `conta_lancar_material(p_conta, material, 3, 'curativo')` → `conta_materiais` (`quantidade numeric(10,2)`); `conta_eventos.evento = 'material_lancado'`; borda: retirar com motivo (`conta_retirar_material`) → `retirado_em`, evento `material_retirado` |
| 21 | faturamento | idem (detalhe) | Lê medicamentos e materiais da conta | Dipirona: `dispensado 2`, `devolvido 1`, `liquido 1`, `administrado 1`; Enoxaparina: `dispensado 1`, `liquido 1`, `administrado 2` (passos 6 e 10), `sem_farmaceutico = true`; **nenhum campo de valor**; gaze 3 pacote sem valor; `total_referencia` só com os procedimentos | `conta_detalhe.medicamentos`, `materiais`, `itens`, `total_referencia`; `private.conta_medicamentos` (janela: antes de `internado_em` vai à conta da porta) |
| 22 | faturamento | idem | Marca a enoxaparina "fora da conta" com motivo e depois traz de volta | `fora_da_conta` alterna; eventos `medicamento_fora` e `medicamento_volta` | `medicamento_fora_da_conta(p_conta, item2', true, motivo)` e `(…, false, motivo)` → `conta_medicamentos_fora` (`voltou_em`) |
| 23 | plantonista | `/atendimento` (Desfecho) | Alta após medicação | Episódio encerrado | `registrar_desfecho('alta_apos_medicacao')`; impeditivo: doses vencidas não checadas travam a alta |
| 24 | faturamento | `/faturamento/contas` | Em conferência → Fechar → Faturar | `medicamentos_congelados` e `materiais_congelados` gravados; avisos de medicamento e de material sem SIGTAP **não** bloqueiam | `contas.medicamentos_congelados`, `materiais_congelados`; `pendencias` (`grupo = 'medicamento'`/`'material'`, `bloqueante = false`); `conta_versoes_erp.dados.medicamentos` (quantidades, sem valor) |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `conta_itens` (`classificacao`) |
| Consulta médica na UPA | 0301060096 | 1 | R$ 20,00 | R$ 20,00 | `conta_itens` (`atendimento`) |
| Administração de medicamentos (enfermeira, 3 checagens "feito" no dia) | 0301100012 | **1** | R$ 5,00 | R$ 5,00 | `administracoes` agrupadas por paciente, profissional e dia → `conta_itens` (`medicacao`) |
| Dipirona sódica injetável — 2 dispensadas, 1 devolvida | — | líquido 1 | — (o sistema não tem valor) | — | `dispensacoes`, `dispensacao_devolucoes` → `conta_detalhe.medicamentos` (`dispensado`, `devolvido`, `liquido`, `administrado`) |
| Enoxaparina sódica — 1 retirada sem farmacêutico | — | líquido 1 | — | — | idem, `sem_farmaceutico = true` |
| Gaze estéril 7,5 cm | sem SIGTAP (opcional, grupo 07) | 3 pacote | — | — | `conta_materiais.quantidade` → `conta_detalhe.materiais` |
| Estoque (preço, lote, validade) | — | — | — | — | Lacuna (MAPA): `estoque_medicamento` e `movimentos_estoque` só têm quantidade |
| **Total da conta A** | | | | **R$ 35,00** | `conta_detalhe.total_referencia` (medicamentos e materiais não somam) |

**Planilha de conferência:** totais esperados

| Linha | Esperado | Valor na tela (anotar) | Onde confere |
|---|---|---|---|
| Saldo da Dipirona após os passos 12–14 | 9 | | `farmacia_estoque`, `extrato_estoque` (`saldo_depois` 10 → 8 → 9) |
| Saldo da Enoxaparina após o passo 16 | −1 | | `dispensacoes_da_unidade.estoque_negativo` |
| Movimentos da Dipirona | 3 (`entrada`, `saida_prescricao`, `devolucao`) | | `movimentos_estoque` |
| Dipirona na conta | dispensado 2 / devolvido 1 / líquido 1 / administrado 1 | | `conta_detalhe.medicamentos` |
| Enoxaparina na conta | dispensado 1 / líquido 1 / administrado 2 / sem_farmaceutico | | idem |
| Campo de valor em medicamentos e materiais | **não existe** (nem `valor`, nem `valor_total`) | | `conta_detalhe.medicamentos[]`, `materiais[]`; `conta_versoes_erp.dados.medicamentos[]` |
| `total_referencia` | 35,00 (3 itens de procedimento) | | `conta_detalhe.total_referencia` |
| Administrações sem liberação pendentes para o farmacêutico | 1 depois do passo 6; 0 depois do passo 7 | | `administracoes_sem_liberacao(UPA)` |

**Critérios de aceite:**
- Item de alta vigilância sem liberação só é administrado com justificativa ≥ 10 e fica marcado para o farmacêutico conferir; liberado, é checado sem motivo.
- Item alterado é item novo e perde a liberação.
- Toda mudança de saldo vira uma linha em `movimentos_estoque` (só inserção), com tipo, saldo depois, documento ou motivo e a dispensação ligada; o saldo pode ficar negativo e a farmácia é avisada.
- Dispensar pelo farmacêutico já valida o item; a enfermagem só dispensa com justificativa e a dispensação fica "a conferir".
- Medicamento e material aparecem na conta só como quantidade (dispensado, devolvido, líquido, administrado); nenhum campo de valor existe e `total_referencia` não muda com eles.
- Avisos de medicamento ("Dispensado e nunca administrado." / "Administrado sem nada dispensado pela farmácia.") e material sem SIGTAP não travam o fechamento.

**Bordas a provar:**
- Técnico de enfermagem não valida (`validar_item` → "A validação é do farmacêutico da unidade."). Lacuna (ambiente F5): não há técnico da UPA; provar com o enfermeiro, que também é recusado.
- Dispensação avulsa (`dispensar_avulso`) só pelo farmacêutico, com destino ≥ 3 e motivo ≥ 10; vira movimento `saida_avulsa`.
- Ajuste de inventário (`ajustar_estoque`) com saldo igual ao atual → "nada a ajustar"; com motivo < 10 → recusado.
- Farmacêutico não abre `/prontuarios` nem pede acesso (MAPA 1.2).
- Interação crítica ativa trava a prescrição sem justificativa (`interacoes_justificadas`): fora do cenário principal, provar com um par ativo da lista ONC.

**Lacunas tocadas:**
- Lacuna (MAPA): dupla checagem sem tela (passo 11).
- Lacuna (MAPA): lote, validade, preço e custo do medicamento; estoque de materiais e OPME.
- Lacuna (MAPA): valor de medicamento, material e exame na conta; CMED (`terminologia.medicamento_cmed`) não entra.
- Lacuna (ambiente F5): sem técnico de enfermagem na UPA.

---

### C05 — ERP: remuneração de plantões, versões da conta e reabertura pelo gestor

- **Objetivo:** mostrar o segundo valor em reais do sistema, o do plantão (`remuneracoes_plantao` → `plantoes_erp_previa` → `plantao_versoes_erp`), fechar e reabrir o mês dos plantões, e, nas contas, provar que faturar gera a versão para o ERP, que o gestor reabre a conta com motivo (a versão fica substituída) e que faturar de novo gera a versão seguinte com o total novo.
- **Rede e unidades:** UPA Fase 5 24h (todos os setores da escala).
- **Papéis e contas de teste:** `gestor.upa.f5` (gestor), `faturamento.f5` (faturamento); conta do C01 já faturada; RT como super admin para a chave da API (opcional).
- **Paciente fictício:** Antônio C1 (a conta A do C01).
- **Pré-condições:**
  1. C01 concluído até o passo 12 (conta A faturada, versão 1).
  2. Escala F5 publicada (ontem a depois de amanhã, três turnos, uma pessoa por setor) e `41_checkin_fase5.sql` rodado hoje: os plantões em curso têm `presenca_plantonista.checkin_em`.
  3. Perfis com CPF, conselho, registro e CBO preenchidos (vão na linha do plantão; sem eles, a linha sai com nulos, não é recusada).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | gestor | `/unidade?aba=configuracoes` (`Configuracao.tsx`, "Remuneração de plantão") | Cadastra três valores fictícios: Pronto Socorro + Manhã = 600; todos os setores + Noite = 1.200; todos os setores + todos os turnos = 500 | Três linhas ativas | `remuneracoes_plantao` (`setor_id`, `turno`, `valor`, `ativo`, `criado_por` = gestor); a tela só oferece Manhã, Tarde e Noite (CHECK `turno IN ('manha','tarde','noite')`) |
| 2 | gestor | `/faturamento/erp` (aba Plantões, competência M) | Lê a prévia do mês corrente | Uma linha por plantão da escala em M: `valor_referencia` pela precedência setor+turno → setor → turno → geral (PS manhã 600; qualquer setor à noite 1.200; PS tarde 500; **madrugada 500**, porque a tabela de remuneração não tem o turno `madrugada` e cai no genérico); `valor = valor_referencia` só em `situacao = 'realizado'` (check-in), 0 em `sem_presenca` e `falta_justificada`; `mes_encerrado = false`, botão "Fechar" desabilitado ("O mês só fecha depois de acabar") | `plantoes_erp_previa(UPA, M)` → `plantoes[]` (`valor_referencia`, `valor`, `situacao`, `minutos_presentes`, `checkout_automatico`, `profissional.cpf`), `totais` (`realizados`, `sem_presenca`, `sem_checkout`, `realizados_sem_valor`), `total`; `private.plantao_erp_valor` |
| 3 | faturamento | idem | Tenta abrir a prévia | Recusado | `plantoes_erp_previa` → "Acesso negado: os plantões para o ERP são do gestor da unidade." |
| 4 | gestor | idem | Tenta fechar M pela RPC | Recusado | `fechar_plantoes_erp(UPA, M)` → "O mês só fecha depois de acabar." |
| 5 | gestor | `/escala` → `/faturamento/erp` (competência M-1) | Fecha M-1. **Lacuna (ambiente F5):** a escala F5 vai de ontem a depois de amanhã; só há plantão em M-1 se o teste cair nos dias 1–2 do mês. Nos outros dias, o gestor adiciona um plantão em M-1 pela escala (`adicionar_plantao_escala`) antes de fechar; esse plantão fica `sem_presenca` e `valor = 0` (check-in em plantão passado não existe) | Versão 1 vigente de M-1 com `total` = Σ `valor` (0 se só houver `sem_presenca`; o valor do plantão de "ontem" se houve check-in em M-1) | `fechar_plantoes_erp(UPA, M-1)` → `plantao_versoes_erp` (`versao = 1`, `situacao = 'vigente'`, `dados`, `total`, `conciliacao = 'pendente'`); `log_auditoria.acao = 'plantoes_erp_fechados'`; borda: mês sem plantão → "Não há plantão na escala deste mês." |
| 6 | gestor | idem | Reabre M-1 com motivo ≥ 10 | Versão 1 `substituida`, `motivo_reabertura`, `substituida_por` = gestor | `reabrir_plantoes_erp(UPA, M-1, motivo)`; `log_auditoria.acao = 'plantoes_erp_reabertos'`; bordas: motivo < 10 → recusado; reabrir mês não fechado → "Os plantões deste mês não estão fechados." |
| 7 | gestor | idem | Fecha M-1 de novo | Versão 2 vigente; a 1 continua na lista como substituída | `plantao_versoes_erp` (2 linhas); `plantoes_erp_previa.versoes[]` |
| 8 | gestor | idem → "Baixar CSV / JSON" | Baixa os plantões de M-1 | Arquivo com as versões e o CPF dos profissionais; auditado | `erp_baixar(UPA, 'plantoes', 'csv', M-1)`; `log_auditoria.acao = 'erp_baixado'` (`conjunto`, `versoes`); borda: faturamento → "Acesso negado: os plantões para o ERP são do gestor da unidade."; mês não fechado → "Os plantões deste mês ainda não foram fechados." |
| 9 | faturamento | `/faturamento/erp` (contas) | Lê a lista das versões | Conta A do C01: versão 1 vigente, `total` (só `faturavel`), `total_referencia`, `itens[]` com `competencia` do fato, `medicamentos[]` sem valor, `glosas = []`, `conciliacao = 'pendente'`, `prontuario` como único dado do paciente | `erp_contas_da_unidade(UPA)` (13 meses); `private.erp_versao_json`; `conta_versoes_erp` |
| 10 | gestor | `/faturamento/contas` (conta A) | Reabre a conta faturada com motivo ≥ 10 | `status = 'aberta'`; `itens_congelados = NULL`; liberação desfeita (`liberada_em = NULL`); versão 1 do ERP `substituida`; o detalhe volta a calcular ao vivo | `mudar_etapa_conta(p_conta, 'aberta', motivo)`; gatilho `trg_erp_versao`; `conta_eventos` ganha `reaberta` e `erp_substituida`; `log_auditoria.acao = 'conta_reaberta'`, `'conta_erp_substituida'`; borda: faturamento → "Reabrir conta fechada é do gestor da unidade." |
| 11 | faturamento | idem | Retira o procedimento lançado (sutura) com motivo | Item some; total cai | `retirar_procedimento_conta(p_conta, 'registro', origem_id, motivo ≥ 10)`; `conta_eventos.evento = 'retirada'`; `conta_detalhe.total_referencia` = 65 − 30 (fictício) |
| 12 | faturamento (+ gestor se houver bloqueante) | idem | Em conferência → (liberação) → Fechar → Faturar | Versão 2 vigente com o total novo; versão 1 na lista como substituída | `conta_versoes_erp` (`versao = 2`, `total = 35` fictício); `conta_eventos.evento = 'erp_disponivel'` com "Versão 2" |
| 13 | ERP (RT com chave) | API `POST /financeiro/contas/{conta_id}/versoes/2/retorno` | Responde `lancada` com `valor_lancado` igual ao total | `conciliacao = 'conciliada'`, `erp_id`, `retorno_em`, `valor_lancado`. **Lacuna (ambiente F5):** a chave da API é criada pelo admin (`api_criar_chave` com recurso `financeiro`) e não há conta admin na F5; o RT, como super admin, cria a chave em `/integracoes` ou o passo fica só na conferência de `conciliacao = 'pendente'` | `public.api_v1_financeiro(…, 'retorno', {conta_id, versao: 2, acao: 'lancada', erp_id, valor_lancado})` pela Edge Function `supabase/functions/api/financeiro.ts`; `api_acessos.recurso = 'financeiro_retorno'`; bordas: `valor_lancado` diferente do total → `divergente`; `estornada` só em versão substituída (versão 1) |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Plantão PS, manhã, realizado (check-in) | — | 1 | R$ 600,00 (setor + turno) | R$ 600,00 | `remuneracoes_plantao` → `private.plantao_erp_valor` → `plantoes_erp_previa.plantoes[].valor_referencia` e `valor` |
| Plantão Observação Adulto, noite, realizado | — | 1 | R$ 1.200,00 (turno) | R$ 1.200,00 | idem |
| Plantão PS, tarde, realizado | — | 1 | R$ 500,00 (geral) | R$ 500,00 | idem |
| Plantão Internação, madrugada, realizado | — | 1 | R$ 500,00 (geral: `madrugada` não existe na tabela de remuneração) | R$ 500,00 | idem |
| Plantão de amanhã (sem presença ainda) | — | 1 | R$ 600,00 | **R$ 0,00** | `situacao = 'sem_presenca'`, `valor = 0` |
| Plantão fracionado 6 h num turno noite | — | 1 | R$ 1.200,00 × 360/720 | R$ 600,00 | `private.plantao_erp_valor(…, p_fracionado = true)` |
| Conta A, versão 1 | — | — | — | R$ 65,00 | `conta_versoes_erp.total` (C01) |
| Conta A, versão 2 (sem a sutura) | — | — | — | R$ 35,00 | `conta_versoes_erp.total` |

**Planilha de conferência:** totais esperados

| Linha | Esperado (fictício) | Valor na tela (anotar) | Onde confere |
|---|---|---|---|
| Prévia de M: `total` | Σ `valor` dos plantões `realizado` (o testador lista os plantões de hoje com check-in e multiplica pela tabela) | | `plantoes_erp_previa(UPA, M).total` = Σ `plantoes[].valor` |
| Prévia de M: `realizados` + `sem_presenca` + `faltas_justificadas` | = `plantoes` | | `totais` |
| Versão 1 de M-1 | `total` = Σ `valor`; 0 se só houver `sem_presenca` | | `plantao_versoes_erp.total` |
| Versão 2 de M-1 | igual à 1 se nada mudou na escala | | idem |
| Conta A: versão 1 / versão 2 | 65,00 / 35,00 | | `conta_versoes_erp.total`; `dados.total_referencia` |
| Conciliação depois do retorno | `conciliada` quando `valor_lancado = total`; `divergente` se diferente | | `conta_versoes_erp.conciliacao`, `valor_lancado` |

**Critérios de aceite:**
- O valor do plantão vem só de `remuneracoes_plantao` da unidade, com a precedência setor+turno → setor → turno → geral; plantão sem presença vale zero e aparece na lista.
- O mês dos plantões só fecha depois de acabar; reabrir exige motivo e deixa a versão vigente como substituída; fechar de novo gera a próxima.
- Faturar a conta gera a versão; reabrir a conta (só o gestor, motivo ≥ 10) substitui a versão vigente e apaga o congelado; faturar de novo gera a versão seguinte com o total novo.
- Os plantões (com CPF) só saem para o gestor, com segundo fator e de mês fechado; as contas saem para faturamento e gestor.
- O ERP busca; nada é empurrado (sem webhook de conta, glosa ou ERP).

**Bordas a provar:**
- Turno `madrugada` na escala não tem linha própria em `remuneracoes_plantao`: cai no genérico do setor ou da unidade; se não houver genérico, `valor_referencia` é nulo e o plantão conta em `realizados_sem_valor`.
- Plantão fracionado de 12 h em turno `manha` (grade 07–19): a proporção usa 360 min como base (`plantao_erp_valor` só usa 720 para `noite`); anotar o resultado para o RT decidir se é o esperado.
- Desativar uma linha de remuneração (`ativo = false`) muda a prévia na hora, mas não a versão já fechada.
- Reabrir conta `fechada` (não faturada) não gera evento `erp_substituida` (não havia versão).

**Lacunas tocadas:**
- Lacuna (MAPA): sem webhook de conta, glosa ou ERP; o retorno é por API.
- Lacuna (MAPA): centro de custo, rateio e custeio não existem; o plantão é o único custo fora da conta do paciente.
- Lacuna (ambiente F5): sem admin para criar a chave da API; escala só de ontem a depois de amanhã (fechar M-1 depende do dia do teste ou de plantão adicionado sem presença).

---

### C06 — Leitura dos números pela API e pelo arquivo do ERP

- **Objetivo:** provar que o que o ERP (ou um painel de BI) lê fora do app bate com o que as telas mostram: totais da conta, itens, glosas e plantões, com o mínimo de dado do paciente.
- **Rede e unidades:** UPA Fase 5 24h.
- **Papéis e contas de teste:** `faturamento.f5` (baixa CSV/JSON), `gestor.upa.f5` (plantões), RT como super admin (chave da API); "ERP" = o testador com `curl` ou o cliente HTTP do Power BI Desktop usando a chave.
- **Paciente fictício:** nenhum novo; usa as contas de C01 (versões 1 e 2), C02 (conta I com glosas) e C03 (conta A com APAC glosada).
- **Pré-condições:**
  1. C01, C02, C03 e C05 concluídos.
  2. **Modelo do Power BI:** as consultas estão no PR #479 (branch `depois/powerbi`, pasta `docs/api/powerbi/`), ainda sem merge em 06/11/2026, e leem `/unidades`, `/leitos`, `/atendimentos` e `/producao/*`, sem o financeiro (decisão B2). Para o financeiro, o testador lê por (a) o arquivo CSV/JSON de `/faturamento/erp` ou (b) a API `/financeiro/*` do `openapi.yaml` (chave com o recurso `financeiro`). Os arquivos de BPA fechados ficam em (c) `/rede` (`rede_faturamento`), que a F5 não cobre porque não tem conta de rede. Com o #479 mesclado, a produção SUS do modelo tem de bater com esta planilha.
  3. Chave da API: criada pelo RT (super admin) em `/integracoes` com `api_criar_chave(nome, ambiente, [UPA], ['financeiro'], …)`; a chave aparece uma vez. Lacuna (ambiente F5): sem admin na F5.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | faturamento | `/faturamento/erp` → "Baixar JSON" | Baixa as versões das contas | Arquivo com as versões dos últimos 13 meses: conta A (v1 substituída, v2 vigente), conta I (v1), conta A do C03 (v1); cada uma com `total`, `total_referencia`, `itens[]` (`valor_unitario`, `valor_total`, `faturavel`, `competencia`), `medicamentos[]` (sem valor), `glosas[]` (`valor`, `valor_recuperado`, `situacao`), `conciliacao` | `erp_baixar(UPA, 'contas', 'json')`; `log_auditoria.acao = 'erp_baixado'`; a baixa em CSV usa os mesmos campos (`csvContas` em `EnvioErp.tsx`) |
| 2 | faturamento | mesmo arquivo | Confere o dado do paciente | Só `prontuario`; nenhum nome, CPF, CNS ou CID na versão | `private.erp_conta_dados` (decisão 2a do RT, 27/10/2026) |
| 3 | ERP | `GET /financeiro/contas?unidade_id=<UPA>` com Bearer | Lista paginada, mais antigas primeiro por `alterada_em` | `dados[]` igual ao JSON do passo 1 para a mesma unidade; `Pagina` com cursor | `public.api_v1_financeiro(chave, ip, req, 'contas', {unidade_id, desde?, situacao?, conciliacao?, limite?, cursor?})`; `api_acessos` (`recurso = 'financeiro_contas'`, `status = 200`) |
| 4 | ERP | `GET /financeiro/contas?desde=<alterada_em da conta I>` | Busca só o que mudou | Vêm só as versões com `alterada_em` ≥ `desde`; a glosa registrada no C02 atualizou `alterada_em` da versão da conta I (`trg_erp_glosa`) | `conta_versoes_erp.alterada_em` |
| 5 | ERP | `GET /financeiro/contas/{conta_id}` (conta A do C01) | Todas as versões da conta | v1 `substituida` (total 65 fictício) e v2 `vigente` (35) | `api_v1_financeiro(…, 'conta', {conta_id})` |
| 6 | ERP | `GET /financeiro/plantoes?unidade_id=<UPA>&competencia=M-1` | Versões dos plantões | v1 substituída e v2 vigente de M-1, `total`, `plantoes[]` com `valor_referencia`, `valor`, `situacao`, profissional com CPF, conselho, registro e CBO | `api_v1_financeiro(…, 'plantoes', {unidade_id, competencia})`; `api_acessos.recurso = 'financeiro_plantoes'` |
| 7 | ERP | `POST /financeiro/plantoes/{versao_id}/retorno` | Responde `lancada` com `valor_lancado` = total da v2 | `conciliacao = 'conciliada'` | `api_v1_financeiro(…, 'plantoes_retorno', {versao_id, acao: 'lancada', erp_id, valor_lancado})`; `plantao_versoes_erp.retorno_em`, `retorno_chave`; `log_auditoria.acao = 'plantoes_erp_conciliada'` |
| 8 | ERP | mesma chave, sem o recurso `financeiro` (chave de outro recurso) | Tenta `/financeiro/contas` | 403 | `api_acessos.status = 403`; sem cabeçalho → 401; chave revogada (`api_revogar_chave`) → 401 |
| 9 | gestor | `/faturamento/erp` (aba Plantões) | Baixa o CSV de M-1 e compara com o passo 6 | Mesmos `total` e linhas; o CSV traz CPF (só o gestor baixa) | `erp_baixar(UPA, 'plantoes', 'csv', M-1)` |
| 10 | faturamento | `/faturamento/contas`, `/faturamento/glosas` | Compara tela × arquivo × API pela planilha abaixo | Tudo bate | `conta_detalhe.total_referencia`, `glosas_da_unidade.totais` |
| 11 | — | `/rede` | **Lacuna (ambiente F5):** não há conta `secretaria`, `regulacao_regional` nem `faturamento_rede`; `rede_faturamento` (arquivos de BPA fechados da rede) fica sem testador. No lugar, o faturamento confere `bpa_fechamentos_da_unidade(UPA)` em `/faturamento` (BPA) | — | `bpa_fechamentos` (`linhas`, `linhas_bpa_c`, `situacao`) |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Conta A (C01), v1 | — | 4 itens | — | R$ 65,00 | `conta_versoes_erp.total` |
| Conta A (C01), v2 | — | 3 itens | — | R$ 35,00 | idem |
| Conta I (C02), v1 | — | 2 itens | — | R$ 350,00 | idem |
| Glosas da conta I | — | 2 | — | glosado 350,00; recuperado 240,00; perdido 50,00 | `conta_versoes_erp` → `glosas[]` (`private.erp_glosas`); `glosas_da_unidade.totais` |
| Conta A (C03), v1 | — | 2 itens | — | R$ 30,00 (APAC fora) | `conta_versoes_erp.total` |
| Plantões M-1, v2 | — | n plantões | tabela de remuneração | Σ `valor` dos realizados | `plantao_versoes_erp.total` |

**Planilha de conferência:** totais esperados (uma linha por fonte; as três colunas de fonte têm de ser iguais)

| Objeto | Tela (`conta_detalhe` / `glosas_da_unidade` / `plantoes_erp_previa`) | Arquivo CSV/JSON (`erp_baixar`) | API (`/financeiro/*`) | Esperado (fictício) |
|---|---|---|---|---|
| Conta A (C01) v2 `total` | `total_referencia` | `total` | `dados[].total` | 35,00 |
| Conta A (C01) v2 Σ `itens[].valor_total` | Σ `itens[].valor_total` | Σ `itens[].valor_total` | idem | 35,00 (= `total_referencia`; `total` exclui `faturavel = false`) |
| Conta I (C02) `total` | 350,00 | 350,00 | 350,00 | 350,00 |
| Conta I glosa 1 `valor` / `valor_recuperado` | 300,00 / 240,00 | `glosas[0]` | `glosas[0]` | 300,00 / 240,00 |
| Conta I glosa 2 `situacao` | perdida | perdida | perdida | perdida |
| Conta A (C03) `total` | 30,00 | 30,00 | 30,00 | 30,00; nenhum item `apac` |
| Medicamentos da conta A (C04) | quantidades | `medicamentos[]` sem valor | idem | sem campo de valor |
| Plantões M-1 v2 `total` | `plantoes_erp_previa.versoes[1].total` | `total` | `dados[].total` | Σ `valor` dos realizados |
| Dado do paciente | nome na tela | só `prontuario` | só `prontuario` | sem nome, CPF, CNS, CID |

**Critérios de aceite:**
- Para cada conta, `total` e `total_referencia` da API e do arquivo são iguais aos da tela; a soma dos `itens[].valor_total` é `total_referencia` e a soma dos `faturavel = true` é `total`.
- As glosas da versão refletem o estado atual (não o do fechamento) e mudam `alterada_em`.
- A API só devolve o `prontuario` do paciente; nenhum dado clínico.
- Toda leitura fica em `api_acessos` (API) ou `log_auditoria` (`erp_baixado`); 401/403/429 conforme o contrato.
- Os plantões saem com CPF só para o gestor e pela chave com recurso `financeiro`.

**Bordas a provar:**
- `desde` com data futura devolve lista vazia; `limite` acima do máximo é cortado (ver `openapi.yaml`, parâmetros `Limite` e `Cursor`).
- Versão substituída continua na API (`situacao = 'substituida'`) para o ERP estornar; `estornada` só nela.
- Retorno `lancada` repetido na mesma versão: conferir o comportamento (o contrato diz que a conciliação é por versão).

**Lacunas tocadas:**
- O modelo do Power BI (PR #479) não cobre o financeiro (B2). Para a produção SUS, confere com esta planilha depois do merge.
- Lacuna (MAPA): sem webhook de conta, glosa ou ERP; sem SISAIH01; sem importação de retorno SIA/SIH.
- Lacuna (ambiente F5): sem admin (chave) nem papéis de rede (`/rede`).

---

## Resumo das lacunas tocadas

| Lacuna | Origem | Cenários | O que o testador confere no lugar |
|---|---|---|---|
| Valor de medicamento, material e exame na conta; CMED fora | MAPA | C01, C04, C05, C06 | Item presente com quantidades e sem campo de valor; `total_referencia` não muda |
| Lote, validade, preço e custo no estoque; estoque de materiais e OPME | MAPA | C04 | `movimentos_estoque` só com quantidade |
| Dupla checagem sem tela (RPC legada) | MAPA | C04 | `liberacao_farmacia` e selo na checagem |
| Valor gravado na AIH e na APAC; SISAIH01; retorno SIA/SIH | MAPA | C02, C03 | Valor só em `conta_itens` e `glosaveis_da_conta`; glosa à mão |
| Diária, permanência, centro de custo, honorário | MAPA | C02, C05 | Nada; o plantão é o único custo fora da conta |
| TISS/TUSS, tabela de convênio | MAPA | C01 | Pagador muda o rótulo; valor segue SIGTAP |
| Webhook de conta, glosa ou ERP | MAPA | C05, C06 | O ERP busca pela API |
| Power BI sem o financeiro (PR #479, decisão B2) | escopo do modelo | C06 | CSV/JSON de `/faturamento/erp` e API `/financeiro/*` |
| Regulador F5 só na Central (AIH/APAC exigem vínculo na unidade) | ambiente F5 | C02, C03 | Vínculo dado pelo RT; senão, fechamento só com liberação do gestor |
| Perfis F5 sem CNS/CBO; sem admin, técnico da UPA e papéis de rede | ambiente F5 | C01–C06 | Preparo pelo SQL Editor como `faturamento-teste.sql`; Caminho B; RT como super admin |
| Escala F5 só de ontem a depois de amanhã | ambiente F5 | C05 | Fechar M-1 com plantão adicionado (valor 0) ou no dia 1–2 do mês |
| Turno `madrugada` sem linha própria em `remuneracoes_plantao` | código (`CHECK turno IN manha/tarde/noite`) | C05 | Cai no genérico; anotar para o RT |
