# Cenários — Bloco D: bordas, acessos e segurança

Propósito: provar, na homologação e com as contas de teste da rede F5, que a escala, o segundo fator, o modo sem conexão, a virada de data e o acesso ao prontuário abrem e fecham a porta exatamente como o `MAPA.md` descreve — e registrar, cenário a cenário, o que o sistema não faz. Base: `docs/teste-rede/MAPA.md` (seções 1, 2.3, 2.6, 2.8, 2.9, 3.7, 5 e 6 e a lista "Lacunas"). Nada aqui foi executado contra banco; só homologação (`kswurfyx…`), nunca produção. Toda senha é "senha de teste guardada fora do repositório". Todo paciente é fictício. Nenhuma dose aparece neste bloco. A cor da classificação é sempre decisão do enfermeiro. O autor de cada registro é o login que o fez.

## Índice

| Id | Título | Papéis que cobre |
|---|---|---|
| D01 | Acesso pela escala: fora da janela, tolerância de 30 min e check-in atrasado | recepcao, enfermeiro, gestor, faturamento |
| D02 | Fim do plantão: 20 min, bloqueio e liberação pelo gestor | plantonista, gestor |
| D03 | Check-in fora do raio e sem localização | plantonista, gestor, telemedicina (lacuna) |
| D04 | Troca de plantão: colega aceita, gestor aprova, a porta segue a escala nova | plantonista (dois), gestor |
| D05 | Segundo fator: portão, expiração em 24 h, herança no desbloqueio e zerar | farmaceutico, gestor, nir |
| D06 | Evasão na porta e na observação: desfecho, indicador e conta | recepcao, enfermeiro, plantonista, faturamento, gestor |
| D07 | Óbito na UPA: sumário, notificação compulsória (SINAN) e regulação em curso | recepcao, enfermeiro, plantonista, regulador, nir, faturamento, gestor |
| D08 | Sem conexão: fila cifrada com chave do servidor, recarga, volta da rede e revisão tardia | enfermeiro, tecnico_enfermagem (lacuna na UPA), gestor, admin (lacuna) |
| D09 | Virada de data: meia-noite, fim de mês e fim de ano | enfermeiro, plantonista, faturamento, gestor |
| D10 | Pedido de prontuário encerrado: pedido, aprovação, 24 h, vencido, histórico por motivo, gestor direto e farmacêutico barrado | plantonista, tecnico_enfermagem, gestor, farmaceutico, telemedicina (lacuna) |
| D11 | Cadastro duplicado e unificação: o que aparece junto depois | recepcao, gestor, plantonista |
| D12 | Administrador: só agregados, sem paciente | admin (lacuna de conta), secretaria/rede (lacuna) |

Convenções: contas `*.f5@teste.local` da seção 5.1 do MAPA; unidades UBS Fase 5 (`f5100000-…-0001`), UPA Fase 5 24h (`f5100000-…-0002`), Hospital Fase 5 (`…-0003`), Central (`…-0009`). "SQL Editor" = SQL Editor da homologação, rodando como o papel em transação desfeita (`e2e.passo`, seção 5.2). "Tela" = link da Vercel da homologação no Chrome do RT. `[M]` = `supabase/migrations/`.

---

### D01 — Acesso pela escala: fora da janela, tolerância de 30 min e check-in atrasado
- **Objetivo:** provar que `private.plantoes_agora()` é a porta: sem plantão agora não entra; dentro da tolerância entra sem check-in; passada a tolerância sem check-in fecha; o check-in atrasado reabre na hora e fica na auditoria do gestor; gestor e faturamento não dependem de escala.
- **Rede e unidades:** UPA Fase 5 24h, setor Pronto Socorro.
- **Papéis e contas de teste:** `recepcao.upa.f5@teste.local` (recepcao), `enfermeiro.upa.f5@teste.local` (enfermeiro), `gestor.upa.f5@teste.local` (gestor), `faturamento.f5@teste.local` (faturamento). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Ana Teste Janela, nascida em 03/02/1985, sexo F, CNS fictício com dígito válido.
- **Pré-condições:** rede F5 criada (`40_rede_fase5.sql`); **não** rodar `41_checkin_fase5.sql` para as contas de recepção e enfermagem deste cenário; `configuracoes_unidade.checkin_tolerancia_min` da UPA no padrão (30) ou, para encurtar a espera, ajustada pelo gestor para 5 min em `/unidade` (`salvar_limites_unidade`, 0–120); escala F5 publicada com as contas nos três turnos (seção 5.1). O testador anota o início do turno em curso (07h, 13h ou 19h de Brasília).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | gestor | `/escala` (`EscalaMes.tsx`) | Abrir vaga no plantão da **recepção** do turno em curso (`marcar_vaga_escala`), deixando a conta de recepção sem plantão agora; manter a enfermagem escalada | A escala publicada mostra a vaga aberta no setor Pronto Socorro | `escala_plantao` sem linha da recepção para o turno; `escala_mes_gestor` |
| 2 | recepcao | `/recepcao` | Entrar com a conta e tentar abrir ficha de Ana Teste Janela | Casca bloqueia: "fora da escala"; a aba Nova ficha não abre | `situacao_checkin` e `meu_plantao_agora` sem plantão; `registrar_ficha` recusa no SQL Editor como recepção |
| 3 | enfermeiro | `/triagem` | Entrar nos primeiros 30 min do turno (ou 5, se o gestor reduziu) **sem** check-in; abrir a fila | Entra: a tolerância deixa passar sem check-in; `GateCheckIn.tsx` avisa que falta o check-in | `private.plantoes_agora()` lista o plantão; `presenca_plantonista` sem linha |
| 4 | gestor | `/escala` | Fechar a vaga da recepção escalando de novo `recepcao.upa.f5` (`adicionar_plantao_escala`) | Recepção volta a ter plantão agora | `escala_plantao` com a linha; a escala recusa sobreposição da mesma pessoa no mesmo horário |
| 5 | recepcao | `/recepcao` | Fazer check-in (`/plantao/check-in`) e abrir a ficha de Ana, setor Pronto Socorro, queixa "dor de cabeça há 2 dias" | Ficha aberta; conta ambulatorial criada sem itens | `episodios` novo; `contas` via `trg_conta_do_episodio`; autor = login da recepção |
| 6 | enfermeiro | `/triagem` | Esperar passar a tolerância sem check-in (31º min, ou 6º) e tentar chamar Ana (`chamar_paciente`) | Recusa: a porta fechou por falta de check-in; a casca pede o check-in | `plantoes_agora()` deixa de listar o plantão; `chamar_paciente` recusa |
| 7 | enfermeiro | `/plantao/check-in` (`FormularioCheckin.tsx`) | Fazer o check-in atrasado | Entra na hora, sem liberação do gestor; o atraso fica registrado | `presenca_plantonista.checkin_em` depois do início do turno; `presencas_do_dia_gestor` mostra atraso |
| 8 | enfermeiro | `/triagem` → `Classificar.tsx` | Chamar e classificar Ana: fluxograma de cefaleia do protocolo da unidade, sinais aferidos; **a cor é escolhida pelo enfermeiro** | Classificação gravada com a cor decidida pela enfermagem | `classificacoes_risco` (1ª do episódio); item "acolhimento com classificação" aparece em `conta_detalhe` |
| 9 | faturamento | `/faturamento/contas` | Entrar sem check-in e abrir a conta de Ana | Entra: faturamento não depende da escala; conta `aberta` com o item de classificação | `contas_da_unidade`, `conta_detalhe` |
| 10 | gestor | `/escala` → `PresencasDoDia.tsx` | Conferir presenças do dia | Recepção com check-in no horário; enfermagem com check-in atrasado marcado | `presencas_do_dia_gestor` |
| 11 | enfermeiro | `/plantao/check-in` | Tentar check-in para o turno **seguinte** antes de ele começar | Recusa: não há janela antes do início | Lacuna (MAPA): "Janela de check-in antes do início do plantão" não existe; o testador confere só a recusa e anota a mensagem |

**Critérios de aceite:**
- Passo 2 recusa e passo 5 aceita com a mesma conta, só mudando a escala.
- Passo 3 entra sem check-in; passo 6 recusa depois da tolerância; passo 7 reabre sem gestor.
- `presencas_do_dia_gestor` distingue check-in no horário e atrasado.
- Faturamento e gestor entram sem plantão.
- Nenhum passo registra em nome de outra pessoa (cada RPC roda com a conta do papel).

**Bordas a provar:**
- Tolerância reduzida a 0 pelo gestor: o acesso exige check-in desde o primeiro minuto.
- Tolerância 120: o limite superior é aceito; 121 é recusado por `salvar_limites_unidade`.
- Dois setores no mesmo turno (uma pessoa, dois plantões): um check-in só, dentro da janela, vale para os dois.
- Turnos seguidos (manhã e tarde): cada um pede o seu check-in.

**Lacunas tocadas:**
- Janela de check-in antes do início do plantão (passo 11).
- A rede F5 escala a mesma pessoa nos três turnos: "fora da janela" só se produz abrindo vaga na escala (passo 1), não por horário.

---

