-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D09.
-- Virada de data: meia-noite, fim de mês e fim de ano.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D09.
--
-- O relógio NÃO é mexido. O script roda em DUAS fases, pela hora real:
--   • fase "antes" (entre 23h00 e 23h59 de Brasília, sem rodada aberta):
--     ficha e classificação da paciente no dia D;
--   • fase "depois" (quando private.data_atual() já é D+1): o médico assume,
--     grava o SOAP, agenda reavaliação, dá observação e encerra; confere a data
--     de Brasília de cada registro. Também confere as funções de data com
--     instantes passados e futuros como parâmetro (data_do_turno, competência).
-- Fora dessas janelas, só as conferências de função rodam.
--
-- Cada passo roda COMO a conta do papel (RLS ligado), pelas RPCs reais; o
-- resultado fica em e2e.resultados (passos 'D09.NN.*'). Nada é corrigido no
-- produto. Paciente fictícia nova por rodada ("Helena Teste Meia-Noite").
-- A cor da classificação é a escolha da enfermeira de teste (amarelo).
--
-- Rodar antes: 41_checkin_fase5.sql, 47_framework_ampliacao.sql e
-- 49d_ambiente_bloco_d.sql.
-- Uso (homologação): node scripts/e2e/homolog/preparar.mjs scripts/e2e/88_cenario_d09.sql <saida>.sql
--                    npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- fase da rodada pela hora real de Brasília
SELECT e2e.guardar('d09_fase', CASE
  WHEN e2e.v('d09_dia') IS NULL AND extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo') >= 23 THEN 'antes'
  WHEN e2e.v('d09_dia') IS NOT NULL AND e2e.v('d09_depois_feito') IS NULL AND private.data_atual() > e2e.v('d09_dia')::date THEN 'depois'
  ELSE 'funcoes' END);

