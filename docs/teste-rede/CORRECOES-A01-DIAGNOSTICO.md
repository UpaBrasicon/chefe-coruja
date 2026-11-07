# Correções do cenário A01: diagnóstico

Os três achados abaixo vêm da execução do cenário A01 na homologação em 06/11/2026, na frente "Teste ponta a ponta da rede" (`EXECUCAO-A01.md`, rodadas 2 e 3). São três correções de produto: o **P1-1** (hospital sem porta não recebe o paciente regulado), o **P2-1** (ataque e manutenção do mesmo medicamento não convivem na prescrição da porta) e o **P2-2** (a regulação chega a "realizada" com o paciente ainda internado na origem). Na rodada 3, o P1-1 foi contornado pelo ambiente: o hospital de teste ganhou uma porta. O defeito de produto continua. Nada foi corrigido no produto até aqui. Os ids de decisão são próprios de cada achado: R para o P1-1, M para o P2-1 e S para o P2-2. As funções foram conferidas na homologação (`kswurfyxxvfydpjfrivy`), só com leitura, em 06/11/2026.

---

## P1-1 — Unidade sem porta não recebe o paciente regulado

### O que acontece hoje

- **Só a ficha da porta cria o paciente e o episódio.**
  - `public.registrar_ficha` recusa qualquer setor que não seja `emergencia` (fora da UBS): "A ficha abre numa porta (setor de emergência)." A trava está em `supabase/migrations/20261003000003_cadastro_paciente.sql:189`, reescrita por troca de texto em `20270211000002_atendimento_ubs.sql:127-128`. Na homologação é a linha 31 do corpo atual.
  - O cadastro do paciente é **por unidade** (`pacientes.unidade_id`). O paciente da UPA não existe no hospital até alguém abrir a ficha lá.
- **A internação só nasce do episódio da porta.**
  - `public.registrar_desfecho(…, 'internacao', {leito_id})` chama `private.internar_do_episodio` (`20260928000001_fase3_box_pendencias.sql:55`). Essa função grava `origem_admissao = 'emergencia'` e exige um episódio.
  - `public.abrir_internacao` (`20260926000001_fase0_endurecer_rpcs.sql:496`) é do ADT antigo e exige um paciente que já exista na unidade ("Paciente não pertence a esta unidade.", linha 520). A única chamada no código é `useCriarInternacao` (`src/hooks/useDocumentos.ts:106`), e nenhuma tela usa esse hook.
- **A chegada regulada não interna.**
  - `public.regulacao_marcar_chegada` (`20261117000002_nir.sql:362`) só muda o status para `realizada` (linha 380), estende a reserva do leito por 8 horas e grava o evento `chegou`. Não cria paciente, episódio nem internação no destino.
  - Na tela, o botão "Paciente chegou" (`src/components/regulacao/DestinoRegulacao.tsx:135`) só chama essa RPC.
  - Hoje marcam a chegada o plantonista e o gestor do destino (`private.regulacao_sou_destino`) e o NIR do destino. No destino de fora da rede, marca o regulador da central (linhas 373-375).
- **A reserva do leito não é do paciente.**
  - `public.regulacao_destino_aceitar` (`20261115000001_aceite_destino.sql:438`) grava a reserva com `paciente_id = NULL` (linha 460). Ela só é amarrada ao paciente pelo texto do motivo ("Regulação nº …").
  - Com isso, `public.leitos_para_ocupar` (`20261120000001_isolamento_trava_leito.sql:295`) oferece o leito reservado a **qualquer** paciente do destino. O gatilho `private.reserva_na_ocupacao` (`20261027000002_reserva_leito.sql:122`) só recusa outro paciente quando a reserva tem `paciente_id`.
  - A rodada 3 mostra isso: para a paciente da regulação nº 94, `leitos_para_ocupar` ofereceu também o **CM-01**, que estava reservado para a regulação nº 91 (`A01R.26.leitos`).
  - No aceite, o leito só é obrigatório quando o tipo é `leito` (linha 453). A transferência pode ser aceita sem leito.
