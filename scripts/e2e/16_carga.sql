-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — carga: 60 internados a mais e 500 sinais vitais na
-- UPA E2E, e o tempo das telas do gestor, da enfermagem e da regulação.
-- Dados sintéticos gravados direto (como postgres), marcados "E2E Carga".
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
DO $$
DECLARE i int; v_pac uuid; v_int uuid; v_setor uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE nome = 'E2E Carga 001') THEN RETURN; END IF;
  FOR i IN 1..60 LOOP
    v_setor := CASE WHEN i % 3 = 0 THEN 'e1200000-0000-4000-8000-000000000003'::uuid ELSE 'e1200000-0000-4000-8000-000000000005'::uuid END;
    INSERT INTO public.pacientes (unidade_id, nome, data_nascimento, sexo, setor_id, prontuario)
    VALUES ('e1100000-0000-4000-8000-000000000001', 'E2E Carga ' || lpad(i::text, 3, '0'), current_date - make_interval(years => 20 + i), CASE WHEN i % 2 = 0 THEN 'F' ELSE 'M' END,
            v_setor, 'CARGA.' || lpad(i::text, 6, '0'))
    RETURNING id INTO v_pac;
    INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, data_admissao, setor_atual_id, data_entrada_setor)
    VALUES ('e1000000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', v_pac, 'urgencia', 'emergencia', 'internado',
            now() - make_interval(hours => i * 3), v_setor, now() - make_interval(hours => i * 3))
    RETURNING id INTO v_int;
    INSERT INTO public.observacao (unidade_id, internacao_id, paciente_id, conceito_id, aferido_em, registrado_por, valor_num)
    SELECT 'e1100000-0000-4000-8000-000000000001', v_int, v_pac, c.id, now() - make_interval(mins => k * 37), 'e2000000-0000-4000-8000-000000000003',
           CASE c.nome WHEN 'frequencia-cardiaca' THEN 70 + (k * 7) % 40 WHEN 'temperatura' THEN 36 + (k % 4) * 0.5 ELSE 95 + k % 4 END
      FROM generate_series(1, 3) k, public.conceito c WHERE c.nome IN ('frequencia-cardiaca', 'temperatura', 'saturacao-o2') AND (k + i) % 1 = 0
     LIMIT 9;
  END LOOP;
END $$;

-- medições (tempo de cada tela, em ms, como o papel)
CREATE OR REPLACE FUNCTION e2e.cronometrar(p_passo text, p_papel text, p_rota text, p_sql text, p_limite_ms int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE t0 timestamptz; ms numeric; r text;
BEGIN
  t0 := clock_timestamp();
  r := e2e.passo(p_passo, NULL, p_papel, p_rota, 'Tempo da tela com 60+ internados (limite ' || p_limite_ms || ' ms)', p_sql);
  ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  UPDATE e2e.resultados SET detalhe = ms || ' ms; ' || coalesce(detalhe, ''),
         situacao = CASE WHEN situacao = 'ok' AND ms > p_limite_ms THEN 'falha' ELSE situacao END
   WHERE id = (SELECT max(id) FROM e2e.resultados);
  RETURN ms || ' ms — ' || p_passo;
END $$;
SELECT e2e.cronometrar('P.panorama', 'gestor', '/gestao', $q$SELECT length(public.panorama_gestor('e1100000-0000-4000-8000-000000000001')::text)::text$q$, 2000);
SELECT e2e.cronometrar('P.mapa_leitos', 'gestor', '/unidade', $q$SELECT length(public.mapa_leitos_gestor('e1100000-0000-4000-8000-000000000001')::text)::text$q$, 2000);
SELECT e2e.cronometrar('P.situacao_leitos', 'gestor', '/unidade', $q$SELECT count(*)::text FROM public.situacao_leitos('e1100000-0000-4000-8000-000000000001')$q$, 1500);
SELECT e2e.cronometrar('P.porta', 'gestor', '/gestao/porta', $q$SELECT length(public.porta_agora('e1100000-0000-4000-8000-000000000001')::text)::text$q$, 1500);
SELECT e2e.cronometrar('P.enfermagem_leitos', 'enfermeiro', '/enfermagem/internacao', $q$SELECT count(*)::text FROM public.enfermagem_leitos('e1100000-0000-4000-8000-000000000001')$q$, 1500);
SELECT e2e.cronometrar('P.fila_checagem', 'tecnico', '/checagem', $q$SELECT count(*)::text FROM public.fila_checagem()$q$, 1500);
SELECT e2e.cronometrar('P.censo', 'gestor', '/indicadores', $q$SELECT count(*)::text FROM public.gerar_censo_diario('e1100000-0000-4000-8000-000000000001', current_date) x$q$, 3000);
SELECT e2e.cronometrar('P.fila_regulacao', 'regulador', '/regulacao', $q$SELECT length(public.regulacao_fila('e1100000-0000-4000-8000-000000000009')::text)::text$q$, 1500);
SELECT e2e.cronometrar('P.indicadores_regulacao', 'regulador', '/regulacao', $q$SELECT length(public.regulacao_indicadores('e1100000-0000-4000-8000-000000000009')::text)::text$q$, 2000);
SELECT passo, situacao, left(detalhe, 80) FROM e2e.resultados WHERE passo LIKE 'P.%' ORDER BY id;