### D02 — Fim do plantão: 20 min, bloqueio e liberação pelo gestor
- **Objetivo:** provar os 20 min de tolerância depois do fim do plantão (com check-in), o fechamento mesmo em uso e a continuidade só por `liberar_pos_plantao` (5–120 min, até 12 h depois do fim, motivo ≥ 10).
- **Rede e unidades:** UPA Fase 5 24h, Pronto Socorro.
- **Papéis e contas de teste:** `medico.upa.f5@teste.local` (plantonista, CRM 950008), `gestor.upa.f5@teste.local` (gestor). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Carlos Teste Fim de Turno, nascido em 12/09/1970, sexo M.
- **Pré-condições:** o gestor abre vaga no plantão **seguinte** de `medico.upa.f5` (`marcar_vaga_escala`), para que o plantão em curso tenha fim de verdade (na F5 a conta está nos três turnos); check-in do médico feito (`41_checkin_fase5.sql` ou tela); ficha de Carlos aberta pela recepção e classificada pela enfermagem (cor decidida pelo enfermeiro); o testador agenda o passo 2 para os últimos minutos do turno (12h40 ou 18h40 de Brasília, por exemplo). Peso de Carlos aferido no atendimento (regra de prescrição do MAPA, seção 6), caso o testador prescreva.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | plantonista | `/atendimento` (`JanelaAtendimento.tsx`) | Assumir Carlos antes do fim do turno (`iniciar_atendimento`) e salvar um rascunho do SOAP | Atendimento em curso; item "consulta médica" nasce na conta | `episodios.atendimento_medico_id`; `salvar_rascunho_atendimento` |
| 2 | plantonista | `/atendimento` | Entre o fim do turno e o 20º minuto, gravar o SOAP (`registrar_soap` com CID existente) | Aceito: dentro da tolerância pós-plantão | `atendimento_registros` com autor = login; `private.tolerancia_fim_plantao()` = 20 min |
| 3 | plantonista | `/atendimento` | No 16º–19º minuto, conferir se a **casca** ainda mostra a janela aberta | Lacuna (MAPA): divergência documentada de 15 vs 20 min (`usePlantao.ts` × `regras.ts`); se a casca fechar antes do servidor, o testador registra e confere o passo 2 pelo SQL Editor como o médico | `usePlantao.ts` relê a cada 60 s; `situacao_checkin` |
| 4 | plantonista | `/atendimento` → `AbaDesfecho.tsx` | Depois do 20º minuto, tentar registrar o desfecho (alta) | Recusa: sessão fechada mesmo em uso; a casca manda falar com o gestor | `registrar_desfecho` recusa; `private.plantoes_agora()` vazio para o médico |
| 5 | gestor | `/escala` → `PresencasDoDia.tsx` | Liberar continuidade: `liberar_pos_plantao(p_unidade, p_perfil, 30, 'terminar desfecho de paciente em curso')` | Liberação gravada por 30 min | `liberacao_pos_plantao` (motivo ≥ 10, `expira_em` = concedido + 30 min); auditoria do gestor |
| 6 | plantonista | `/atendimento` | Registrar o desfecho `alta` com CID de alta e relato | Aceito dentro da liberação | `episodios.desfecho = 'alta'`, `encerrado_em` na data de Brasília; `private.liberacao_pos_plantao_ativa()` |
| 7 | plantonista | `/atendimento` | Depois de expirar a liberação (31º minuto), tentar qualquer escrita | Recusa de novo | `registrar_soap` recusa; nenhuma liberação ativa |
| 8 | gestor | `PresencasDoDia.tsx` | Tentar liberar com 4 min, com 121 min, e com motivo de 5 letras | As três recusadas (faixa 5–120; motivo ≥ 10) | `liberar_pos_plantao` recusa; nenhuma linha nova em `liberacao_pos_plantao` |
| 9 | gestor | `PresencasDoDia.tsx` | Tentar liberar mais de 12 h depois do fim do plantão (simular no SQL Editor com plantão de ontem) | Recusa: fora do prazo de 12 h | `liberar_pos_plantao` recusa |

**Critérios de aceite:**
- Passo 2 aceita; passo 4 recusa; passo 6 aceita; passo 7 recusa — na mesma conta, sem logout.
- A liberação tem motivo, autor (gestor), minutos e expiração gravados.
- As faixas 5–120 min e 12 h são respeitadas.

**Bordas a provar:**
- Check-out manual (`registrar_checkout`) antes do fim: fecha antes dos 20 min.
- Cron `checkout-automatico`: a presença recebe `checkout_em` sem o médico fazer nada.
- Duas liberações seguidas: a segunda vale pelo seu próprio prazo, não soma à primeira.

**Lacunas tocadas:**
- 15 vs 20 min entre casca e servidor (passo 3).
- O plantão só "acaba" na F5 se o gestor abrir vaga no turno seguinte.

---

### D03 — Check-in fora do raio e sem localização
- **Objetivo:** provar `registrar_checkin(p_unidade, p_lat, p_lng, p_observacao, p_justificativa)`: erro `CHECKIN_FORA_DO_RAIO` na 1ª tentativa fora do raio, justificativa ≥ 10 na 2ª (passa marcado "fora do raio" para o gestor), `CHECKIN_SEM_LOCALIZACAO` sem GPS e `CHECKIN_JUSTIFICATIVA_CURTA`; o bloqueio é só por falta de check-in, nunca pelo raio.
- **Rede e unidades:** UPA Fase 5 24h. **Lacuna (MAPA):** as unidades da F5 não têm latitude/longitude, então o raio não é conferido nelas; o cenário precisa de uma unidade de teste com coordenadas e `raio_metros` (padrão 500), fora da F5, definida pelo RT na homologação. Sem ela, só os passos 5 a 7 rodam, e o testador registra os passos 1 a 4 como "não exercitado: unidade sem coordenadas".
- **Papéis e contas de teste:** `medico.upa.f5@teste.local` (plantonista) ou a conta vinculada à unidade com coordenadas; `gestor.upa.f5@teste.local` (gestor). Telemedicina: não passa pelo raio, mas **não há conta de telemedicina na F5** (lacuna). Senha de teste guardada fora do repositório.
- **Paciente fictício:** nenhum (cenário de porta).
- **Pré-condições:** conta sem check-in no turno em curso; navegador do RT com permissão de localização; para "fora do raio", posição simulada no DevTools do Chrome a mais de 500 m da unidade.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | plantonista | `/plantao/check-in` (`FormularioCheckin.tsx`, `src/lib/geolocalizacao.ts`) | Check-in com posição simulada a 2 km da unidade | Recusa `CHECKIN_FORA_DO_RAIO: você está a N m da unidade; o raio é de 500 m` | Sem linha em `presenca_plantonista` |
| 2 | plantonista | `/plantao/check-in` | 2ª tentativa, mesma posição, justificativa de 5 letras | Recusa `CHECKIN_JUSTIFICATIVA_CURTA` | Idem |
| 3 | plantonista | `/plantao/check-in` | 2ª tentativa com justificativa "GPS do celular marcou a rua errada" (≥ 10) | Aceito, marcado "fora do raio" | `presenca_plantonista` com marca fora do raio e a justificativa; autor = login |
| 4 | gestor | `/escala` → `PresencasDoDia.tsx` | Ler as presenças | Check-in do médico aparece "fora do raio" com a justificativa | `presencas_do_dia_gestor` |
| 5 | plantonista | `/plantao/check-in` | Negar a localização no navegador e tentar o check-in sem justificativa | Recusa `CHECKIN_SEM_LOCALIZACAO` | Sem linha nova |
| 6 | plantonista | `/plantao/check-in` | Repetir com justificativa ≥ 10 ("navegador sem permissão de localização") | Aceito, marcado "sem localização" | `presenca_plantonista`; `[M]20270208000012_checkin_justificativa_curta.sql` |
| 7 | plantonista | `/atendimento` | Depois do check-in fora do raio, abrir a fila | Entra: o raio não bloqueia a porta, só o check-in ausente bloqueia | `private.plantoes_agora()` lista o plantão |

**Critérios de aceite:**
- Os três códigos de erro aparecem na tela com a mensagem do servidor.
- O check-in fora do raio e o sem localização só entram com justificativa ≥ 10 e ficam visíveis ao gestor.
- O acesso não depende do raio.

**Bordas a provar:**
- Posição exatamente no limite (500 m): dentro.
- `raio_metros` alterado pelo gestor: a mensagem mostra o raio novo.
- Unidade **sem** coordenadas (F5): o check-in com qualquer posição passa sem marca de raio.

**Lacunas tocadas:**
- Raio na rede F5 (unidades sem coordenadas).
- Conta de telemedicina na F5 (o check-in remoto sem raio não é exercitado).

---

### D04 — Troca de plantão: colega aceita, gestor aprova, a porta segue a escala nova
- **Objetivo:** provar o fluxo de troca decidido em 30/10/2026 (`[M]20270208000006_escala_aceite_colega.sql`, `…0005_escala_troca_gestor.sql`, `…0018_escala_aprovacao_propria.sql`): pedido → aceite do colega → aprovação do gestor → escala aplicada; a porta (`plantoes_agora`) passa a obedecer à escala trocada; recusa e cancelamento encerram; gestor que é parte do pedido precisa de 2º fator.
- **Rede e unidades:** UPA Fase 5 24h, setores Pronto Socorro e Internação.
- **Papéis e contas de teste:** `medico.upa.f5@teste.local` (plantonista A, PS), `medico.internacao.f5@teste.local` (plantonista B, Internação), `gestor.upa.f5@teste.local` (gestor). Senha de teste guardada fora do repositório.
- **Paciente fictício:** nenhum.
- **Pré-condições:** escala F5 publicada; `escala_passagem_exige_aprovacao` da UPA no padrão (exige); escolher dois plantões de **amanhã** (A na manhã do PS, B na manhã da Internação) para a troca não mexer no turno em curso.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | plantonista A | `/agenda?aba=vagas` (`PedidosEscala.tsx`) | `solicitar_troca(p_plantao_a, p_plantao_b, 'compromisso pessoal')` | Troca criada esperando o colega; B recebe aviso no sino | `trocas_plantao` pendente de aceite; `notificacoes_plantonista` de B |
| 2 | plantonista B | `PedidosParaVoce.tsx` | `aceitar_troca` | Troca aceita (`aceito_em`), vai ao gestor; gestor avisado | `trocas_plantao.aceito_em`; `pedidos_para_mim` vazio para B |
| 3 | gestor | `/escala` (aba Pedidos) | Tentar `aprovar_troca` **antes** do aceite (numa segunda troca criada só para isso) | Recusa: o gestor não aprova antes do aceite | `aprovar_troca` recusa |
| 4 | gestor | `/escala` (aba Pedidos) | `aprovar_troca` da troca aceita | Aplicada: amanhã A fica na Internação e B no PS; os dois avisados | `escala_plantao` trocada; histórico da escala; auditoria |
| 5 | plantonista A | `/minha-escala` | Ler a escala de amanhã | Mostra Internação | `meu_plantao_agora` (amanhã) / `escala_mes_gestor` |
| 6 | plantonista B | `PedidosParaVoce.tsx` | Em outra troca, `recusar_troca` com motivo | Encerra e avisa A | `trocas_plantao` recusada; `notificacoes_plantonista` de A |
| 7 | plantonista A | `PedidosEscala.tsx` | Em outra troca ainda sem decisão do gestor, `cancelar_troca` | Cancelada | `trocas_plantao` cancelada |
| 8 | plantonista B | SQL Editor como B | Tentar `UPDATE trocas_plantao` direto | Recusa: escrita só pelas RPCs | Policies de `[M]20270208000001` |
| 9 | gestor | `/escala` | Escalar o próprio gestor num plantão de amanhã e pedir uma troca entre ele e A; aprovar como gestor | Aprovação exige 2º fator e grava `aprovou_proprio_pedido` | Histórico da escala e auditoria com `aprovou_proprio_pedido`; sem 2º fator válido, recusa `SEGUNDO_FATOR*` |
| 10 | plantonista A (no dia trocado) | `/atendimento` | Na manhã de amanhã, fazer check-in e abrir a porta | Entra pela Internação, não pelo PS: `setores_na_escala_agora` segue a escala trocada | `setores_na_escala_agora`, `private.plantoes_agora()` |