-- ── fase "antes": dia D, 23h ────────────────────────────────────────────────
DO $$
BEGIN
  IF e2e.v('d09_fase') <> 'antes' THEN RETURN; END IF;
  PERFORM e2e.guardar('d09_rodada', (coalesce(e2e.v('d09_rodada')::int, 0) + 1)::text);
  PERFORM e2e.guardar('d09_dia', private.data_atual()::text);
  PERFORM e2e.guardar('d09_nome', 'Helena Teste Meia-Noite' || CASE WHEN e2e.v('d09_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('d09_rodada')::int) ELSE '' END);
  PERFORM e2e.guardar('d09_cadastro', jsonb_build_object('nome', e2e.v('d09_nome'), 'data_nascimento', '2000-01-01', 'sexo', 'F',
    'raca_cor', 'parda', 'cns', e2e.cns(9890 + e2e.v('d09_rodada')::int), 'nome_mae', 'Mãe Fictícia do Teste D09', 'endereco', 'Rua do Teste, 9',
    'municipio', 'Cidade Teste', 'uf', 'SP')::text);
  PERFORM e2e.passo('D09.01.ficha', 9, 'f5_rec_upa', '/recepcao (Nova ficha)',
    'Recepção abre a ficha de Helena antes da meia-noite (dia D), Pronto Socorro, queixa "falta de ar há 3 h"',
    format($q$SELECT (public.registrar_ficha(%L::uuid, 'Falta de ar há 3 h', NULL, %L::jsonb) ->> 'episodio_id')$q$,
      'f5300000-0000-4000-8000-000000000011', e2e.v('d09_cadastro')), 'ok', 'd09_ep');
  IF e2e.v('d09_ep') IS NULL THEN RETURN; END IF;
  PERFORM e2e.passo('D09.01.chegada_dia_d', 9, 'f5_rec_upa', '/recepcao', 'chegada_em na data de Brasília do dia D',
    format($q$SELECT e2e.confere((chegada_em AT TIME ZONE 'America/Sao_Paulo')::date = %L::date,
      'chegada ' || to_char(chegada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')) FROM public.episodios WHERE id = %L$q$,
      e2e.v('d09_dia'), e2e.u('d09_ep')));
  PERFORM e2e.passo('D09.02.chamar', 9, 'f5_enf_upa', '/triagem (Fila)', 'Enfermeira chama Helena para a Triagem 1',
    format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('d09_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
  PERFORM e2e.passo('D09.02.classificar', 9, 'f5_enf_upa', '/triagem (Classificar)',
    'Classifica antes da meia-noite: fluxograma "Queixas respiratórias" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste',
    format($q$SELECT public.classificar_risco(%L::uuid, 'amarelo',
      '{"frequencia-cardiaca":104,"frequencia-respiratoria":26,"temperatura":36.9,"saturacao-o2":93,"escala-dor":2,"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":82}'::jsonb,
      %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'amarelo'), '{}'::jsonb)::text$q$,
      e2e.u('d09_ep'), '8ec1567f-7aaa-4ae6-bd8b-eab1a65cd34c', 'f5100000-0000-4000-8000-000000000002', '8ec1567f-7aaa-4ae6-bd8b-eab1a65cd34c'),
    'ok', 'd09_class');
END $$;

-- ── fase "depois": dia D+1, depois da meia-noite, sem logout ────────────────
DO $$
DECLARE v_d date; v_d1 date;
BEGIN
  IF e2e.v('d09_fase') <> 'depois' THEN RETURN; END IF;
  v_d := e2e.v('d09_dia')::date; v_d1 := v_d + 1;
  PERFORM e2e.guardar('d09_depois_feito', now()::text);
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.03.iniciar', 9, 'f5_med_upa', '/atendimento (JanelaAtendimento)', 'Médico assume Helena depois da meia-noite (dia D+1)',
    format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.03.soap', 9, 'f5_med_upa', '/atendimento', 'SOAP com CID R06.0 (dispneia)',
    format($q$SELECT public.registrar_soap(%L::uuid, 'Falta de ar há 3 h (teste D09)', 'FR 26, SpO2 93%%, sinais crus da triagem', 'Dispneia a esclarecer', 'Exame e reavaliação', 'R06.0')::text$q$, e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.04.exame', 9, 'f5_med_upa', '/atendimento (Exames)', 'Pede um exame urgente (nome livre: a UPA F5 não tem lista de exames)',
    format($q$SELECT public.pedir_exames(%L::uuid, '[{"nome":"Gasometria arterial (teste D09)"}]'::jsonb, 'urgente', NULL)::text$q$, e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.04.reavaliar_25h', 9, 'f5_med_upa', '/atendimento (AbaReavaliacao)', 'Reavaliação para daqui a 25 h (deve ser recusada: até 24 h)',
    format($q$SELECT public.aguardar_reavaliacao(%L::uuid, now() + interval '25 hours')::text$q$, e2e.u('d09_ep')), 'erro:Hora da reavaliação fora do plantão');
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.04.reavaliar', 9, 'f5_med_upa', '/atendimento (AbaReavaliacao)', 'Reavaliação para daqui a 30 min (dia D+1)',
    format($q$SELECT public.aguardar_reavaliacao(%L::uuid, now() + interval '30 minutes')::text$q$, e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.04.reavaliar_em', 9, 'banco', NULL, 'reavaliar_em gravado na data D+1 de Brasília',
    format($q$SELECT e2e.d_confere((reavaliar_em AT TIME ZONE 'America/Sao_Paulo')::date = %L::date, 'reavaliar em ' || to_char(reavaliar_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'))
      FROM public.episodios WHERE id = %L$q$, v_d1, e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.05.observacao', 9, 'f5_med_upa', '/atendimento (AbaDesfecho)', 'Desfecho observação em D+1 (box livre da Observação Adulto)',
    format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('d09_ep')));
  PERFORM e2e.d_dep('d09_ep', 'D09.01.ficha', 'D09.05.box', 9, 'banco', NULL, 'Internação de observação aberta em D+1 e pendência de 6 h vencendo em D+1',
    format($q$SELECT i.id::text FROM public.internacoes i WHERE i.episodio_id = %L
       AND EXISTS (SELECT 1 FROM public.pendencias p WHERE p.internacao_id = i.id AND p.tipo = 'observacao'
                    AND (p.prazo AT TIME ZONE 'America/Sao_Paulo')::date = %L::date) ORDER BY i.created_at DESC LIMIT 1$q$,
      e2e.u('d09_ep'), v_d1), 'ok', 'd09_int');
  PERFORM e2e.d_dep('d09_int', 'D09.05.box', 'D09.05.leito', 9, 'banco', NULL, 'Box ocupado (nenhum dos leitos reservados a outros blocos)',
    format($q$SELECT e2e.d_confere(l.identificador NOT IN ('OA-01', 'OA-02'), 'box ' || l.identificador || ' (' || l.status || ')')
      FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.u('d09_int')));

  -- ── 6 e 7. check-in de madrugada com a conta própria do bloco D ──────────
  PERFORM e2e.d_passo('D09.06.escala_noite', 9, 'd_ges', '/escala (EscalaMes)', 'Gestor do bloco D escala a plantonista A na noite do dia D (19h–07h) na UPA Bloco D',
    format($q$SELECT public.adicionar_plantao_escala(%L::uuid, %L::uuid, %L::uuid, %L::date, 'noite', NULL, false, 'plantonista')::text$q$,
      'fd100000-0000-4000-8000-000000000001', 'fd300000-0000-4000-8000-000000000011', 'fd200000-0000-4000-8000-000000000001', v_d));
  PERFORM e2e.d_passo('D09.06.checkin_madrugada', 9, 'd_plant_a', '/plantao/check-in', 'Plantonista A faz o check-in depois da meia-noite (atrasado, no plantão da noite de D)',
    format($q$SELECT public.registrar_checkin(%L::uuid, NULL, NULL, 'check-in de madrugada (teste D09)', NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'ok', 'd09_presenca');
  PERFORM e2e.d_dep('d09_presenca', 'D09.06.checkin_madrugada', 'D09.06.data_do_turno', 9, 'banco', NULL, 'A presença fica com a data do turno = dia D (a noite começou ontem), sem duplicar',
    format($q$SELECT e2e.d_confere(p.data = %L::date AND p.turno = 'noite'
        AND (SELECT count(*) FROM public.presenca_plantonista x WHERE x.perfil_id = p.perfil_id AND x.unidade_id = p.unidade_id AND x.turno = 'noite' AND x.data IN (%L::date, %L::date)) = 1,
      'presença data ' || p.data || ', turno ' || p.turno || ', check-in ' || to_char(p.checkin_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'))
      FROM public.presenca_plantonista p WHERE p.id = %L$q$, v_d, v_d, v_d1, e2e.u('d09_presenca')));
  PERFORM e2e.d_passo('D09.07.presencas', 9, 'd_ges', '/escala → PresencasDoDia', 'Gestor lê as presenças: a noite de D aparece uma vez, com o check-in da madrugada',
    format($q$SELECT left(public.presencas_do_dia_gestor(%L::uuid)::text, 380)$q$, 'fd100000-0000-4000-8000-000000000001'));
END $$;

-- ── D+1: plantão que segue, painel da observação, resultado do exame e alta ─
-- (roda na fase "depois" e nas rodadas seguintes enquanto Helena estiver em
--  observação; na 1ª rodada estes passos vieram com erro do script e o exame
--  pendente barrou a alta, ver EXECUCAO-D01-D12.md)
DO $$
DECLARE v_d date; v_d1 date; v_exame uuid;
BEGIN
  IF e2e.v('d09_dia') IS NULL OR private.data_atual() <= e2e.v('d09_dia')::date OR e2e.v('d09_int') IS NULL THEN RETURN; END IF;
  IF (SELECT etapa FROM public.episodios WHERE id = e2e.u('d09_ep')) <> 'observacao' THEN RETURN; END IF;
  v_d := e2e.v('d09_dia')::date; v_d1 := v_d + 1;
  PERFORM e2e.d_passo('D09.03.plantao_segue', 9, 'f5_med_upa', '/atendimento (usePlantao)',
    'Depois da meia-noite o plantão da noite (início no dia D) segue aberto para o médico: turno_atual e meu_plantao_agora',
    format($q$SELECT e2e.d_confere((SELECT t::text FROM public.turno_atual() t) ILIKE '%%noite%%'
        AND EXISTS (SELECT 1 FROM public.meu_plantao_agora() p WHERE p.turno = 'noite' AND (p.inicio AT TIME ZONE 'America/Sao_Paulo')::date = %L::date),
      'turno ' || (SELECT t::text FROM public.turno_atual() t) || '; plantão ' || (SELECT string_agg(p.turno || ' ' || p.setor_nome || ' de ' || to_char(p.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
        || ' a ' || to_char(p.fim AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'), '; ') FROM public.meu_plantao_agora() p))$q$, v_d));
  PERFORM e2e.d_passo('D09.05.painel', 9, 'f5_med_obs', '/plantao/observacao (painel_observacao)', 'O médico da observação vê Helena com o prazo de 6 h em D+1',
    format($q$SELECT e2e.d_confere(x::text LIKE '%%' || %L || '%%', left(x::text, 300)) FROM public.painel_observacao(%L::uuid) x WHERE x::text LIKE '%%' || %L || '%%'$q$,
      e2e.v('d09_nome'), 'f5100000-0000-4000-8000-000000000002', e2e.v('d09_nome')));
  SELECT id INTO v_exame FROM public.exames_pedidos WHERE episodio_id = e2e.u('d09_ep') AND situacao IN ('pedido', 'coletado', 'em_analise') LIMIT 1;
  IF v_exame IS NOT NULL THEN
    PERFORM e2e.d_passo('D09.08.alta_com_exame_pendente', 9, 'f5_med_obs', '/plantao/observacao', 'Alta com o exame ainda sem resultado (deve ser recusada: impeditivo)',
      format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'R06.0', 'Melhora da dispneia, alta (teste D09)', '{}'::jsonb)::text$q$, e2e.u('d09_int')),
      'erro:Existe(m) pendência(s) em aberto');
    PERFORM e2e.d_passo('D09.08.resultado', 9, 'f5_med_obs', '/plantao/observacao (Exames)', 'Registra o resultado (texto fictício de teste) do exame pedido na porta',
      format($q$SELECT public.registrar_resultado_exame(%L::uuid, 'Resultado fictício de teste de fluxo (D09)', NULL, NULL, NULL)::text$q$, v_exame));
  END IF;
  PERFORM e2e.d_passo('D09.08.finalizar', 9, 'f5_med_obs', '/plantao/observacao', 'Médico da observação encerra com alta médica, CID R06.0 e relato (D+1)',
    format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'R06.0', 'Melhora da dispneia, alta (teste D09)', '{}'::jsonb)::text$q$, e2e.u('d09_int')));
  PERFORM e2e.d_passo('D09.08.encerrado_d1', 9, 'banco', NULL, 'Desfecho e encerramento na data D+1 de Brasília; chegada e classificação ficam no dia D',
    format($q$SELECT e2e.d_confere((e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date = %L::date
        AND (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date = %L::date
        AND (c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = %L::date,
      'chegada ' || to_char(e.chegada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '; classificação ' || to_char(c.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
      || '; encerrado ' || coalesce(to_char(e.encerrado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'não'))
      FROM public.episodios e JOIN public.classificacoes_risco c ON c.episodio_id = e.id WHERE e.id = %L ORDER BY c.criado_em LIMIT 1$q$,
      v_d1, v_d, v_d, e2e.u('d09_ep')));
END $$;

-- ── funções de data com instantes como parâmetro (rodam em toda rodada) ─────
SELECT e2e.d_passo('D09.F1.data_do_turno', 9, 'banco', NULL,
  'private.data_do_turno: 00h45 e 06h59 caem no dia anterior; 07h00 e 23h59 no próprio dia; 03h de 1º/01 cai em 31/12; madrugada de 1º/03/2028 cai em 29/02',
  $q$SELECT e2e.d_confere(
      private.data_do_turno('2026-11-07 00:45-03') = date '2026-11-06' AND private.data_do_turno('2026-11-07 06:59-03') = date '2026-11-06'
      AND private.data_do_turno('2026-11-07 07:00-03') = date '2026-11-07' AND private.data_do_turno('2026-11-07 23:59-03') = date '2026-11-07'
      AND private.data_do_turno('2027-01-01 03:00-03') = date '2026-12-31' AND private.data_do_turno('2028-03-01 02:00-03') = date '2028-02-29'
      AND private.data_do_turno('2026-12-01 05:30Z') = date '2026-11-30',
    'D-1 antes das 7h (Brasília, não UTC): 07/11 00h45 → ' || private.data_do_turno('2026-11-07 00:45-03') || '; 01/01/2027 03h → ' || private.data_do_turno('2027-01-01 03:00-03')
    || '; 01/12 05h30 UTC (02h30 BRT) → ' || private.data_do_turno('2026-12-01 05:30Z'))$q$);
SELECT e2e.d_passo('D09.F2.competencia', 9, 'banco', NULL,
  'private.competencia_de: 30/11 23h50 → 202611; 01/12 00h05 → 202612; 01/12 02h50 UTC (= 30/11 23h50 de Brasília) → 202611; 31/12 23h59 → 202612; 01/01 00h01 → 202701',
  $q$SELECT e2e.d_confere(
      private.competencia_de('2026-11-30 23:50-03') = '202611' AND private.competencia_de('2026-12-01 00:05-03') = '202612'
      AND private.competencia_de('2026-12-01 02:50Z') = '202611'
      AND private.competencia_de('2026-12-31 23:59-03') = '202612' AND private.competencia_de('2027-01-01 00:01-03') = '202701',
    'competências pela data de Brasília: ' || private.competencia_de('2026-11-30 23:50-03') || ', ' || private.competencia_de('2026-12-01 00:05-03') || ', '
    || private.competencia_de('2026-12-01 02:50Z') || ', ' || private.competencia_de('2027-01-01 00:01-03'))$q$);
SELECT e2e.d_passo('D09.F3.inicio_turno', 9, 'banco', NULL,
  'private.inicio_do_turno: a noite de 31/12 começa 31/12 19h e dura 12 h (atravessa o ano); a madrugada de 01/01 (grade de 6 h) começa em 01/01 01h',
  $q$SELECT e2e.d_confere(private.inicio_do_turno('2026-12-31', 'noite') = timestamptz '2026-12-31 19:00-03'
      AND private.duracao_padrao('noite') = 720 AND private.inicio_do_turno('2027-01-01', 'madrugada') = timestamptz '2027-01-01 01:00-03',
    'noite 31/12 → ' || to_char(private.inicio_do_turno('2026-12-31', 'noite') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' por ' || private.duracao_padrao('noite')
    || ' min; madrugada 01/01 → ' || to_char(private.inicio_do_turno('2027-01-01', 'madrugada') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))$q$);
SELECT e2e.d_passo('D09.F4.sem_horario_verao', 9, 'banco', NULL, 'America/Sao_Paulo sem horário de verão: -03 em janeiro e em novembro',
  $q$SELECT e2e.d_confere(to_char(timestamptz '2027-01-15 12:00Z' AT TIME ZONE 'America/Sao_Paulo', 'HH24') = '09'
      AND to_char(timestamptz '2026-11-15 12:00Z' AT TIME ZONE 'America/Sao_Paulo', 'HH24') = '09', 'UTC-3 nos dois meses')$q$);
SELECT e2e.d_passo('D09.11.fechar_futura', 9, 'd_fat', '/faturamento (Bpa.tsx)', 'Fechar a competência do mês seguinte enquanto ela não começou (deve ser recusado) — na UPA Bloco D, para não tocar a UPA F5',
  format($q$SELECT public.fechar_competencia_bpa(%L::uuid, to_char(private.data_atual() + interval '1 month', 'YYYYMM'), NULL)::text$q$, 'fd100000-0000-4000-8000-000000000001'), 'erro');
SELECT e2e.d_lacuna('D09.10.bpa_dois_meses', 9, 'f5_fat', 'BPA de dois meses com a classificação em D (último dia do mês) e a consulta em D+1',
  'Fim de mês só na data real (MAPA): esta rodada caiu em 06→07/11, mesmo mês. A regra foi conferida por parâmetro em D09.F2 (competencia_de com instantes de 30/11 e 01/12, inclusive UTC × Brasília).');
SELECT e2e.d_lacuna('D09.13.avisos_ano_novo', 9, 'f5_ges_upa', 'Avisos e indicadores às 00h05 de 1º de janeiro',
  'Fim de ano só na data real (MAPA). Avisos na data de Brasília ficam com os testes de banco VD (docs/virada-de-data/); na tela, só no dia.');
SELECT e2e.d_lacuna('D09.14.apac_erp_ano', 9, 'f5_fat', 'Validade da APAC que cruza o ano e plantões da noite de 31/12 no ERP',
  'Fim de ano só na data real. A data do turno da noite de 31/12 (dezembro) foi conferida em D09.F1 e D09.F3; a validade da APAC fica com os testes VD7.');
SELECT e2e.d_lacuna('D09.12.pedido_23h55', 9, 'f5_ges_upa', 'Pedido de prontuário aprovado às 23h55 cruza a meia-noite',
  'Coberto no D10: valido_ate = decidido_em + 24 h, conferido por intervalo (a aprovação desta rodada não caiu às 23h55).');
