-- Testes da migration 20270419000001 (passômetro do médico, pedido 8; PS1 a
-- PS3 = A do RT em 23/11/2026). Dados próprios, criados aqui. ROLLBACK no fim.
-- O médico de plantão vê os pacientes da observação e da internação dos
-- setores da escala dele, com as pendências abertas (e as resolvidas há menos
-- de 24 h); não vê setor fora da escala, alta dada nem outra unidade; a
-- enfermeira não abre o passômetro; a impressão grava uma linha por paciente no
-- registro de acesso ao prontuário.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER USER;

INSERT INTO auth.users (id, email) VALUES
  ('a8000000-0000-4000-8000-000000000001', 'medico@passometro.local'),
  ('a8000000-0000-4000-8000-000000000002', 'enfermeira@passometro.local'),
  ('a8000000-0000-4000-8000-000000000003', 'outro@passometro.local')
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('a8000000-0000-4000-8000-000000000001', 'Médico Passômetro'),
  ('a8000000-0000-4000-8000-000000000002', 'Enfermeira Passômetro'),
  ('a8000000-0000-4000-8000-000000000003', 'Médico Outra Unidade')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES ('a8100000-0000-4000-8000-000000000001', 'Rede Passômetro');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('a8200000-0000-4000-8000-000000000001', 'a8100000-0000-4000-8000-000000000001', 'UPA Passômetro', 'upa'),
  ('a8200000-0000-4000-8000-000000000002', 'a8100000-0000-4000-8000-000000000001', 'UPA Vizinha', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('a8300000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'Observação', 'observacao'),
  ('a8300000-0000-4000-8000-000000000002', 'a8200000-0000-4000-8000-000000000001', 'Clínica Médica', 'internacao'),
  ('a8300000-0000-4000-8000-000000000003', 'a8200000-0000-4000-8000-000000000001', 'Pediatria', 'internacao'),
  ('a8300000-0000-4000-8000-000000000004', 'a8200000-0000-4000-8000-000000000002', 'Observação', 'observacao');
INSERT INTO public.leitos (id, setor_id, identificador) VALUES
  ('a8400000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000001', 'OBS 1'),
  ('a8400000-0000-4000-8000-000000000002', 'a8300000-0000-4000-8000-000000000002', 'CM 3');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('a8000000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'plantonista'),
  ('a8000000-0000-4000-8000-000000000002', 'a8200000-0000-4000-8000-000000000001', 'enfermeiro'),
  ('a8000000-0000-4000-8000-000000000003', 'a8200000-0000-4000-8000-000000000002', 'plantonista');
-- o médico está na Observação e na Clínica Médica agora; a Pediatria não é dele
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('a8200000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', private.data_atual(), 'manha', now() - interval '1 hour', 720),
  ('a8200000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000001', private.data_atual(), 'manha', now() - interval '1 hour', 720),
  ('a8200000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 720),
  ('a8200000-0000-4000-8000-000000000002', 'a8300000-0000-4000-8000-000000000004', 'a8000000-0000-4000-8000-000000000003', private.data_atual(), 'manha', now() - interval '1 hour', 720);
-- check-in feito (o plantão em curso conta com a presença)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id::text LIKE 'a8000000-%'
ON CONFLICT DO NOTHING;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo) VALUES
  ('a8500000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'Ana Observada', '1960-01-01', 'F'),
  ('a8500000-0000-4000-8000-000000000002', 'a8200000-0000-4000-8000-000000000001', 'Bruno Internado', '1975-05-05', 'M'),
  ('a8500000-0000-4000-8000-000000000003', 'a8200000-0000-4000-8000-000000000001', 'Caio Pediatria', '2020-02-02', 'M'),
  ('a8500000-0000-4000-8000-000000000004', 'a8200000-0000-4000-8000-000000000001', 'Dora De Alta', '1950-03-03', 'F'),
  ('a8500000-0000-4000-8000-000000000005', 'a8200000-0000-4000-8000-000000000002', 'Edu Vizinho', '1980-08-08', 'M');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, setor_atual_id, leito_atual_id, status, cid_principal) VALUES
  ('a8600000-0000-4000-8000-000000000001', 'a8100000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000001', 'a8300000-0000-4000-8000-000000000001', 'a8400000-0000-4000-8000-000000000001', 'em_observacao', 'R07.4'),
  ('a8600000-0000-4000-8000-000000000002', 'a8100000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000002', 'a8300000-0000-4000-8000-000000000002', 'a8400000-0000-4000-8000-000000000002', 'internado', 'J18.9'),
  ('a8600000-0000-4000-8000-000000000003', 'a8100000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000003', 'a8300000-0000-4000-8000-000000000003', NULL, 'internado', NULL),
  ('a8600000-0000-4000-8000-000000000005', 'a8100000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000002', 'a8500000-0000-4000-8000-000000000005', 'a8300000-0000-4000-8000-000000000004', NULL, 'em_observacao', NULL);
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, setor_atual_id, status, data_alta) VALUES
  ('a8600000-0000-4000-8000-000000000004', 'a8100000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000004', 'a8300000-0000-4000-8000-000000000002', 'alta_melhorada', now() - interval '2 hours');

INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id, situacao, resolvida_em, resolvida_por) VALUES
  ('a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000002', 'a8600000-0000-4000-8000-000000000002', 'exame', 'Checar potássio', now() + interval '2 hours', 'a8000000-0000-4000-8000-000000000001', 'aberta', NULL, NULL),
  ('a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000002', 'a8600000-0000-4000-8000-000000000002', 'outro', 'Ver tomografia', NULL, 'a8000000-0000-4000-8000-000000000001', 'concluida', now() - interval '1 hour', 'a8000000-0000-4000-8000-000000000001'),
  ('a8200000-0000-4000-8000-000000000001', 'a8500000-0000-4000-8000-000000000002', 'a8600000-0000-4000-8000-000000000002', 'outro', 'Feita anteontem', NULL, 'a8000000-0000-4000-8000-000000000001', 'concluida', now() - interval '2 days', 'a8000000-0000-4000-8000-000000000001');

CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
CREATE FUNCTION pg_temp.igual(p_obtido text, p_esperado text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtido IS DISTINCT FROM p_esperado THEN
    RAISE EXCEPTION 'FALHOU: % — esperado %, veio %', p_ok, p_esperado, p_obtido;
  END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.igual(text, text, text) TO authenticated;

-- ── o médico de plantão ─────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('a8000000-0000-4000-8000-000000000001');
SELECT pg_temp.igual((SELECT string_agg(x->>'setor' || '/' || coalesce(x->>'leito', '-') || '/' || (x->>'nome'), ' | ')
                        FROM jsonb_array_elements(public.passometro('a8200000-0000-4000-8000-000000000001')) x),
  'Clínica Médica/CM 3/Bruno Internado | Observação/OBS 1/Ana Observada',
  'lista os pacientes dos setores da escala, sem a Pediatria, sem a alta e sem outra unidade');
SELECT pg_temp.igual((SELECT string_agg(p->>'descricao' || ':' || (p->>'situacao'), ', ')
                        FROM jsonb_array_elements(public.passometro('a8200000-0000-4000-8000-000000000001')) x,
                             jsonb_array_elements(x->'pendencias') p
                       WHERE x->>'nome' = 'Bruno Internado'),
  'Checar potássio:aberta, Ver tomografia:concluida',
  'traz as pendências abertas e as resolvidas há menos de 24 h');
SELECT pg_temp.igual((SELECT x->>'cid_principal' FROM jsonb_array_elements(public.passometro('a8200000-0000-4000-8000-000000000001')) x
                       WHERE x->>'nome' = 'Ana Observada'), 'R07.4', 'traz o CID principal');
SELECT pg_temp.igual((public.registrar_impressao_passometro('a8200000-0000-4000-8000-000000000001')->>'pacientes'), '2',
  'a impressão grava os dois pacientes');
SELECT pg_temp.falha($$SELECT public.passometro('a8200000-0000-4000-8000-000000000002')$$, 'Acesso negado', 'não abre o passômetro de outra unidade');

-- ── a enfermeira e o anônimo não abrem ──────────────────────────────────────
SELECT pg_temp.como('a8000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.passometro('a8200000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'a enfermeira não abre o passômetro');
SELECT pg_temp.falha($$SELECT public.registrar_impressao_passometro('a8200000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'a enfermeira não imprime');
RESET ROLE;

SELECT pg_temp.igual((SELECT count(*)::text FROM public.log_acesso_prontuario
                       WHERE unidade_id = 'a8200000-0000-4000-8000-000000000001' AND documento_tipo = 'Passômetro'
                         AND tipo_acesso = 'impressao' AND acessado_por = 'a8000000-0000-4000-8000-000000000001'),
  '2', 'registro de acesso: uma impressão por paciente, com o médico como autor');

SET LOCAL ROLE anon;
SELECT pg_temp.falha($$SELECT public.passometro('a8200000-0000-4000-8000-000000000001')$$, 'permission denied', 'anônimo não chama');
RESET ROLE;

ROLLBACK;