**Critérios de aceite:**
- Nenhuma troca entra na escala sem aceite do colega **e** aprovação do gestor (na unidade que exige).
- Os avisos chegam no sino dos dois lados em cada etapa.
- A escala aplicada muda a porta de acesso no dia trocado.
- Aprovação do próprio pedido só com 2º fator e com registro próprio.

**Bordas a provar:**
- Unidade com `escala_passagem_exige_aprovacao = false`: o aceite do colega já aplica.
- Troca que gera sobreposição da mesma pessoa no mesmo horário: recusada pela escala.
- Passagem de plantão (`passar_plantao` → `aceitar_passagem`) segue o mesmo desenho; recusa (`recusar_passagem`) e cancelamento (`cancelar_pedido_escala`) encerram.

**Lacunas tocadas:**
- Nenhuma do MAPA; a troca não muda plantão em curso (os dois plantões escolhidos são de amanhã por decisão de teste).

---

### D05 — Segundo fator: portão, expiração em 24 h, herança no desbloqueio e zerar
- **Objetivo:** provar `public.portao_requisicao` (`[M]20261023000001`): toda RPC e todo Storage recusam sem 2º fator válido; validade 24 h contada da confirmação; dispositivo confiável 30 dias; o desbloqueio da tela (após 10 min parada) **herda** a confirmação da sessão anterior sem esticar o prazo (`herdar_segundo_fator`, `[M]20261022000011`); códigos de recuperação; `zerar_segundo_fator` pelo gestor com motivo.
- **Rede e unidades:** UPA Fase 5 24h.
- **Papéis e contas de teste:** `farmaceutico.f5@teste.local` (farmaceutico), `nir.f5@teste.local` (nir), `gestor.upa.f5@teste.local` (gestor). Senha de teste guardada fora do repositório; segundo fator guardado pelo RT fora do repositório.
- **Paciente fictício:** nenhum.
- **Pré-condições:** chave mestra `exigir_segundo_fator` ligada na `configuracao_plataforma` da homologação (desligada, nada barra); farmacêutico com TOTP cadastrado em Perfil; check-in do farmacêutico e do NIR feitos (`41_checkin_fase5.sql`), pois os dois dependem de escala.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | farmaceutico | login → `/farmacia` | Entrar com senha e **não** digitar o código | Portão do 2º fator na tela; a fila de validação não carrega | `fila_validacao` recusa `SEGUNDO_FATOR: confirme o código…` (`insufficient_privilege`); `segundo_fator_status` responde (está na lista liberada do portão) |
| 2 | farmaceutico | portão | Digitar o código TOTP | Entra; sessão marcada como verificada | `private.segundo_fator_sessao_ok.verificado_em = agora`; `private.segundo_fator_eventos` |
| 3 | farmaceutico | `/farmacia` | Deixar a tela parada 10 min; desbloquear com a senha | Sem pedir código: a sessão nova herda a confirmação | `herdar_segundo_fator(p_sessao_anterior)` = true; a linha nova em `segundo_fator_sessao_ok` tem o **mesmo** `verificado_em` da original (prazo não esticado) |
| 4 | farmaceutico | outro navegador / aba anônima | Entrar de novo com a senha | Pede código: login de verdade não herda | `herdar_segundo_fator` = false (sem sessão anterior no navegador) |
| 5 | farmaceutico | SQL Editor (transação desfeita, sessão simulada) | Simular `verificado_em = now() - 24 h - 1 min` e chamar `fila_validacao` | Recusa `SEGUNDO_FATOR*`; na tela, o erro reabre o portão (`App.tsx`) | `private.segundo_fator_valido()` falso; desfazer a transação |
| 6 | farmaceutico | `/farmacia` → Storage | Com 2º fator vencido, tentar baixar um arquivo de bucket autenticado (ex.: anexo de regulação) | Recusa pela policy restritiva `storage_segundo_fator` | `storage.objects` policy; o painel público da TV continua lendo por URL pública |
| 7 | farmaceutico | Perfil | Gerar os 10 códigos de recuperação | 10 códigos novos; os antigos apagados | `private.segundo_fator_recuperacao` (10 linhas, `usado_em` nulo); evento `codigos_gerados` |
| 8 | farmaceutico | portão | Usar um código de recuperação em vez do TOTP | Entra; restam 9 | `usar_codigo_recuperacao` devolve `codigos_restantes = 9`; evento `codigo_recuperacao_usado` |
| 9 | farmaceutico | portão | Errar o código de recuperação seguidas vezes | Bloqueio temporário com evento | `private.segundo_fator_recuperacao_falhas.bloqueado_ate`; evento `codigo_recuperacao_bloqueado` |
| 10 | gestor | `/unidade` (equipe) | `equipe_segundo_fator(p_unidade)` | Lista com códigos restantes e último "zerado" por pessoa | RPC devolve contagens; sem segredo |
| 11 | gestor | `/unidade` | `zerar_segundo_fator(p_usuario = farmacêutico, 'perdeu o celular com o autenticador')` | TOTP, dispositivos confiáveis, códigos e sessões do farmacêutico apagados; auditoria | `private.segundo_fator_eventos` evento `zerado` com autor = gestor e motivo; `registrar_auditoria('segundo_fator_zerado')` |
| 12 | farmaceutico | `/farmacia` | Próxima ação depois do zerar | Portão reabre e pede cadastro novo do TOTP | `segundo_fator_sessao_ok` sem a sessão; `SEGUNDO_FATOR*` |
| 13 | nir | `/nir` | Entrar, confirmar o 2º fator e abrir `nir_pendencias` | Entra; comprova que o portão vale para todo papel | `nir_pendencias` responde só depois da confirmação |

**Critérios de aceite:**
- Sem 2º fator, nenhuma RPC de escrita ou leitura via `/rpc/` responde, exceto as da lista do portão (`segundo_fator_status`, `verificar_codigo_2fa`, `verificar_dispositivo_2fa`, `herdar_segundo_fator`, `usar_codigo_recuperacao`, `horario_servidor`, `data_atual`, `registrar_erro_cliente`, convites).
- A herança no desbloqueio não pede código e não estica as 24 h.
- Zerar apaga tudo da pessoa, fica na auditoria com motivo e autor, e o gestor não zera a si mesmo sem 2º fator válido (`exigir_segundo_fator` dentro de `zerar_segundo_fator`).

**Bordas a provar:**
- `GET` em tabela sem 2º fator: o portão deixa passar e a RLS decide (leitura de tabela não é RPC).
- Dispositivo confiável marcado há 29 dias entra sem código; há 31 pede.
- `herdar_segundo_fator` com `p_sessao_anterior` de **outra** pessoa: false.
- Papel `anon` (painel de chamada `/painel/:token`): fora do portão.

**Lacunas tocadas:**
- Não há conta de admin na F5: o "zerar" pelo super admin fica sem exercício; só o gestor da unidade é testado.

---

