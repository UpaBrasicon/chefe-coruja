-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000018_ubs_u12_sugestao_hiperdia.sql (percurso
-- da UBS, U12, parte 2). Tudo em transação com ROLLBACK; o cenário é criado
-- aqui.
--
-- 1. o retorno da UPA com CID I10 vira sugestão de hipertensão no hiperdia da
--    UBS; CID que não é de hipertensão nem diabetes não sugere;
-- 2. quem já está no programa não aparece; a sugestão dispensada com motivo
--    some; a inclusão tira a sugestão;
-- 3. o técnico vê, mas não dispensa; dispensar exige motivo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000095a1'), ('ubs', '00000000-0000-4000-8000-0000000095a2'),
  ('upa', '00000000-0000-4000-8000-0000000095a3'), ('porta', '00000000-0000-4000-8000-0000000095a4'),
  ('enf', '00000000-0000-4000-8000-0000000095b1'), ('tec', '00000000-0000-4000-8000-0000000095b2'),
  ('p1_ubs', '00000000-0000-4000-8000-0000000095c1'), ('p1_upa', '00000000-0000-4000-8000-0000000095c2'),
  ('p2_ubs', '00000000-0000-4000-8000-0000000095c3'), ('p2_upa', '00000000-0000-4000-8000-0000000095c4'),
  ('p3_ubs', '00000000-0000-4000-8000-0000000095c5'), ('p3_upa', '00000000-0000-4000-8000-0000000095c6');
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
CREATE TEMP TABLE r (nome text PRIMARY KEY, j jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u12b.local' FROM ids WHERE nome IN ('enf', 'tec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enf', 'tec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U12 PR2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U12 PR2', 'ubs'), (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U12 PR2', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('porta'), pg_temp.id('upa'), 'Porta', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('tec'), pg_temp.id('ubs'), 'tecnico_enfermagem');
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento)
SELECT pg_temp.id(n), pg_temp.id(CASE WHEN n LIKE '%_ubs' THEN 'ubs' ELSE 'upa' END), 'Paciente ' || n, 'U12B-' || n, 'M', '1960-01-01'
  FROM unnest(ARRAY['p1_ubs', 'p1_upa', 'p2_ubs', 'p2_upa', 'p3_ubs', 'p3_upa']) n;
-- p2 já está no hiperdia (hipertensão)
INSERT INTO public.programa_participantes (unidade_id, paciente_id, programa, origem, entrada_por)
VALUES (pg_temp.id('ubs'), pg_temp.id('p2_ubs'), 'hipertensao', 'manual', pg_temp.id('enf'));
-- os retornos da UPA (episódio encerrado na UPA)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa)
SELECT ('00000000-0000-4000-8000-0000000095d' || i)::uuid, pg_temp.id('upa'), pg_temp.id('p' || i || '_upa'), pg_temp.id('porta'),
       'Pressão alta', pg_temp.id('enf'), 'atendimento'
  FROM generate_series(1, 3) i;
INSERT INTO public.contrarreferencias (organizacao_id, unidade_origem_id, episodio_id, paciente_origem_id, unidade_ubs_id, paciente_ubs_id,
                                       desfecho, saida_em, resumo)
VALUES
  (pg_temp.id('org'), pg_temp.id('upa'), '00000000-0000-4000-8000-0000000095d1', pg_temp.id('p1_upa'), pg_temp.id('ubs'), pg_temp.id('p1_ubs'),
   'alta', now() - interval '2 days', '{"cid":"I10"}'),
  (pg_temp.id('org'), pg_temp.id('upa'), '00000000-0000-4000-8000-0000000095d2', pg_temp.id('p2_upa'), pg_temp.id('ubs'), pg_temp.id('p2_ubs'),
   'alta', now() - interval '3 days', '{"cid":"I10"}'),
  (pg_temp.id('org'), pg_temp.id('upa'), '00000000-0000-4000-8000-0000000095d3', pg_temp.id('p3_upa'), pg_temp.id('ubs'), pg_temp.id('p3_ubs'),
   'alta', now() - interval '1 day', '{"cid":"J06.9"}');

SET LOCAL ROLE authenticated;
-- ── 1 e 2. a lista ──────────────────────────────────────────────────────────
SELECT pg_temp.como('tec');
INSERT INTO r SELECT 'antes', public.hiperdia_sugestoes(pg_temp.id('ubs'));
SELECT pg_temp.ok((SELECT jsonb_array_length(j) = 1 AND j -> 0 ->> 'programa' = 'hipertensao'
                      AND (j -> 0 ->> 'paciente_id')::uuid = pg_temp.id('p1_ubs') AND j -> 0 ->> 'unidade_origem' = 'UPA do U12 PR2'
                     FROM r WHERE nome = 'antes'),
  '1. o retorno com I10 vira sugestão; quem já está no programa e o J06.9 não aparecem');
-- ── 3. o técnico não dispensa ───────────────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.hiperdia_dispensar_sugestao(%L, %L, %L)',
  (SELECT j -> 0 ->> 'contrarreferencia_id' FROM r WHERE nome = 'antes'), 'hipertensao', 'Já acompanha em outro serviço'),
  'Acesso negado: decide o médico ou o enfermeiro', '3. o técnico vê, mas não dispensa');
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.hiperdia_dispensar_sugestao(%L, %L, %L)',
  (SELECT j -> 0 ->> 'contrarreferencia_id' FROM r WHERE nome = 'antes'), 'hipertensao', 'nao'),
  'Diga o motivo de não incluir', '3. dispensar exige motivo');
SELECT public.hiperdia_dispensar_sugestao((SELECT (j -> 0 ->> 'contrarreferencia_id')::uuid FROM r WHERE nome = 'antes'),
  'hipertensao', 'Pressão alta só por dor; a UBS reavalia na consulta');
SELECT pg_temp.ok(jsonb_array_length(public.hiperdia_sugestoes(pg_temp.id('ubs'))) = 0, '2. a sugestão dispensada some');
RESET ROLE;

-- a inclusão também tira a sugestão
DELETE FROM public.programa_sugestoes_dispensadas WHERE unidade_id = pg_temp.id('ubs');
INSERT INTO public.programa_participantes (unidade_id, paciente_id, programa, origem, entrada_por)
VALUES (pg_temp.id('ubs'), pg_temp.id('p1_ubs'), 'hipertensao', 'manual', pg_temp.id('enf'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(jsonb_array_length(public.hiperdia_sugestoes(pg_temp.id('ubs'))) = 0, '2. depois de incluído, não é mais sugerido');
RESET ROLE;

ROLLBACK;