- **Execução (rodada 2, passo 26):** como `medico.hospital.f5`, `registrar_ficha` no setor Clínica Médica foi recusado com `P0001: A ficha abre numa porta (setor de emergência).` A conferência `A01.26.sem_internacao` confirmou que não havia internação no hospital. Os passos 26, 27 e 28 (ficha, admissão, laudo e decisão da AIH) ficaram bloqueados.
- **Contorno da rodada 3 (só ambiente):** o hospital ganhou o setor "Porta do Hospital" (`scripts/e2e/48_rede_fase5_ajuste_a01.sql`). A paciente regulada passou por recepção, classificação e médico da porta, e só então foi internada no CM-02. A reserva passou a "ocupada". Funcionou, mas cobrou uma classificação e uma consulta de porta de uma paciente que já vinha regulada para um leito, e abriu uma conta de porta sem valor (P3-7).
- **Registrado no MAPA** (seção 2.3, linha "Transferência externa"): "A chegada regulada **não** cria a internação no destino".

### Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| R1 | O que "Paciente chegou" faz numa transferência ou num pedido de leito da rede | Numa única operação: acha ou cria o cadastro no destino, abre o episódio já em `internacao` e interna no leito, com `origem_admissao = 'outra_unidade'`. A regulação fica ligada ao episódio e à internação do destino. Não passa pela porta, e não abre a conta da porta vazia: abre só a conta da internação | A chegada continua só registrando. O destino precisa ter porta e abre a ficha à mão, como na rodada 3 |
| R2 | Cadastro do paciente no destino | Procura no destino pelo Cartão SUS ou pelo CPF. Achou, usa esse cadastro. Não achou, cria com a identificação da origem (nome, nome social, nascimento, sexo, nome da mãe, CNS, CPF) e com as **alergias registradas na origem**, marcadas como "informadas pela origem, regulação nº X". Se houver provável duplicata (mesmo nome e nascimento), para e pede a escolha, como já faz `registrar_ficha` | Quem marca a chegada digita o cadastro, sem nada vindo da origem |
| R3 | Leito na chegada | Vai para o leito reservado pela regulação. Sem reserva (transferência aceita sem leito) ou com a reserva vencida, quem marca a chegada escolhe um leito livre do setor pela mesma lista de `leitos_para_ocupar` | O leito passa a ser obrigatório já no aceite de toda transferência, e a chegada nunca escolhe |
| R4 | De quem é o leito reservado pela regulação | Só do paciente daquela regulação: some da lista dos outros pacientes até a chegada, a falta, o cancelamento ou o vencimento da reserva. O gatilho da ocupação recusa outro paciente | Como hoje: o leito reservado aparece para qualquer paciente da unidade |
| R5 | Quem confirma a chegada | Quem confirma hoje (plantonista, gestor e NIR do destino), mais o enfermeiro escalado no setor do leito, que é quem recebe o paciente no leito. Autor = login | Só quem confirma hoje |
| R6 | Unidade que **tem** porta | O mesmo caminho direto ao leito. A porta continua disponível: se o médico do destino quiser reavaliar antes, o paciente entra pela ficha normal | Unidade com porta segue pela porta. O caminho direto vale só para unidade sem porta |

**Unidade só com internação:** com a R1 em A, a chegada regulada vira a porta de entrada dela. Admissão direta sem regulação (internação eletiva) **não** entra nesta correção. Se o RT quiser, entra no backlog como item próprio.

### Plano com A em tudo

1. **Testes antes (banco, `supabase/tests/`, rodando na homologação numa transação desfeita):**
   - transferência aceita com leito: depois de "Paciente chegou" há cadastro, episódio em `internacao`, internação ativa no leito reservado, a reserva `ocupada` ligada à internação, a conta de internação aberta e nenhuma conta de porta;
   - paciente que já tem cadastro no destino (mesmo CNS): nenhum cadastro novo;
   - provável duplicata (mesmo nome e nascimento, sem documento): a chegada para e pede a escolha;
   - alergia registrada na origem aparece no destino e trava a prescrição no destino;
   - leito reservado para a regulação X não aparece em `leitos_para_ocupar` para outro paciente, e o gatilho recusa ocupá-lo;
   - sem reserva: a chegada exige escolher um leito livre;
   - quem pode: o enfermeiro do setor do leito confirma; a recepção e o técnico são recusados;
   - destino de fora da rede: nada muda (a central marca a chegada e não há internação na rede);
   - consulta e exame regulados: a chegada não interna.
