-- ════════════════════════════════════════════════════════════════════════════
-- Reconferência do achado D P2-1 (D02.B1) depois da
-- 20270308000003_checkout_fecha_porta.sql (A em C1 e C2, por delegação do RT
-- em 08/11/2026).
--
-- O médico da porta da UPA F5 (f5_med_upa), com check-in, faz o check-out:
-- meu_plantao_agora fica vazio (a porta fecha na hora). Em seguida faz o
-- check-in de novo e a porta reabre (o cenário segue como estava).
-- Cada passo roda como a conta do papel (e2e.bpasso, do 60).
-- Rodar antes: 41_checkin_fase5.sql.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DELETE FROM e2e.vars WHERE nome LIKE 'cko\_%';
SELECT e2e.b_guardar('cko_inicio', now()::text);

SELECT e2e.bpasso(NULL, 'CKO.01.aberta', 'f5_med_upa', '/plantao', 'Com check-in, o plantão está aberto',
  $q$SELECT e2e.b_confere(count(*) > 0, count(*) || ' plantão(ões) agora') FROM public.meu_plantao_agora()$q$);
SELECT e2e.bpasso(NULL, 'CKO.02.presenca', 'banco', NULL, 'Presença do plantão de agora',
  $q$SELECT x.id::text FROM public.presenca_plantonista x JOIN public.escala_plantao e ON e.id = x.escala_plantao_id
      WHERE x.perfil_id = e2e.conta('f5_med_upa') AND x.checkout_em IS NULL AND now() >= e.inicio
        AND now() < e.inicio + make_interval(mins => e.duracao_min) ORDER BY x.checkin_em DESC LIMIT 1$q$, 'ok', 'cko_pres');
SELECT e2e.bpasso('cko_pres', 'CKO.03.checkout', 'f5_med_upa', '/plantao (Check-out)', 'O médico faz o check-out',
  format('SELECT public.registrar_checkout(%L::uuid)::text', e2e.u('cko_pres')));
SELECT e2e.bpasso('cko_pres', 'CKO.04.fechada', 'f5_med_upa', '/plantao', 'Depois do check-out, a porta fecha na hora (antes: seguia aberta)',
  $q$SELECT e2e.b_confere(count(*) = 0, count(*) || ' plantão(ões) agora') FROM public.meu_plantao_agora()$q$);
SELECT e2e.bpasso('cko_pres', 'CKO.05.checkin', 'f5_med_upa', '/plantao (Check-in)', 'Check-in de novo (C2: reabre)',
  $q$SELECT public.registrar_checkin('f5100000-0000-4000-8000-000000000002'::uuid)::text$q$);
SELECT e2e.bpasso('cko_pres', 'CKO.06.reaberta', 'f5_med_upa', '/plantao', 'A porta reabre',
  $q$SELECT e2e.b_confere(count(*) > 0, count(*) || ' plantão(ões) agora') FROM public.meu_plantao_agora()$q$);

SELECT passo, situacao, left(coalesce(detalhe, ''), 140) AS detalhe
  FROM e2e.resultados WHERE passo LIKE 'CKO.%' AND em >= e2e.v('cko_inicio')::timestamptz ORDER BY id;
