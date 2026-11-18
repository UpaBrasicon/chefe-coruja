-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000017_ubs_u12_exame_externo.sql (percurso da UBS,
-- U12, parte 1). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o enfermeiro registra a HbA1c feita fora: entra com o valor e conta no
--    hiperdia pela data do exame;
-- 2. o HIV em gestante feito fora conta nos testes do pré-natal (C3), e o código
--    atual do HIV de gestante passa a contar;
-- 3. valor fora do formato, data no futuro, exame fora da lista e a recepção
--    são recusados.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000094a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000094a2'),
  ('cons', '00000000-0000-4000-8000-0000000094a3'),
  ('rec',  '00000000-0000-4000-8000-0000000094b1'),
  ('enf',  '00000000-0000-4000-8000-0000000094b2'),
  ('med',  '00000000-0000-4000-8000-0000000094b3');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u12a.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U12');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U12', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['rec', 'enf', 'med']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento) VALUES
  ('00000000-0000-4000-8000-0000000094c1', pg_temp.id('ubs'), 'Hipertenso Diabetico', 'U12-1', 'M', '1960-01-01'),
  ('00000000-0000-4000-8000-0000000094c2', pg_temp.id('ubs'), 'Gestante Exame Fora', 'U12-2', 'F', '1995-02-02');
INSERT INTO public.programa_participantes (unidade_id, paciente_id, programa, origem, entrada_por)
VALUES (pg_temp.id('ubs'), '00000000-0000-4000-8000-0000000094c1', 'diabetes', 'manual', pg_temp.id('enf'));
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum, entrada_por)
VALUES (pg_temp.id('ubs'), '00000000-0000-4000-8000-0000000094c2', 'manual', private.data_atual() - 60, pg_temp.id('enf'));
CREATE TEMP TABLE w (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON w TO authenticated;

SET LOCAL ROLE authenticated;
-- ── 3. recusas ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha(format('SELECT public.registrar_exame_externo(%L, %L, %L, %L)', '00000000-0000-4000-8000-0000000094c1', '0202010503', private.data_atual() - 10, '7,2'),
  'Acesso negado: o exame feito fora', '3. a recepção não registra exame');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.registrar_exame_externo(%L, %L, %L, %L)', '00000000-0000-4000-8000-0000000094c1', '0202010503', private.data_atual() - 10, '40'),
  'HbA1c: informe o valor', '3. HbA1c de 40% recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_exame_externo(%L, %L, %L, %L)', '00000000-0000-4000-8000-0000000094c2', '0202031179', private.data_atual() - 10, '1:3'),
  'VDRL: informe', '3. título de VDRL 1:3 recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_exame_externo(%L, %L, %L, %L)', '00000000-0000-4000-8000-0000000094c1', '0202010503', private.data_atual() + 1, '7'),
  'A data do exame tem de ser de hoje para trás', '3. data no futuro recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_exame_externo(%L, %L, %L, %L)', '00000000-0000-4000-8000-0000000094c1', '0202060250', private.data_atual() - 10, '2'),
  'Exame fora da lista de exames feitos fora', '3. TSH fora da lista, recusa');

-- ── 1. HbA1c ────────────────────────────────────────────────────────────────
INSERT INTO w SELECT 'a1c', public.registrar_exame_externo('00000000-0000-4000-8000-0000000094c1', '0202010503', private.data_atual() - 10, '7,2', 'Laboratório Municipal');
-- ── 2. HIV em gestante ──────────────────────────────────────────────────────
INSERT INTO w SELECT 'hiv', public.registrar_exame_externo('00000000-0000-4000-8000-0000000094c2', '0202031519', private.data_atual() - 20, 'nao_reagente');
RESET ROLE;

SELECT pg_temp.ok((SELECT e.situacao = 'resultado' AND e.observacao LIKE 'Exame feito fora da UBS (Laboratório Municipal)%'
                     AND (SELECT i.valor_num = 7.2 AND i.unidade = '%' AND i.loinc = '4548-4'
                            FROM public.exame_resultados r JOIN public.exame_resultado_itens i ON i.resultado_id = r.id
                           WHERE r.exame_id = e.id AND r.vigente)
                     FROM public.exames_pedidos e WHERE e.id = (SELECT id FROM w WHERE nome = 'a1c')),
  '1. a HbA1c feita fora entra com o valor estruturado (7,2%)');
SELECT pg_temp.ok((private.hiperdia_registros('00000000-0000-4000-8000-0000000094c1') ->> 'ultima_hba1c')::timestamptz::date
                    = private.data_atual() - 10,
  '1. o hiperdia conta a HbA1c pela data do exame');
SELECT pg_temp.ok((SELECT private.pre_natal_registros(g.id) -> 'testes_1tri' ->> 'hiv' FROM public.pre_natal_gestacoes g
                    WHERE g.paciente_id = '00000000-0000-4000-8000-0000000094c2')::date = private.data_atual() - 20,
  '2. o HIV em gestante feito fora conta no 1º trimestre do pré-natal');
SELECT pg_temp.ok(private.pre_natal_grupo_teste('0202031454') = 'hepatite_b' AND private.pre_natal_grupo_teste('0202031489') = 'hepatite_c',
  '2. os códigos atuais de hepatite em gestante contam no pré-natal');

ROLLBACK;