2. **Banco (migration só aditiva):**
   - em `regulacao_solicitacoes`, colunas novas `destino_paciente_id`, `destino_episodio_id` e `destino_internacao_id`;
   - `private.cadastro_do_regulado(s)`: acha ou cria o cadastro no destino e traz as alergias;
   - `public.regulacao_marcar_chegada` ganha `p_leito uuid DEFAULT NULL`, com o mesmo nome. A chamada de hoje continua valendo. Para transferência e leito da rede, a chegada chama o cadastro e interna. A internação usa uma variante de `internar_do_episodio` com `origem_admissao = 'outra_unidade'`;
   - o gatilho da conta do episódio não abre a conta da porta para o episódio nascido da chegada regulada;
   - `regulacao_destino_aceitar` passa a gravar a reserva com marca da regulação (`reservas_leito.regulacao_id`, coluna nova). `leitos_para_ocupar` e `reserva_na_ocupacao` passam a respeitar essa marca;
   - rollback escrito no cabeçalho: devolver as funções às versões de hoje. As colunas novas podem ficar.
3. **Tela:**
   - em `DestinoRegulacao.tsx`, "Paciente chegou" mostra o leito reservado, ou a lista de leitos livres quando não há reserva. Mostra também a pergunta da duplicata, quando houver;
   - depois da chegada, o paciente aparece em "Pacientes internados" (`PacientesInternados.tsx`) com a pendência de admissão, para o médico escalado no setor;
   - o MAPA (seção 2.3) é atualizado.
4. **Homologação:** rodar de novo o passo 26 do A01 **sem** a porta do hospital, com a regulação nova:
   - chegada, internação no leito reservado, admissão, laudo e AIH;
   - conferência no Chrome como NIR, como enfermeira e como médico do hospital.

### Riscos

- **Cadastro duplicado ou trocado no destino:** a busca por CNS e CPF e a parada na provável duplicata são obrigatórias. O teste confere as duas.
- **Leito ocupado por outro antes da chegada:** a R4 fecha isso. Sem ela, o leito reservado continua aberto a qualquer paciente (achado da rodada 3).
- **Listas da porta que leem episódios da unidade:** o episódio novo nasce em `internacao`, fora do setor de emergência. É preciso conferir que a fila da porta, o painel de chamada e os indicadores de espera não o contam.
- **Paciente não identificado** (`regulacao_solicitacoes.paciente_nao_identificado`): sem CNS nem CPF, a busca da R2 não acha nada. O cadastro nasce novo, sem tentativa de juntar com outro, e a unificação fica para a tela de cadastros duplicados. Como a porta trata esse paciente não foi conferido neste diagnóstico. O teste cobre esse caso.
- **Ligação com o P2-2:** com a R1 em A, o destino interna mesmo que a origem ainda não tenha dado alta. Durante um tempo, o paciente fica com internação ativa nas duas unidades. A regra S1 trata disso.

---

## P2-1 — Ataque e manutenção do mesmo medicamento não convivem na porta

### O que acontece hoje

- **A trava é "um item ativo por medicamento e via", sem olhar a frequência.**
  - `public.prescrever` recusa o item quando já existe outro do mesmo `medicamento_id`, com a mesma via (`upper(via)`) e sem `suspenso_em`: "Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar."
  - Origem: `supabase/migrations/20261119000001_desfecho_encerra_cuidado.sql:640` (função a partir da linha 579). Na homologação são as linhas 60 a 63 do corpo atual.
  - Não há índice único nem gatilho com essa regra (conferido em `pg_indexes` e `pg_trigger` de `prescricao_itens`). Ela está só na RPC.
- **"Agora" é dose única, mas o item continua ativo.**
  - O F1 (`20270301000001_frequencia_prescricao_ps.sql:86-95`) aceita na porta "Agora", "Se necessário", "Contínuo" ou um intervalo.
  - O F5 (`20270301000001_frequencia_prescricao_ps.sql:232-238`, em `public.checar`) recusa o 2º "feito" de um item "Agora".
  - Depois da dose feita, porém, o item "Agora" não é suspenso nem concluído: continua com `suspenso_em` nulo. Por isso continua travando qualquer item novo do mesmo medicamento e da mesma via.
- **O contorno usado deixa um histórico enganoso.**
  - `public.alterar_item_prescricao` (`20261119000001:237`) suspende o item anterior com o motivo "Alterado: …" (linha 272) e grava a versão nova pela própria `prescrever`.
  - O ataque feito aparece então como **suspenso por alteração**, e a manutenção vira a "versão 2" do ataque. A farmácia trata o item novo como novo: ele volta sem liberação, como deve.
  - A pré-auditoria avisou "Administrado sem nada dispensado" para o item alterado (`EXECUCAO-A01.md`, Observações).