### D06 — Evasão na porta e na observação: desfecho, indicador e conta
- **Objetivo:** provar os dois caminhos da evasão — porta (`registrar_desfecho('evasao', relato ≥ 15, detalhes com motivo e momento de `src/lib/evasao.ts`)`, único desfecho que dispensa registro de atendimento) e observação/leito (`dar_alta('alta_evasao')` com observação ≥ 15) —, o indicador `indicador_evasao`, a contrarreferência à UBS e o que a conta carrega em cada caso.
- **Rede e unidades:** UBS Fase 5 (origem do 1º paciente) e UPA Fase 5 24h (Pronto Socorro e Observação Adulto).
- **Papéis e contas de teste:** `enfermeiro.ubs.f5@teste.local` (enfermeiro da UBS), `recepcao.upa.f5@teste.local` (recepcao), `enfermeiro.upa.f5@teste.local` (enfermeiro), `medico.upa.f5@teste.local` (plantonista), `faturamento.f5@teste.local` (faturamento), `gestor.upa.f5@teste.local` (gestor). Senha de teste guardada fora do repositório.
- **Paciente fictício:** (a) Jonas Teste Evasão, nascido em 20/05/1990, sexo M, enviado pela UBS com queixa "dor abdominal há 1 dia"; (b) Lúcia Teste Observação, nascida em 08/11/1962, sexo F, queixa "tontura e vômitos".
- **Pré-condições:** check-ins feitos (`41_checkin_fase5.sql`); `bpa_procedimentos_unidade` da UPA com os códigos de uso `classificacao`, `atendimento_medico` e `medicacao` (seção 3.1); catálogo de medicamentos de teste carregado (`02_catalogo_e2e.sql`); peso de Lúcia aferido no atendimento antes de prescrever.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | enfermeiro (UBS) | `/escuta` → `EnviarUpa.tsx` | Escuta inicial de Jonas com cor **decidida pelo enfermeiro**; `encaminhar_upa(p_episodio, UPA F5, motivo)` | `encaminhamentos_upa` `enviado` | `encaminhamentos_upa_origem` |
| 2 | recepcao | `/recepcao` → `VindoDaUbs.tsx` | Abrir ficha de Jonas e marcar "Chegou" com a ficha escolhida | `chegou`; conta ambulatorial aberta sem itens | `encaminhamento_upa_marcar_chegada`; `contas` via `trg_conta_do_episodio` |
| 3 | enfermeiro | `/triagem` | Chamar e classificar Jonas (fluxograma de dor abdominal; sinais aferidos; cor do enfermeiro) | 1ª classificação gravada | `classificacoes_risco`; item de classificação em `conta_detalhe` |
| 4 | recepcao | `/recepcao/fila-medica` | Jonas não responde às chamadas do painel | Fila mostra as chamadas sem resposta | `ultimas_chamadas_porta` |
| 5 | plantonista | `/atendimento` → `AbaDesfecho.tsx` (`MotivoEvasao.tsx`) | Sem SOAP, registrar `registrar_desfecho('evasao', 'Paciente não respondeu a três chamadas do painel', {motivo: 'demora', momento: 'aguardando_medico'})` | Aceito sem registro de atendimento; episódio encerrado | `episodios.desfecho = 'evasao'`, `encerrado_em`; autor = login do médico |
| 6 | plantonista | `AbaDesfecho.tsx` | Repetir com relato de 10 letras | Recusa: relato ≥ 15 | `registrar_desfecho` recusa |
| 7 | enfermeiro (UBS) | `/encaminhados` (`Retornos.tsx`) | Ler a contrarreferência de Jonas | `a_ver` com desfecho evasão; marcar `visto` | `contrarreferencias_da_unidade`, `contrarreferencia_abrir` |
| 8 | recepcao | `/recepcao` | Abrir ficha de Lúcia | Conta aberta | `episodios`, `contas` |
| 9 | enfermeiro | `/triagem` | Classificar Lúcia (cor do enfermeiro) | Classificação gravada | `classificacoes_risco` |
| 10 | plantonista | `/atendimento` | Assumir, SOAP com CID, aferir peso, prescrever um item do catálogo de teste (sem dose neste documento: a dose é a da tela, de fonte citada) e dar desfecho `observacao` | Lúcia vai para um box da Observação Adulto; conta ganha "consulta médica" | `iniciar_atendimento`; `prescrever`; `private.box_livre`; `internacoes` em observação |
| 11 | enfermeiro | `/checagem` | Aprazar e checar a dose `feito` | Item "administração de medicamento" na conta | `administracoes.situacao = 'feito'`; `conta_detalhe` |
| 12 | plantonista | `/plantao/observacao` (`PacientesObservacao.tsx`) | Lúcia saiu do box sem avisar: `dar_alta(p_internacao, 'alta_evasao', CID, agora, …, observação ≥ 15)` | Evasão da observação registrada; conta liberada para fechar | `internacoes` encerrada; `episodios.desfecho`; `impeditivos_alta` sem pendência (doses vencidas feitas) |
| 13 | gestor | `/gestao` (`PainelGestor.tsx`) | Ler o indicador de evasão do dia | Duas evasões; filtro por momento (`aguardando_medico`, `observacao`) | `indicador_evasao`; `painel_organizacao.evasoes_periodo` (agregado) |
| 14 | faturamento | `/faturamento/contas` | Levar as duas contas a `em_conferencia` e `fechada` | Fecha: evasão é desfecho que libera o fechamento; itens congelados | `mudar_etapa_conta`; `contas.itens_congelados`; `contas_pendencias_resumo` |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Conta | Item | Onde nasce (tabela ou RPC do MAPA) | Valor fictício |
|---|---|---|---|
| Jonas (porta) | Acolhimento com classificação de risco | `classificacoes_risco` → `private.conta_itens`, `valor_sa` | R$ 6,00 |
| Jonas (porta) | Consulta médica | **não nasce**: o médico não assumiu (`episodios.atendimento_medico_id` nulo) | R$ 0,00 |
| Jonas (porta) | Total de referência | `conta_detalhe.total_referencia` | R$ 6,00 |
| Lúcia (porta) | Acolhimento com classificação de risco | `classificacoes_risco` → `valor_sa` | R$ 6,00 |
| Lúcia (porta) | Consulta médica | `episodios.atendimento_medico_id` (`iniciar_atendimento`) → `valor_sa` | R$ 11,00 |
| Lúcia (porta) | Administração de medicamento (1 por paciente/profissional/dia) | `administracoes.situacao='feito'` → `valor_sa` | R$ 2,00 |
| Lúcia (porta) | Medicamento dispensado | `dispensacoes` → `private.conta_medicamentos` — **sem valor** | — |
| Lúcia (porta) | Total de referência | `conta_detalhe.total_referencia` | R$ 19,00 |
| Lúcia (observação) | Conta de internação | **não nasce**: observação não grava `internacoes.internado_em` (só a internação abre `trg_conta_da_internacao`); o testador confere que existe uma conta só | — |

**Critérios de aceite:**
- Evasão na porta sem SOAP é aceita; relato < 15 é recusado; o motivo e o momento vêm da lista de `src/lib/evasao.ts`.
- Evasão da observação exige observação ≥ 15 e respeita os impeditivos de alta.
- `indicador_evasao` conta as duas; a contrarreferência chega à UBS.
- Os valores da conta batem com os itens que nasceram (classificação, consulta, medicação) e nenhum medicamento tem valor.

