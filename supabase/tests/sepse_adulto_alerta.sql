-- Testes da migration 20270405000002_sepse_adulto_alerta.sql (teste da rede,
-- B P2-1; decisão A do RT em 11/11/2026): alertas_sepse passa a listar o adulto
-- com gatilho de infecção e NEWS2 de 5 ou mais (5 a 6 rastreio, 7 ou mais alto).
-- Adulto sem infecção, ou com infecção e NEWS2 baixo, fica fora. A parte da
-- criança tem o teste próprio (fase3_phoenix_pelod2.sql). O preparo é o dele.
-- ROLLBACK no fim.
BEGIN;
-- Portão 2, tarefa 4: este teste escala a mesma pessoa em mais de um setor por
-- conveniência; a regra de sobreposição tem teste próprio (portao2_escala_sobreposicao.sql)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '22000000-0000-4000-8000-000000000002', 'Box P' || n, 'observacao' FROM generate_series(1, 5) n
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
-- grava aferições cruas (valor numérico ou código da opção) como a enfermagem
CREATE FUNCTION pg_temp.aferir(p_paciente uuid, p jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, valor_conceito_id, aferido_em, registrado_por)
  SELECT '21000000-0000-4000-8000-000000000001', p_paciente, c.id,
         CASE WHEN jsonb_typeof(e.value) = 'number' THEN (e.value #>> '{}')::numeric END,
         CASE WHEN jsonb_typeof(e.value) = 'string' THEN (SELECT o.id FROM public.conceito_opcao o WHERE o.conceito_id = c.id AND o.valor = e.value #>> '{}') END,
         clock_timestamp(), '10000000-0000-4000-8000-000000000004'
  FROM jsonb_each(p) e JOIN public.conceito c ON c.nome = e.key AND c.unidade_id IS NULL
$$;


-- ── três adultos chegam à porta, são triados e ficam em observação ─────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'e_inf', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre e tosse', NULL,
  '{"nome":"Sepse Adulto Infectado","data_nascimento":"1960-05-05"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'e_sem', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor torácica', NULL,
  '{"nome":"Sepse Adulto Sem Infeccao","data_nascimento":"1961-06-06"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'e_bem', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Disúria', NULL,
  '{"nome":"Sepse Adulto Estavel","data_nascimento":"1962-07-07"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
-- FR 30 (3), FC 120 (2), T 39,0 (1), SpO2 97 (0), PAS 120 (0): NEWS2 6 sem O2 e consciência registrados
SELECT public.classificar_risco(pg_temp.u(x), 'amarelo',
  '{"frequencia-cardiaca":120,"frequencia-respiratoria":30,"temperatura":39.0,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face')
FROM unnest(ARRAY['e_inf', 'e_sem']) x;
SELECT public.classificar_risco(pg_temp.u('e_bem'), 'verde',
  '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u(x)) FROM unnest(ARRAY['e_inf', 'e_sem', 'e_bem']) x;
SELECT public.registrar_soap(pg_temp.u('e_inf'), 'febre, tosse', 'crepitações', 'pneumonia', 'ATB', 'J18.9');
SELECT public.registrar_soap(pg_temp.u('e_sem'), 'dor', 'taquicárdico', 'dor torácica a esclarecer', 'observar', 'R07.4');
SELECT public.registrar_soap(pg_temp.u('e_bem'), 'disúria', 'sem febre', 'ITU', 'ATB', 'N39.0');
SELECT public.registrar_desfecho(pg_temp.u(x), 'observacao') FROM unnest(ARRAY['e_inf', 'e_sem', 'e_bem']) x;
RESET ROLE;
INSERT INTO t SELECT 'p_inf', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e_inf');
INSERT INTO t SELECT 'p_sem', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e_sem');
INSERT INTO t SELECT 'p_bem', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('e_bem');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'al1', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.alertas_sepse('21000000-0000-4000-8000-000000000001') x), '[]')::text;
RESET ROLE;
DO $$
DECLARE al jsonb := pg_temp.v('al1');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.u('p_inf')
                   AND x ->> 'nivel' = 'news2_rastreio' AND (x ->> 'total')::int = 6) THEN
    RAISE EXCEPTION 'FALHOU: adulto com pneumonia e NEWS2 6 fora do alerta (%)', al;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid IN (pg_temp.u('p_sem'), pg_temp.u('p_bem'))) THEN
    RAISE EXCEPTION 'FALHOU: adulto sem infecção, ou com infecção e NEWS2 baixo, entrou no alerta (%)', al;
  END IF;
  RAISE NOTICE 'OK  adulto com infecção e NEWS2 6 entra como rastreio; sem infecção ou com NEWS2 baixo fica fora';
END $$;

-- a pressão cai: NEWS2 sobe para 9 e o alerta vira alto
SELECT pg_temp.aferir(pg_temp.u('p_inf'), '{"pressao-arterial-sistolica":88}');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'al2', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.alertas_sepse('21000000-0000-4000-8000-000000000001') x), '[]')::text;
RESET ROLE;
DO $$
DECLARE al jsonb := pg_temp.v('al2');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(al) x WHERE (x ->> 'paciente_id')::uuid = pg_temp.u('p_inf')
                   AND x ->> 'nivel' = 'news2_alto' AND (x ->> 'total')::int = 9) THEN
    RAISE EXCEPTION 'FALHOU: NEWS2 9 não virou alerta alto (%)', al;
  END IF;
  RAISE NOTICE 'OK  NEWS2 7 ou mais é alerta alto';
END $$;
ROLLBACK;