- **Na tela da porta:** os chips (`src/lib/frequenciaPorta.ts:10`) são Agora, Se necessário e os intervalos. "Contínuo" só entra pelo chip "Outra" com texto livre, que o servidor reconhece (linha 56).
- **Execução (rodada 2, passos 13 a 17):** com o ataque do sulfato de magnésio já prescrito ("Agora", EV), a manutenção ("Contínuo", EV) foi recusada com `P0001: Este medicamento já está prescrito por esta via…`. O contorno foi checar o ataque e depois alterar o item para manutenção (`alterar_item_prescricao`, passo 17).

Este diagnóstico trata só da estrutura do item. Nenhum valor de dose é proposto. As doses continuam vindo das fichas com fonte citada.

### Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| M1 | Como ataque e manutenção convivem | Dois itens. A trava de "mesmo medicamento e via" não conta o item "Agora": o ataque ("Agora") e a manutenção (contínuo ou com intervalo) ficam ativos juntos | Um item só, com dois tempos ("dose de ataque" e "manutenção") em campos novos, checados e dispensados separadamente |
| M2 | Dois "Agora" do mesmo medicamento e via | Recusado enquanto o primeiro não tiver a dose feita (evita o clique duplo). Depois da dose feita, um "Agora" novo é aceito | Sempre recusado: para repetir, suspende o anterior |
| M3 | Duas manutenções do mesmo medicamento e via (dois itens com intervalo, contínuo ou "Se necessário") | Continua recusado. A trava existe para evitar dose dobrada, e só o "Agora" fica de fora | Aceito com justificativa escrita (mínimo de 10 letras), como na interação crítica |
| M4 | Aviso na tela | Ao escolher um medicamento que já tem item ativo na mesma via, a tela mostra o item que já existe ("Já prescrito: sulfato de magnésio EV, Agora") antes de gravar. Não pede justificativa | Pede justificativa escrita sempre que houver dois itens do mesmo medicamento |
| M5 | Onde vale | Porta, observação e internação, porque é a mesma RPC. No leito, a frequência é texto livre, e vale só quando o texto é exatamente "Agora" | Só na porta |

### Plano com A em tudo

1. **Testes antes:**
   - banco (ampliando `supabase/tests/fase2_alteracao_item_prescricao.sql` ou num arquivo novo):
     - "Agora" + "Contínuo" do mesmo medicamento e via: os dois ficam ativos;
     - "Contínuo" + "8/8h" do mesmo medicamento e via: recusado;
     - dois "Agora" sem dose feita: recusado. Com a primeira feita: aceito;
     - a mesma regra na prescrição da observação;
     - alta vigilância: cada item pede a sua liberação da farmácia;
     - a checagem e a conta contam as administrações de cada item;
   - unidade: a função da tela que acha "já prescrito" no medicamento e na via.
2. **Banco (migration só aditiva):** troca de texto reaplicável em `public.prescrever`, no mesmo padrão do `20270301000001`. A condição do `EXISTS` passa a ignorar o item "Agora", tanto o que já existe quanto o novo, e entra a regra da M2. Rollback: a troca de volta, escrita no cabeçalho. Nenhuma tabela muda.
3. **Tela:** em `PrescricaoEstruturada.tsx`, o aviso da M4. Em `AbaPrescricao.tsx` não muda nada: os dois itens já aparecem lado a lado.
4. **Homologação:** rodar de novo o trecho do magnésio do A01 (passos 13 a 15) **sem** o contorno:
   - ataque e manutenção como dois itens;
   - liberação da farmácia de cada um;
   - checagem e conta.
   - Conferência no Chrome como médico da porta e como enfermeira.

### Riscos

- **Dose dobrada sem querer:** um "Agora" ao lado de uma manutenção do mesmo medicamento é intencional no ataque, mas pode ser engano em outro caso. O aviso da M4 e a M3 (duas manutenções continuam recusadas) limitam esse risco.
- **"Agora" no leito escrito de outro jeito** ("agora", "já", "imediato"): só "Agora" exato fica fora da trava. Os outros textos continuam travando. É o lado seguro.
- **Histórico antigo:** os itens alterados pelo contorno (como na rodada 2) ficam como estão. Nada é reescrito.

---

## P2-2 — A regulação chega a "realizada" com o paciente ainda internado na origem

### O que acontece hoje