**Bordas a provar:**
- Evasão `antes_triagem` (sem classificação): a conta fecha sem itens.
- Evasão `durante_atendimento` com rascunho de SOAP: o rascunho é descartado (`descartar_rascunho`) e o desfecho entra.
- Evasão da observação com dose vencida não checada: `impeditivos_alta` barra até checar `nao_feito` com motivo ≥ 10.
- Alta desfeita (`cancelar_alta`) da evasão: cancela a contrarreferência (coorte F5 #9).

**Lacunas tocadas:**
- Valor de medicamento e de material na conta (não existe).
- Conta da observação separada (não existe: só a porta e a internação abrem conta).

---

### D07 — Óbito na UPA: sumário, notificação compulsória (SINAN) e regulação em curso
- **Objetivo:** provar `registrar_desfecho('obito')` na porta com `hora_obito`, `cid_obito`, `numero_do` (6 a 12 dígitos), `setor_obito` e relato ≥ 15; o sumário de óbito como documento clínico (`documentos_clinicos` tipo `sumario_obito`); a notificação compulsória com a ficha SINAN e seus obrigatórios; o fechamento da conta; e o que acontece com uma regulação de transferência em curso.
- **Rede e unidades:** UPA Fase 5 24h (Pronto Socorro) e Central de Regulação Fase 5.
- **Papéis e contas de teste:** `recepcao.upa.f5@teste.local` (recepcao), `enfermeiro.upa.f5@teste.local` (enfermeiro), `medico.upa.f5@teste.local` (plantonista), `regulador.f5@teste.local` (regulador, CRM 950012), `nir.f5@teste.local` (nir), `faturamento.f5@teste.local` (faturamento), `gestor.upa.f5@teste.local` (gestor). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Benedita Teste Óbito, nascida em 15/03/1951, sexo F, trazida com febre, rigidez de nuca e rebaixamento há 6 h.
- **Pré-condições:** check-ins feitos; UPA com CNES (`9995028`) para solicitar regulação; `lnnc_agravos` carregado; catálogo de exames do gestor com ao menos um exame; `bpa_procedimentos_unidade` com os usos `classificacao`, `atendimento_medico` e `medicacao`; peso aferido antes de qualquer prescrição.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepcao | `/recepcao` | Abrir ficha de Benedita, setor Pronto Socorro | Conta ambulatorial aberta | `episodios`, `contas` |
| 2 | enfermeiro | `/triagem` → `Classificar.tsx` | Classificar: fluxograma do protocolo da unidade compatível com rebaixamento; sinais aferidos; **cor decidida pelo enfermeiro** | Classificação gravada; item de classificação na conta | `classificacoes_risco`; `conta_detalhe` |
| 3 | plantonista | `/atendimento` | Assumir, SOAP com CID de meningite (existente), pedir exame (`pedir_exames` urgente), aferir peso e prescrever um item do catálogo (dose da tela, fonte citada; nenhuma aqui) | Atendimento em curso; exame pendente; item "consulta médica" na conta | `iniciar_atendimento`, `registrar_soap`, `pedir_exames`, `prescrever` |
| 4 | plantonista | `AbaExames.tsx` (`ExamesEAgravos.tsx`) | O CID bate com `lnnc_cids`: `marcar_agravo` (origem `cid`) | Agravo `suspeito` | `agravos_notificacao` |
| 5 | plantonista | `/regulacao` (NovaSolicitacao) | `regulacao_solicitar(tipo='transferencia', transporte, SIGTAP, CID, quadro ≥ 20 letras, prioridade proposta 'emergencia')` | `enviada` | `regulacao_solicitacoes`, `regulacao_eventos` |
| 6 | regulador | `/regulacao` (Fila) | `regulacao_assumir` | `em_analise`, no nome do regulador | `regulacao_fila`; `regulacao_eventos` |
| 7 | enfermeiro | `/checagem` | Checar a dose `feito` | Item "administração de medicamento" na conta | `administracoes` |
| 8 | enfermeiro | `/notificacao-compulsoria` → `FichaSinan.tsx` | `abrir_notificacao` do agravo; `salvar_ficha_notificacao` deixando o campo 7 vazio e tentar `registrar_notificacao` | Recusa listando "Campo 7: data dos primeiros sintomas." | `private.ficha_sinan_pendencias`; situação `a_registrar` |
| 9 | enfermeiro | `FichaSinan.tsx` | Preencher: campo 7 (data dos sintomas, não futura), 8 (nome), 9 ou 10 (nascimento ou idade), 11 (sexo F), 12 (gestante — obrigatório para sexo F; "não se aplica" pela idade); `registrar_notificacao(p_numero_sinan)` | `notificado`; notificador = login do enfermeiro | `agravos_notificacao` `notificado`; `notificacao_ficha`; `notificacao_compulsoria_periodo` |
| 10 | plantonista | `/atendimento` → `AbaDesfecho.tsx` | Tentar `registrar_desfecho('obito')` sem `numero_do` | Recusa "Informe o número da Declaração de Óbito." | `[M]20261119000003`, l. 99–103 |
| 11 | plantonista | `AbaDesfecho.tsx` | `registrar_desfecho('obito', relato ≥ 15, {hora_obito: agora − 10 min, cid_obito: o CID de meningite, numero_do: '123456789', setor_obito: 'Pronto Socorro'})` | Aceito; episódio encerrado; exame pendente cancelado "Óbito: exame cancelado sem resultado"; pareceres abertos cancelados; conta terminada | `episodios.desfecho='obito'`, `detalhes` com `cid_obito` normalizado e `numero_do` só dígitos; `exames` cancelados; `contas.status` pronto para conferência |
| 12 | plantonista | `/plantao/documentos` (`PlantaoToolRouter.tsx`) | Emitir o sumário de óbito | Documento `sumario_obito` ativo, autor = login | `documentos_clinicos.tipo = 'sumario_obito'`; `documentos_do_paciente` |
| 13 | plantonista | `AbaDesfecho.tsx` | Tentar `hora_obito` no futuro (+5 min) e `numero_do` de 4 dígitos (em outro episódio de teste) | As duas recusadas | `registrar_desfecho` recusa |
| 14 | regulador | `/regulacao` (Detalhe) | Depois do óbito, a solicitação continua `em_analise` | Lacuna (MAPA): nada cancela a regulação em curso quando o episódio encerra; o regulador decide `regulacao_negar(motivo='ja_atendido_obito')` ou a origem `regulacao_cancelar(motivo ≥ 10)`; o testador confere qual dos dois a equipe usa e o estado final | `regulacao_solicitacoes.status` `negada` ou `cancelada`; `regulacao_eventos` |
| 15 | nir | `/nir` | Antes do passo 14, ler `nir_pendencias` | A regulação da falecida ainda aparece (`reg_evolucao`/`reg_destino` conforme o prazo); depois do passo 14, some | `nir_pendencias`, `nir_cobrancas` |
| 16 | faturamento | `/faturamento/contas` | Levar a conta a `em_conferencia` e `fechada` | Fecha: óbito é desfecho que libera; itens congelados | `mudar_etapa_conta`; `contas.itens_congelados`; `contas_pendencias_resumo` |
| 17 | gestor | `/gestao` e `/notificacao-compulsoria` | Ler óbito do dia e a notificação | `obitos_periodo` agregado; notificação `notificado` com número do SINAN | `panorama_gestor`; `painel_organizacao.obitos_periodo` |

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Onde nasce (tabela ou RPC do MAPA) | Valor fictício |
|---|---|---|
| Acolhimento com classificação de risco | `classificacoes_risco` → `private.conta_itens`, `valor_sa` | R$ 6,00 |
| Consulta médica | `episodios.atendimento_medico_id` (`iniciar_atendimento`) → `valor_sa` | R$ 11,00 |
| Administração de medicamento | `administracoes.situacao='feito'` → `valor_sa` | R$ 2,00 |
| Exame cancelado pelo óbito | `exames` cancelado sem resultado — **sem valor** (exame não entra na conta) | — |
| Medicamento dispensado | `dispensacoes` — **sem valor** | — |
| Regulação, notificação, sumário de óbito | **nada** (seção 3.7) | — |
| Total de referência | `conta_detalhe.total_referencia` | R$ 19,00 |

**Critérios de aceite:**
- Óbito só entra com relato ≥ 15, hora não futura, CID existente, DO de 6 a 12 dígitos; `setor_obito` vem do setor da ficha se não informado.
- A ficha SINAN recusa sem os campos 7, 8, 9/10, 11 e 12 (sexo F) e lista cada falta com o número do campo; o notificador é o login.
- O óbito cancela exames sem resultado e pareceres abertos; o sumário de óbito é documento clínico com autor.
- A conta fecha pelo faturamento com os itens que nasceram.

**Bordas a provar:**
- Óbito com notificação ainda `a_registrar` (invertendo os passos 9 e 11): registrar se o desfecho é barrado como impeditivo ("aberta, impede a alta") ou aceito; anotar o comportamento.
- Óbito de internado: `dar_alta(p_internacao, 'obito', …, detalhes com numero_do ≥ 3)` encerra o que está aberto na internação (`private.encerrar_abertos_da_internacao`).
- Mesmo agravo aberto duas vezes no mesmo atendimento: `abrir_notificacao` devolve a existente.
- Sexo M: campo 12 não é cobrado.

**Lacunas tocadas:**
- Envio ao SINAN e mapeamento CID → agravo conferido pela vigilância (o número do SINAN é digitado; nada sai do sistema).
- Regulação em curso não é cancelada pelo óbito (passo 14).
- Exportação da AIH e valor de exame na conta (não existem).

---

### D08 — Sem conexão: fila cifrada com chave do servidor, recarga, volta da rede e revisão tardia
- **Objetivo:** provar `src/lib/offline/{fila,regras,relogio,sincronizar}.ts` e `[M]20270227000001_chave_fila.sql`: a chave da fila vem do servidor por `chave_fila()` só depois do 2º fator; só `observacao` e `documento` entram na fila; recarga sem rede mantém a fila e o que a enfermagem leu; limite de 2 h sem contato; `sincronizar_registros` idempotente; registro com mais de 24 h vai à revisão do gestor; contingência em papel após 15 min.
- **Rede e unidades:** UPA Fase 5 24h, Observação Adulto.
- **Papéis e contas de teste:** `enfermeiro.upa.f5@teste.local` (enfermeiro), `gestor.upa.f5@teste.local` (gestor), `medico.upa.f5@teste.local` (plantonista, para o paciente em observação). Técnico de enfermagem: **não há conta na UPA F5** (lacuna); admin para `trocar_chave_fila`: **não há conta na F5** (lacuna). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Lúcia Teste Observação (de D06, antes da evasão) ou novo: Pedro Teste Sem Rede, nascido em 27/07/1978, sexo M, em observação por desidratação.
- **Pré-condições:** paciente em box da Observação Adulto (porta → desfecho `observacao`, D06 passos 8–10); enfermeiro com check-in e 2º fator confirmado nesta sessão; Chrome do RT com DevTools para simular "Offline"; relógio do servidor lido (`horario_servidor`).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | enfermeiro | login → `/enfermagem/pronto-socorro` | Entrar, confirmar o 2º fator | A chave da fila é buscada após o 2º fator e fica só na memória da aba | `chave_fila()` responde (cria a linha na 1ª vez); `private.chave_fila` uma linha por perfil; sem 2º fator, `chave_fila()` recusa `SEGUNDO_FATOR*` |
| 2 | enfermeiro | `/enfermagem/pronto-socorro` (`painel_observacao`) | Abrir o paciente em observação com a rede ligada | Tela carrega sinais, prescrição e cuidados (o que a enfermagem leu fica guardado: `ligarConsultasSemConexao`) | `painel_observacao`, `cuidados_enfermagem` |
| 3 | enfermeiro | DevTools → Offline | Cortar a rede; registrar sinais vitais (`registrar_avaliacao`) e uma evolução de enfermagem (`registrar_evolucao`) | Aceitos na fila: tipos `observacao` e `documento`; a tela mostra "na fila" com a hora do aparelho corrigida pelo relógio do servidor (`relogio.ts`) | Fila IndexedDB cifrada (AES-GCM); nada em `observacoes`/`documentos_clinicos` ainda |
| 4 | enfermeiro | sem rede | Tentar checar uma dose (`checar`), prescrever ou dar desfecho | Recusa: exigem conexão | Lacuna (MAPA): "Modo sem conexão para prescrição, desfecho, alta e regulação"; o testador confere a mensagem |
| 5 | enfermeiro | sem rede | Recarregar a página (F5) | A fila continua; a tela mostra o que havia lido no passo 2; sem pedir login (a sessão já estava no navegador) | Fila com os 2 itens; `fila.ts` |
| 6 | enfermeiro | sem rede, outra aba | Tentar abrir a fila em outra aba sem a chave em memória | A fila é ilegível sem a chave do servidor (cópia só na aba de origem) | `chave_fila` não é gravada em disco; sem rede, `chave_fila()` não responde |
| 7 | enfermeiro | sem rede | Avançar o relógio de teste 2 h sem contato (ou esperar) e tentar registrar | Recusa: "Mais de 2 horas sem conexão: registre em papel até a conexão voltar." | `regras.ts` (limite 2 h) |
| 8 | enfermeiro | `/contingencia` (`Contingencia.tsx`) | Passados 15 min sem rede, abrir contingência em papel; ao voltar a rede, `registrar_contingencia(p_unidade, inicio, fim, motivo)` e `marcar_reentrada_contingencia(p_episodio, p_contingencia, descricao)` | Contingência gravada; episódio marcado como reentrada | `contingencias`, episódio com reentrada; autor = login |
| 9 | enfermeiro | DevTools → Online | Voltar a rede | `sincronizar_registros(p_itens)` envia os 2 itens; a tela marca "enviado" | `observacoes` e `documentos_clinicos` com autor = enfermeiro e `aferido_em`/`criado_em` = hora do fato (não da chegada); 2ª chamada com os mesmos itens não duplica (idempotente) |
| 10 | gestor | `/auditoria` → `RevisaoSemConexao.tsx` | Para um item com mais de 24 h entre o fato e a chegada (simulado no SQL Editor com `p_itens` datado de ontem − 1 h, transação desfeita), ler a revisão | Item parado na revisão, não no prontuário | `[M]20260926000014`: registro > 24 h não entra sozinho |
| 11 | gestor | `RevisaoSemConexao.tsx` | `decidir_revisao_sincronizacao(p_id, true, 'conferido com o papel da contingência')` e, em outro item, recusar com motivo | Aceito entra no prontuário marcado como tardio; recusado fica fora com motivo | `decidir_revisao_sincronizacao`; auditoria |
| 12 | enfermeiro | `/enfermagem/pronto-socorro` | Depois do fim do plantão + 20 min, tentar registrar sem rede | Recusa: "O plantão terminou há mais de 20 minutos: o registro sem conexão fechou." | `regras.ts` (tolerância do servidor) |
| 13 | admin | — | `trocar_chave_fila(p_perfil)` do enfermeiro (aparelho perdido) | Lacuna (MAPA): sem conta de admin na F5; no lugar, o testador confere no SQL Editor como super admin, em transação desfeita, que a RPC muda `private.chave_fila.chave` e grava `chave_fila_trocada` na auditoria; como gestor, recusa "só o administrador troca a chave" | `trocar_chave_fila`; `registrar_auditoria('chave_fila_trocada')` |

**Critérios de aceite:**
- A chave da fila só é entregue após o 2º fator e nunca é persistida em disco.
- Só `observacao` e `documento` entram na fila; o resto recusa com mensagem clara.
- Recarga sem rede preserva fila e leitura; a sincronização é idempotente e mantém autor e hora do fato.
- Registro com mais de 24 h vai ao gestor; aceitar e recusar ficam auditados.
- Limites de 2 h sem contato e 20 min pós-plantão fecham a fila.

**Bordas a provar:**
- Relógio do aparelho adiantado 1 h: a hora enviada é corrigida pelo `relogio.ts` (desvio contra `horario_servidor`).
- Rascunho cifrado da triagem (`src/lib/rascunhoTriagem.ts`) sobrevive 2 h à recarga sem rede e some depois.
- Dois enfermeiros no mesmo computador: a fila de um não é legível pelo outro (chave por pessoa).

**Lacunas tocadas:**
- Prescrição, desfecho, alta e regulação sem conexão (passo 4).
- Conta de técnico da UPA e de admin na F5 (passos de técnico e passo 13).
- Divergência 15 vs 20 min casca × servidor (passo 12).

---

### D09 — Virada de data: meia-noite, fim de mês e fim de ano
- **Objetivo:** provar que o turno é janela (início + duração), não rótulo com data (`[M]20260926000003`): o plantão da noite (19h–07h) atravessa a meia-noite sem perder acesso; o check-in de madrugada cai no dia anterior (`private.data_do_turno`, `[M]20270209000004`); desfecho, conta e avisos ficam na data de Brasília; a competência do BPA é o mês do fato; os prazos de 24 h (pedido de acesso, reavaliação, reserva) e as pendências de 6 h/12 h da observação cruzam a data.
- **Rede e unidades:** UPA Fase 5 24h (Pronto Socorro, Observação Adulto).
- **Papéis e contas de teste:** `enfermeiro.upa.f5@teste.local` (enfermeiro), `medico.upa.f5@teste.local` (plantonista), `faturamento.f5@teste.local` (faturamento), `gestor.upa.f5@teste.local` (gestor), `recepcao.upa.f5@teste.local` (recepcao). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Helena Teste Meia-Noite, nascida em 01/01/2000, sexo F, queixa "falta de ar há 3 h"; para fim de mês/ano, o mesmo roteiro com data real.
- **Pré-condições:** sessão marcada para a noite real (chegada às 23h40 de Brasília); escala F5 com turno `noite` (720 min, 19h–07h) para as contas; check-in da noite feito às 19h (ou atrasado, D01); para fim de mês e fim de ano, a sessão só vale se cair na data real — senão, rodar os testes de banco `supabase/tests` de competência e datas (VD9, VD10, VD12 em `docs/virada-de-data/`) e registrar "virada de mês/ano não exercitada na tela".

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepcao | `/recepcao` | 23h40: abrir a ficha de Helena | `chegada_em` em 23h40 de Brasília (dia D); conta aberta | `episodios.chegada_em`; `contas` |
| 2 | enfermeiro | `/triagem` | 23h50: classificar (fluxograma de dispneia; sinais aferidos; **cor do enfermeiro**) | 1ª classificação no dia D | `classificacoes_risco.criado_em` |
| 3 | plantonista | `/atendimento` | 00h05 (dia D+1): assumir e gravar SOAP com CID; sem logout | Entra: o plantão da noite segue na janela; `turno_atual` = noite; `meu_plantao_agora` o mesmo plantão | `private.plantoes_agora()`; `usePlantao.ts` não derruba a sessão |
| 4 | plantonista | `/atendimento` → `AbaReavaliacao.tsx` | 00h10: `aguardar_reavaliacao(p_episodio, 00h40)` | Aceito (até 24 h à frente) | `episodios` com `reavaliar_em` em D+1 |
| 5 | plantonista | `AbaDesfecho.tsx` | 00h30: desfecho `observacao` | Box ocupado em D+1; pendência de 6 h de permanência vence 06h30 de D+1; reavaliação até 12 h | `internacoes`; `painel_observacao` |
| 6 | enfermeiro | `/plantao/check-in` | 00h45: check-in de um colega sem escala de madrugada (simular no SQL Editor com conta sem plantão, transação desfeita) | Presença gravada com data do turno = dia D (antes das 7h, ontem) | `private.data_do_turno(now())` = D; `presenca_plantonista.data` = D |
| 7 | gestor | `/escala` → `PresencasDoDia.tsx` | 01h00: ler presenças | A noite de D aparece com o check-in das 19h, não duplicada em D+1 | `presencas_do_dia_gestor` |
| 8 | plantonista | `/plantao/observacao` | 06h50: `finalizar_observacao` com alta, CID e relato | Desfecho em D+1 06h50 de Brasília | `episodios.encerrado_em` em D+1; contrarreferência (se houver origem) datada D+1 |
| 9 | plantonista | `/atendimento` | 07h10 (turno novo começou às 07h; conta escalada também na manhã) | Continua entrando pelo plantão da manhã (check-in da manhã dentro da tolerância) | `turno_atual` = manhã; novo check-in exigido até 07h30 |
| 10 | faturamento | `/faturamento` (`Bpa.tsx`) | Com D = último dia do mês: `bpa_conferencia` dos dois meses | Classificação (23h50 de D) na competência do mês de D; consulta (00h05 de D+1) na do mês seguinte; horário de Brasília, não UTC | `private.bpa_linhas`; `bpa_fechamentos.sigtap_competencia` |
| 11 | faturamento | `Bpa.tsx` | Tentar `fechar_competencia_bpa` do mês de D+1 enquanto ele ainda corre | Recusa: competência futura | `fechar_competencia_bpa` |
| 12 | gestor | `/auditoria` | Pedido de prontuário aprovado às 23h55 de D (D10) | `valido_ate` = 23h55 de D+1: cruza a data sem encurtar | `pedidos_acesso_prontuario.valido_ate` |
| 13 | gestor | `/gestao` | 00h05 de 1º de janeiro: avisos e indicadores do "dia" | Avisos na data de Brasília (`[M]20270209000006`); `panorama_gestor` do dia novo vazio até a 1ª chegada | `notificacoes_plantonista`; `indicador_espera_triagem` |
| 14 | faturamento | `/apac` e `/faturamento/erp` | Fim de ano: validade da APAC (VD7) e fechamento de plantões do mês (`fechar_plantoes_erp`) | APAC com validade que cruza o ano não vence por rótulo; plantões da noite de 31/12 contam no mês de dezembro (data do turno) | `apacs.validade`; `plantao_versoes_erp` |

**Critérios de aceite:**
- Nenhum passo entre 23h40 e 07h10 derruba a sessão nem pede liberação.
- `data_do_turno` coloca o check-in da madrugada no dia anterior; nada duplica em `presenca_plantonista`.
- Desfecho, conta e BPA usam a data e a competência de Brasília do fato.
- Prazos de 24 h, 6 h e 12 h cruzam a meia-noite sem reiniciar.

**Bordas a provar:**
- Grade de 6 h (01h–07h): o turno `madrugada` começa em D+1 e o check-in dele é em D+1.
- Horário de verão: não existe desde 2019; o testador confirma que `America/Sao_Paulo` não aplica deslocamento.
- Ano bissexto (29/02): data de nascimento 29/02 no cadastro e idade na chegada (VD2) sem erro.
- Pediatria: criança que faz 14 anos à meia-noite muda de grupo de fluxograma e de ferramentas na chegada seguinte (VD1/VD2), nunca no episódio aberto.

**Lacunas tocadas:**
- Fim de mês e fim de ano só se exercitam na tela na data real; fora dela, só pelos testes de banco de `docs/virada-de-data/`.
- Grade quinzenal (VD6) é pendência do RT, fora deste bloco.

---

### D10 — Pedido de prontuário encerrado: pedido, aprovação, 24 h, vencido, histórico por motivo, gestor direto e farmacêutico barrado
- **Objetivo:** provar a seção 2.8: `pedir_acesso_prontuario` (motivo ≥ 10, um pendente por pessoa e paciente), `decidir_pedido_acesso` (aprovado = `valido_ate = now() + 24 h`; recusado com motivo ≥ 5; ninguém decide o próprio), leitura só por 24 h (`private.acesso_encerrado_vigente`), histórico encerrado inline para quem cuida agora (`historico_encerrado` resumo; `abrir_historico_encerrado` detalhe com motivo ≥ 10 por 12 h), gestor lê direto sem pedir, farmacêutico não lê nem pede, gestor não pede.
- **Rede e unidades:** UPA Fase 5 24h e UBS Fase 5.
- **Papéis e contas de teste:** `medico.internacao.f5@teste.local` (plantonista que **não** cuida do paciente), `medico.upa.f5@teste.local` (plantonista que cuida agora), `tecnico.ubs.f5@teste.local` (tecnico_enfermagem, na UBS), `gestor.upa.f5@teste.local` e `gestor.ubs.f5@teste.local` (gestor), `farmaceutico.f5@teste.local` (farmaceutico). Telemedicina pede também, mas **não há conta na F5** (lacuna). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Rosa Teste Arquivo, nascida em 30/06/1958, sexo F, com dois episódios encerrados na UPA (alta em datas anteriores) e um na UBS; no passo 9 ela volta à porta da UPA com queixa "dor no peito há 1 h".
- **Pré-condições:** episódios encerrados criados antes (podem ser os de D06/D07 ou um roteiro curto de ficha → classificação → alta); check-ins feitos; 2º fator confirmado em cada conta.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | plantonista (internação) | `/prontuarios` (`PedidosProntuario.tsx`) | `buscar_paciente_para_pedido('Rosa')`; `pedir_acesso_prontuario(p_paciente, 'revisar internação anterior para parecer')` | Pedido `pendente` | `pedidos_acesso_prontuario` (`status='pendente'`, `valido_ate` nulo); `meus_pedidos_acesso` |
| 2 | plantonista (internação) | `/prontuarios` | Repetir o pedido para Rosa | Recusa: já existe um pendente para a mesma pessoa e paciente | índice parcial único em `(solicitante_id, paciente_id) WHERE status='pendente'` |
| 3 | plantonista (internação) | `/prontuarios/:pacienteId` (`ProntuarioLeitura.tsx`) | Tentar abrir antes da decisão | Recusa: sem acesso vigente | `abrir_prontuario` recusa; `private.acesso_encerrado_vigente` falso |
| 4 | plantonista (internação) | `/prontuarios` | Motivo de 8 letras em outro paciente | Recusa: motivo ≥ 10 | `pedir_acesso_prontuario` recusa |
| 5 | gestor (UPA) | `/auditoria` | `pedidos_acesso_da_unidade`; `decidir_pedido_acesso(p_pedido, true)` | `aprovado`, `valido_ate = now() + 24 h`, `decidido_por` = gestor | `pedidos_acesso_prontuario`; `log_acesso_prontuario`/auditoria |
| 6 | plantonista (internação) | `/prontuarios/:pacienteId` | Abrir e ler o prontuário encerrado | Só leitura: documentos, evoluções e prescrições dos episódios encerrados; nenhuma ação de escrita | `abrir_prontuario`; `log_acesso_prontuario` com quem/quando; `acessos_prontuario_da_unidade` no `/auditoria` |
| 7 | plantonista (internação) | SQL Editor como o médico (transação desfeita) | Simular `valido_ate = now() − 1 min` e chamar `abrir_prontuario` | Recusa: vencido; `meus_pedidos_acesso.vigente = false` | `private.acesso_encerrado_vigente`; desfazer a transação |
| 8 | tecnico_enfermagem (UBS) | `/prontuarios` na UBS | Pedir acesso ao episódio da UBS de Rosa com motivo ≥ 10; gestor da UBS **recusa** com motivo "sem vínculo com o cuidado" (≥ 5) | `recusado` com `motivo_decisao` | `decidir_pedido_acesso(…, false, motivo)`; técnico vê a recusa em `meus_pedidos_acesso` |
| 9 | gestor (UPA) | `/auditoria` | Tentar decidir um pedido feito por si mesmo (simular no SQL Editor) e tentar `pedir_acesso_prontuario` como gestor | As duas recusadas: ninguém decide o próprio; gestor não pede (teste `15_gestor_transversais.sql`) | RPCs recusam |
| 10 | gestor (UPA) | `/prontuarios/:pacienteId` | Abrir o prontuário de Rosa **sem** pedido | Lê direto (policy `documentos_select`) | `log_acesso_prontuario` registra o gestor |
| 11 | farmaceutico | `/prontuarios` e `/prontuarios/:pacienteId` | Tentar as rotas e a RPC | Rota não existe no menu nem em `RequireRole`; `pedir_acesso_prontuario` e `abrir_prontuario` recusam | `[M]20270105000001`; RPCs recusam |
| 12 | recepcao | `/recepcao` | Rosa volta: abrir ficha na UPA (Pronto Socorro) | Episódio aberto | `episodios` |
| 13 | plantonista (UPA) | `/atendimento` → `HistoricoEncerrado.tsx` | Assumir Rosa; ler `historico_encerrado(p_paciente)` | Resumo dos encerrados **nesta unidade** sem pedido: data, setor, cor, CID, desfecho, médico; sem texto clínico; o episódio da UBS não aparece | `private.cuida_do_paciente_agora` verdadeiro; `historico_encerrado` |
| 14 | plantonista (UPA) | `HistoricoEncerrado.tsx` | `abrir_historico_encerrado(p_paciente, 'comparar ECG com o episódio anterior')` | Detalhe aberto, só leitura, por 12 h | `private.acessos_historico` (quem, quando, motivo); `acessos_prontuario_da_unidade` mostra o motivo |
| 15 | plantonista (UPA) | `HistoricoEncerrado.tsx` | Motivo de 6 letras | Recusa: ≥ 10 | `abrir_historico_encerrado` recusa |
| 16 | plantonista (internação) | `/atendimento` | Tentar `historico_encerrado` de Rosa sem cuidar dela agora | Recusa: só quem cuida; o caminho é o pedido ao gestor | `cuida_do_paciente_agora` falso |
| 17 | plantonista (internação) | `/prontuarios` | `cancelar_pedido_acesso` de um pendente seu | `cancelado` | `pedidos_acesso_prontuario.status='cancelado'` |

**Critérios de aceite:**
- Pedido exige motivo ≥ 10; um pendente por pessoa/paciente; só o solicitante cancela o pendente.
- Aprovação dá 24 h só leitura a partir da decisão; vencido recusa; recusa exige motivo ≥ 5; ninguém decide o próprio pedido; o gestor não pede.
- Quem cuida agora vê o resumo sem pedido e o detalhe com motivo por 12 h; quem não cuida, não.
- Gestor lê direto; farmacêutico não lê nem pede; tudo fica em `log_acesso_prontuario`/`acessos_historico`.

**Bordas a provar:**
- Paciente unificado (D11): o pedido aprovado vale para a família toda (`private.familia_paciente`).
- Vínculo do solicitante desativado depois da aprovação: `acesso_encerrado_vigente` passa a falso (`papel_na_unidade <> ''`).
- Pedido aprovado às 23h55 cruza a meia-noite (D09, passo 12).
- `meus_pedidos_acesso` lista só os 30 últimos dias além dos pendentes.

**Lacunas tocadas:**
- Prazo para o gestor decidir e expiração do pedido pendente (não existem: um pendente fica pendente até alguém agir).
- Conta de telemedicina na F5 (quem pede por teleinterconsulta não é exercitado).

---

### D11 — Cadastro duplicado e unificação: o que aparece junto depois
- **Objetivo:** provar `[M]20261030000004_unificar_pacientes.sql` e `…0005`: candidatos por nome + nascimento, nome da mãe + nascimento, CPF ou CNS (sem acento/maiúscula); recepção ou gestor pede com motivo; gestor aprova ou recusa (ninguém aprova o próprio); recusa com atendimento aberto nos dois ou com alergia ativa só no absorvido; vincular sem mover registros (absorvido inativo apontando `unificado_em`); CPF/CNS passam ao principal; histórico, pedido de acesso e leitura enxergam a família; desfazer devolve.
- **Rede e unidades:** UPA Fase 5 24h.
- **Papéis e contas de teste:** `recepcao.upa.f5@teste.local` (recepcao), `gestor.upa.f5@teste.local` (gestor), `medico.upa.f5@teste.local` (plantonista), `enfermeiro.upa.f5@teste.local` (enfermeiro). Senha de teste guardada fora do repositório.
- **Paciente fictício:** Maria Teste Duplicada, nascida em 10/10/1980, sexo F, mãe "Joana Teste"; cadastro A com CNS fictício válido e um episódio encerrado (alta) e uma alergia registrada; cadastro B sem CNS, mesmo nome e nascimento, com um episódio encerrado.
- **Pré-condições:** os dois cadastros criados pela recepção em dias/sessões diferentes (ficha → classificação pelo enfermeiro com cor dele → alta pelo médico), ambos encerrados; a alergia gravada no cadastro **B** (absorvido) para o passo 4.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepcao | `/cadastros-duplicados` (`CadastrosDuplicados.tsx`) | `candidatos_duplicados(p_unidade)` | Par A/B listado por nome + nascimento | RPC devolve o par |
| 2 | recepcao | `/cadastros-duplicados` | `pedir_unificacao(p_principal = A, p_absorvido = B, 'mesma pessoa, cadastro repetido na porta')` | Pedido pendente | `pedidos_unificacao`; `pedidos_unificacao_da_unidade` |
| 3 | recepcao | `/cadastros-duplicados` | Tentar `decidir_unificacao` do próprio pedido | Recusa: só o gestor (ou super admin); ninguém aprova o próprio | RPC recusa |
| 4 | gestor | `/cadastros-duplicados` | `decidir_unificacao(p_pedido, true)` com a alergia ativa só em B | Recusa: "registre a alergia no principal e unifique" | RPC recusa; nada em `pacientes.unificado_em` |
| 5 | plantonista | `/atendimento` (ou caderno) | Registrar a mesma alergia no cadastro A | Alergia ativa em A | tabela de alergias do paciente A; autor = login |
| 6 | recepcao | `/recepcao` | Abrir ficha nova em B **e** em A (atendimento aberto nos dois) e gestor tentar aprovar | Recusa: atendimento aberto nos dois cadastros | RPC recusa |
| 7 | plantonista | `/atendimento` | Encerrar as duas fichas (evasão com relato ≥ 15 ou alta com CID) | Nenhum atendimento aberto | `episodios.encerrado_em` |
| 8 | gestor | `/cadastros-duplicados` | `decidir_unificacao(p_pedido, true)` | Aprovado: B inativo, `B.unificado_em = A`; CNS de B passa a A se A não tinha (aqui A já tem: nada muda) | `pacientes` (B inativo, `unificado_em`); `private.familia_paciente(A)` = {A, B}; auditoria |
| 9 | recepcao | `/recepcao` | `buscar_pacientes('Maria Teste Duplicada')` | Só A aparece; B não é oferecido para ficha nova | `buscar_pacientes` |
| 10 | recepcao | `/recepcao` | Abrir ficha de Maria (A), queixa "dor lombar há 2 dias"; enfermeiro classifica (cor dele); médico assume | Episódio em A | `episodios` |
| 11 | plantonista | `/atendimento` → `HistoricoEncerrado.tsx` | `historico_encerrado(A)` | Resumo traz os episódios de **A e B** juntos, cada um com seu cadastro de origem (`cadastros_do_paciente`) | `historico_encerrado` considera a família; `cadastros_do_paciente(A)` lista os dois |
| 12 | plantonista | `AbaPrescricao.tsx` | Prescrever um item do catálogo de teste que bata com a alergia | A trava de alergia lê o cadastro A (onde ela foi gravada no passo 5) e barra sem justificativa | `prescrever` recusa/avisa; é por isso que o passo 4 exigiu copiar a alergia |
| 13 | plantonista (internação) | `/prontuarios` | Pedir acesso a **B** e ser aprovado pelo gestor | O acesso vale para A e B (`acesso_encerrado_vigente` lê a família) | `abrir_prontuario(A)` e `(B)` aceitos no prazo |
| 14 | gestor | `/cadastros-duplicados` | `desfazer_unificacao(p_pedido, 'cadastros de pessoas diferentes, erro da recepção')` | B volta a ativo; CPF/CNS que tinham passado voltam; o histórico volta a separar | `pacientes.unificado_em` nulo; auditoria com motivo |
| 15 | recepcao | `/cadastros-duplicados` | `cancelar_unificacao` de um pedido pendente seu | Cancelado | `pedidos_unificacao` |
| 16 | gestor | `/cadastros-duplicados` | Pedir unificação **como gestor** e tentar aprovar o próprio | Pedir é permitido; aprovar o próprio, não | RPC recusa a aprovação |

**Critérios de aceite:**
- Nenhum registro clínico muda de paciente; a unificação é vínculo e é reversível com motivo.
- As duas recusas de segurança (atendimento aberto nos dois; alergia só no absorvido) acontecem antes de qualquer vínculo.
- Depois da unificação, busca, histórico, acesso por pedido e leitura enxergam a família; o absorvido não aparece para ficha nova.
- Pedido e decisão têm autor distinto; tudo fica na auditoria.

**Bordas a provar:**
- Candidato por nome da mãe + nascimento com nomes grafados com e sem acento.
- Candidato por CPF igual com nomes diferentes (erro de digitação do nome).
- Dois absorvidos no mesmo principal: `familia_paciente` com três ids.
- Unificar e, no mesmo dia, registrar notificação compulsória no principal: a ficha SINAN sai com os dados do principal.

**Lacunas tocadas:**
- Nenhuma do MAPA; o cenário fica dentro do que as RPCs de unificação fazem.

---

### D12 — Administrador: só agregados, sem paciente
- **Objetivo:** provar que o `admin` da organização vê `painel_organizacao(p_dias)` com contagens suprimidas de 1 a 4 e sem identidade de paciente (`[M]20261001000002_fase6_painel_auditoria_agregados.sql`), cria e edita unidades, chaves da API e webhooks, mas não abre porta, atendimento nem prontuário; e que os papéis de rede (`/rede`) leem só mapa de vagas, indicadores, SLA e arquivos fechados.
- **Rede e unidades:** organização "Rede E2E Fase 5".
- **Papéis e contas de teste:** **Lacuna (MAPA):** não há conta de admin nem de secretaria/regulação regional/faturamento da rede na F5. No lugar, o testador usa uma conta de homologação com papel `admin` numa organização de teste fora da F5 (por exemplo a vinculada pelo `vincular-usuario-teste.sql` na "UPA Homologação"), e roda os passos de leitura no SQL Editor como esse papel em transação desfeita. `gestor.upa.f5@teste.local` serve de contraste. Senha de teste guardada fora do repositório.
- **Paciente fictício:** os de D06 e D07 (já encerrados) para haver contagens.
- **Pré-condições:** ao menos 5 chegadas no período (senão tudo sai suprimido, o que também é resultado válido); uma unidade pequena (≤ 4 leitos) para provar a supressão.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | admin | `/painel` (`OrganizacaoGrupo.tsx`) | `painel_organizacao(30)` | Uma linha por unidade: leitos, ocupados, taxa, porta agora, internados, chegadas, encerrados, óbitos, evasões, profissionais em expediente, censo; **sem nome de paciente** | RPC; colunas de contagem passam por `private.suprimir` |
| 2 | admin | `/painel` | Unidade com 3 leitos ou 2 óbitos no período | Contagem sai nula (suprimida de 1 a 4); taxa só quando os dois termos passam | `private.suprimir`; `taxa_ocupacao` nula |
| 3 | admin | `/painel` | `profissionais_em_expediente` | Sai sem supressão (é profissional, não paciente) | coluna `expediente` |
| 4 | admin | `/atendimento`, `/triagem`, `/recepcao`, `/prontuarios/:id` | Tentar as rotas | `RequireRole` não abre; `abrir_prontuario`, `registrar_ficha`, `classificar_risco` recusam | `App.tsx`; RPCs recusam (sem vínculo clínico e sem escala) |
| 5 | admin | `/painel` | `admin_criar_unidade` (unidade fictícia "UBS Teste Admin") e `admin_editar_unidade` | Unidade criada na organização; auditoria | `unidades`; `registrar_auditoria` |
| 6 | admin | `/integracoes` (`Integracoes.tsx`) | `api_criar_chave` com recurso `financeiro`; `api_revogar_chave` | Chave criada e revogada; o segredo só aparece uma vez | tabela de chaves; auditoria |
| 7 | admin | `/escala` | Ler a escala de uma unidade | Lê; publicar é do gestor (`publicar_escala` recusa como admin, se o testador tentar) | `escala_mes_gestor` |
| 8 | admin | — | `trocar_chave_fila(p_perfil)` de alguém da sua unidade (D08, passo 13) | Aceito; auditoria `chave_fila_trocada` | `private.chave_fila.criada_em` muda |
| 9 | admin | `/unidade` | `zerar_segundo_fator` de alguém da unidade com motivo | Aceito (super admin ou gestor) ou recusado (admin comum): registrar o que a RPC faz com o papel `admin` | `private.segundo_fator_eventos` |
| 10 | gestor (contraste) | `/gestao` | `panorama_gestor`, `porta_agora` | O gestor vê a porta com pacientes nomeados; o admin não | contraste de RPCs |
| 11 | secretaria / rede | `/rede` (`Rede.tsx`) | `rede_contexto`, `rede_faturamento`, `regulacao_mapa_vagas`, `rede_baixar_arquivo` | Lacuna (MAPA): sem conta na F5; no SQL Editor como o papel, conferir que só leem agregados e arquivos de BPA fechados, sem paciente | RPCs de `/rede` |
| 12 | admin | `/painel` | `p_dias = 0` e `p_dias = 400` | Limitado a 1–365 | `greatest(1, least(p_dias, 365))` |

**Critérios de aceite:**
- Nenhuma RPC do admin devolve nome, CNS ou CPF de paciente; contagens 1–4 saem nulas.
- O admin não abre tela clínica nem prontuário, mesmo sem escala exigida.
- Criar/editar unidade, chaves e webhooks ficam auditados.

**Bordas a provar:**
- Super admin vê todas as unidades; admin comum só as de `private.unidades_admin()`.
- Unidade recém-criada sem leitos: linha com zeros, não nula (zero não é 1–4).
- Admin que também tem vínculo clínico em outra unidade: lá entra pela escala como aquele papel; o painel segue agregado.

**Lacunas tocadas:**
- Conta de admin e de papéis de rede na F5 (todo o cenário roda fora da F5 ou no SQL Editor).
- Webhook ou push de conta, glosa ou ERP (não existe; o ERP busca).

---

## Cobertura de papéis neste bloco

| Papel | Cenários |
|---|---|
| recepcao | D01, D06, D07, D09, D10, D11 |
| enfermeiro | D01, D06, D07, D08, D09, D11 |
| tecnico_enfermagem | D10 (UBS); UPA sem conta (lacuna, D08) |
| plantonista | D02, D03, D04, D06, D07, D08, D09, D10, D11 |
| farmaceutico | D05, D10 |
| gestor | D01–D12 |
| faturamento | D01, D06, D07, D09 |
| regulador | D07 |
| nir | D05, D07 |
| telemedicina | sem conta na F5 (lacuna, D03 e D10) |
| admin | D12 (conta fora da F5), D08 (lacuna) |
| secretaria / regulacao_regional / faturamento_rede | D12 (lacuna de conta) |

## Lacunas do MAPA tocadas por este bloco (resumo)

1. Janela de check-in antes do início do plantão (D01).
2. Raio na rede F5: unidades sem coordenadas (D03).
3. Divergência 15 vs 20 min depois do fim do plantão entre casca e servidor (D02, D08).
4. Contas ausentes na F5: telemedicina (D03, D10), técnico da UPA (D08), admin (D05, D08, D12), papéis de rede (D12).
5. Regulação em curso não é cancelada pelo óbito; o regulador nega com `ja_atendido_obito` ou a origem cancela (D07).
6. Envio ao SINAN e mapeamento CID → agravo conferido pela vigilância (D07).
7. Modo sem conexão só para observação e documento (D08).
8. Prazo para o gestor decidir o pedido de prontuário e expiração do pendente (D10).
9. Valor de medicamento, material e exame na conta; conta própria da observação (D06, D07).
10. Virada de mês e de ano só se exercitam na tela na data real (D09).