- **Os status:** `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` (ou `falta`), mais `negada`, `devolvida`, `pendencia` e `cancelada` (MAPA 2.4).
- **A saída não olha a origem.** `public.regulacao_marcar_saida` (`supabase/migrations/20261117000002_nir.sql:338`) confere só quem marca (equipe médica, gestor ou NIR da origem) e o status `autorizada` ou `agendada` (linha 352).
- **A chegada também não olha a origem.**
  - `public.regulacao_marcar_chegada` (linha 362) aceita `autorizada`, `agendada` ou `em_transito` (linha 377) e grava `realizada` (linha 380).
  - A chegada pode até pular a saída.
- **Quem encerra a origem não sabe da regulação.**
  - São três caminhos:
    - na porta, `registrar_desfecho('transferencia')` (`20261119000003_cid_existente.sql:58`, destino na linha 97);
    - na observação, `finalizar_observacao('transferencia')` (`20261119000001:1298`), que chama `dar_alta`;
    - na internação, `dar_alta('transferencia_externa')` (`20261119000003:201`, destino na linha 242).
  - Os três pedem só o destino em **texto livre** (`p_detalhes.destino`). Nenhum deles procura a regulação, grava o número dela ou muda o status dela.
  - O caminho inverso também não existe: a regulação guarda `episodio_id` e `internacao_id` da origem, mas nenhuma regra os consulta.
- **O NIR** (`20261117000002_nir.sql:625`) cobra `reg_chegada` ("paciente a caminho sem registro de chegada"). Não existe cobrança de "chegou ao destino com a origem aberta".
- **O que lê `realizada`:**
  - o SLA, que a trata como status final (`20261113000001_sla_regulacao.sql:104`);
  - os indicadores, com o tempo até a chegada (`20261118000001_indicadores_regulacao.sql:84`);
  - a RNDS, que a manda como `attended` (`20270204000001_rnds_regulacao.sql:53`).
- **Execução:**
  - Rodada 2: com a observação da UPA aberta (o encerramento foi recusado pelo P1-2), o NIR marcou a saída e o hospital marcou a chegada. As regulações nº 91 e nº 94 ficaram `realizada`, com a paciente ainda no box OA-02 e o CM-02 ainda reservado.
  - Conferência só de leitura na homologação em 06/11/2026, depois da rodada 3:
    - a nº 94 tem a origem encerrada (`transferencia_externa`), porque a rodada 3 fechou a observação;
    - a nº 91 continua `realizada`, com o episódio da UPA em `observacao`, a internação `em_observacao` aberta e a reserva do CM-01 ainda `ativa`.

### Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| S1 | Quando a regulação vira `realizada` | Só com as duas coisas: a chegada registrada no destino **e** a origem encerrada por transferência (nenhum episódio aberto e nenhuma internação ativa do paciente na unidade de origem). A chegada nunca é recusada, porque o paciente já está lá. Se a origem ainda estiver aberta, a chegada fica gravada e o status espera | A chegada encerra a origem sozinha: alta automática por transferência, sem CID nem relato do médico da origem |
| S2 | Como fica o "chegou, mas a origem está aberta" | Sem status novo. A regulação segue `em_transito`, com a marca "chegou ao destino" (coluna nova `chegada_em`). Vira `realizada` quando a origem encerra, com `realizada_em` = hora da chegada, para não distorcer o indicador | Status novo no CHECK (`chegou_origem_aberta`). Isso mexe no SLA, nos indicadores, na RNDS e nas telas |
| S3 | A saída | `regulacao_marcar_saida` passa a exigir a origem encerrada por transferência: ninguém marca a saída de um paciente que segue internado. E a alta por transferência ligada à regulação marca a saída sozinha, se ainda não foi marcada (autor = login do médico) | Saída livre, como hoje |
| S4 | Ligação entre a alta por transferência e a regulação | Nos três caminhos (porta, observação e internação), se o paciente tem regulação de transferência autorizada ou em trânsito, a tela oferece essa regulação, o destino vem dela e a alta grava o número. O texto livre fica só para a transferência sem regulação | Texto livre como hoje. O servidor acha a regulação pelo paciente e pela unidade |
| S5 | Cobrança enquanto a origem está aberta | Item novo do NIR da origem ("chegou ao destino, origem sem alta por transferência"), com aviso ao médico assistente da origem. A central vê a marca no detalhe | Só a marca no detalhe, sem cobrança |
| S6 | Regulações já `realizada` com a origem aberta (como a nº 91 na homologação) | A migration não muda status antigo. Uma consulta de conferência lista esses casos para o NIR e o gestor resolverem pelo fluxo normal | A migration volta esses casos para `em_transito` |

**Outra opção levantada (C):** só avisar, sem trava nenhuma. Não é recomendada, porque deixa o mesmo paciente internado nas duas unidades sem nada que obrigue a fechar a origem.

**Destino de fora da rede:** a S1 vale igual. Quem marca a chegada é a central, e `realizada` também espera a origem encerrada.

### Plano com A em tudo

1. **Testes antes (banco, ampliando `supabase/tests/fase4_aceite_destino.sql` e `fase4_nir.sql`):**
   - chegada com a origem aberta: fica `em_transito` com `chegada_em`, e o item do NIR aparece;
   - depois, a alta por transferência na origem: vira `realizada`, com `realizada_em` = `chegada_em`;
   - origem encerrada antes da chegada: a chegada grava `realizada` direto;
   - saída com a origem aberta: recusada. A alta por transferência ligada à regulação marca a saída;
   - os três caminhos de alta (porta, observação e internação) gravam o número da regulação;
   - destino de fora da rede, com a central marcando: mesma regra;
   - `falta` e `cancelada`: sem mudança;
   - SLA, indicadores e RNDS: nada muda para quem já era `realizada`.
2. **Banco (migration só aditiva):**
   - colunas novas em `regulacao_solicitacoes`: `chegada_em` e `origem_encerrada_em`;
   - `private.regulacao_origem_encerrada(s)`;
   - `regulacao_marcar_chegada` e `regulacao_marcar_saida` com a regra nova, pelo mesmo nome e com os mesmos parâmetros;
   - um passo em `dar_alta` e em `registrar_desfecho`, por troca de texto reaplicável, que fecha a regulação ligada (marca a saída, grava `origem_encerrada_em` e, se já chegou, passa a `realizada`). `finalizar_observacao` passa por `dar_alta`;
   - o item novo em `private.nir_itens`;
   - rollback escrito: devolver as funções às versões de hoje. As colunas podem ficar.
3. **Tela:**
   - no detalhe da regulação (`DestinoRegulacao.tsx` e `HistoricoRegulacao.tsx`), a marca "chegou ao destino; origem sem alta";
   - na alta por transferência (`AbaDesfecho.tsx`, encerramento da observação e alta da internação), a escolha da regulação que preenche o destino;
   - no NIR (`Nir.tsx`), o item novo.
4. **Homologação:**
   - repetir a ordem da rodada 2 (saída e chegada antes do encerramento) e conferir que a nº nova fica `em_transito` até a observação encerrar;
   - depois, a ordem certa;
   - conferência no Chrome como NIR da origem, médico da observação e NIR do destino.

### Riscos

- **Origem que não consegue encerrar:** foi o que travou a rodada 2 (P1-2). Com a S1 em A, a regulação fica presa em `em_transito` até alguém dar a alta na origem. A correção do P2-3 (o médico da porta encerra a observação que abriu, branch `fix/porta-encerra-observacao`) reduz esse risco, e o item do NIR da S5 torna o caso visível.
- **Paciente internado nas duas unidades ao mesmo tempo:** com a R1 em A, isso passa a acontecer entre a chegada e a alta na origem. Fica visível pela S2 e cobrado pela S5. O que não pode acontecer é a origem esquecer o caso, e é isso que o teste confere.
- **Saída travada na hora da ambulância:** com a S3, o NIR só marca a saída depois da alta do médico. Na prática, a alta por transferência já marca a saída, e o NIR não precisa fazer nada.
- **Indicadores:** `realizada_em` = hora da chegada mantém o "tempo até a chegada" igual ao de hoje. O SLA não muda.
- **Dado antigo na produção:** antes de publicar, uma consulta só de leitura, feita pelo responsável, conta as regulações `realizada` com a origem aberta. Nada é corrigido por migration (S6).

---

## Relação entre os três e ordem sugerida

- O **P2-1** é independente e pequeno: só uma troca de texto em `prescrever` e um aviso na tela. Pode ir primeiro.
- O **P2-2** e o **P1-1** se tocam:
  - com a R1 em A, a chegada interna no destino;
  - com a S1 em A, a regulação só fecha quando a origem encerra.
  - A ordem sugerida é o P2-2 antes do P1-1. Assim, quando a chegada começar a internar, a regra da origem já está valendo.
- Cada correção vai em branch própria, com PR de base `master`. Toda migration passa antes pela homologação.
