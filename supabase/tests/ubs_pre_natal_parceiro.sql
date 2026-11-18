-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000011_ubs_pre_natal_parceiro.sql (percurso da
-- UBS, U6, E3: pré-natal do parceiro). Tudo em transação com ROLLBACK; o
-- cenário é criado aqui.
--
-- 1. a ficha "pré-natal do parceiro" pede a gestante com pré-natal ativo e grava
--    a ligação;
-- 2. na ficha da parceria o enfermeiro pede só os exames da parceria; na ficha
--    da gestante, os exames da parceria são recusados;
-- 3. a consulta da parceria fecha com CIAP A29 e o pré-natal da gestante mostra
--    a parceria, a consulta e a situação dos exames.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000083a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000083a2'),
  ('cons', '00000000-0000-4000-8000-0000000083a3'),
  ('rec',  '00000000-0000-4000-8000-0000000083b1'),
  ('enf',  '00000000-0000-4000-8000-0000000083b2'),
  ('med',  '00000000-0000-4000-8000-0000000083b3');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u6p.local' FROM ids WHERE nome IN ('rec', 'enf', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U6 parceiro');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U6 parceiro', 'ubs');
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

-- o CI não tem a tabela SIGTAP inteira: os códigos do teste entram aqui (na homologação já existem)
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0202031624', 'TESTE NAO TREPONEMICO P/ DETECCAO DE SIFILIS EM PARCEIRO OU PARCERIA DE GESTANTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0202020380', 'HEMOGRAMA COMPLETO', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0202031519', 'PESQUISA LABORATORIAL DE HIV EM GESTANTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM')),
  ('0202031527', 'PESQUISA LABORATORIAL DE HIV EM PARCEIRO E PARCERIA DE GESTANTE', '1', 'I', 0, 1560, to_char(now(), 'YYYYMM'))
ON CONFLICT (codigo) DO NOTHING;

-- a gestante, com pré-natal ativo na UBS
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento)
VALUES ('00000000-0000-4000-8000-0000000083c1', pg_temp.id('ubs'), 'Gestante do Parceiro', 'PNP-1', 'F', '1996-04-04');
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento)
VALUES ('00000000-0000-4000-8000-0000000083c2', pg_temp.id('ubs'), 'Mulher Sem Pre-natal', 'PNP-2', 'F', '1990-02-02');
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum, entrada_por)
VALUES (pg_temp.id('ubs'), '00000000-0000-4000-8000-0000000083c1', 'manual', private.data_atual() - 70, pg_temp.id('enf'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');

-- ── 1. a ficha pede a gestante ──────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal do parceiro', NULL,
  '{"nome":"Parceiro Um","data_nascimento":"1992-01-01","sexo":"M","tipo_atendimento":"pre_natal_parceiro","destino":"enfermagem"}')$$,
  'Escolha a gestante do pré-natal do parceiro', '1. sem gestante, recusa');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal do parceiro', NULL,
  '{"nome":"Parceiro Um","data_nascimento":"1992-01-01","sexo":"M","tipo_atendimento":"pre_natal_parceiro","destino":"enfermagem","gestante_id":"00000000-0000-4000-8000-0000000083c2"}')$$,
  'A gestante não tem pré-natal ativo nesta UBS', '1. gestante sem pré-natal ativo, recusa');
INSERT INTO v SELECT 'par', (public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal do parceiro', NULL,
  '{"nome":"Parceiro Um","data_nascimento":"1992-01-01","sexo":"M","tipo_atendimento":"pre_natal_parceiro","destino":"enfermagem","gestante_id":"00000000-0000-4000-8000-0000000083c1"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'gest', (public.registrar_ficha(pg_temp.id('cons'), 'Pré-natal: retorno', '00000000-0000-4000-8000-0000000083c1',
  '{"tipo_atendimento":"consulta_programada","destino":"enfermagem"}') ->> 'episodio_id')::uuid;
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.pre_natal_parcerias l JOIN public.pre_natal_gestacoes g ON g.id = l.gestacao_id
                    WHERE l.episodio_id = pg_temp.v('par') AND g.paciente_id = '00000000-0000-4000-8000-0000000083c1'),
  '1. a ficha da parceria fica ligada à gestação');
SET LOCAL ROLE authenticated;

-- ── 2. exames ───────────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT public.iniciar_atendimento(pg_temp.v('par'));
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('par'), '[{"procedimento":"0202031624"},{"procedimento":"0202020380"}]') = 2,
  '2. o enfermeiro pede VDRL e hemograma da parceria');
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('par'), '[{"procedimento":"0202031519"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. HIV de gestante na ficha da parceria, recusa');
SELECT public.iniciar_atendimento(pg_temp.v('gest'));
SELECT pg_temp.falha($$SELECT public.pedir_exames(pg_temp.v('gest'), '[{"procedimento":"0202031527"}]')$$,
  'Exame fora do protocolo de enfermagem', '2. HIV da parceria na ficha da gestante, recusa');
SELECT pg_temp.ok(public.pedir_exames(pg_temp.v('gest'), '[{"procedimento":"0202031519"}]') = 1,
  '2. na ficha da gestante, o HIV de gestante segue');

-- ── 3. consulta da parceria e pré-natal ─────────────────────────────────────
SELECT public.registrar_soap(pg_temp.v('par'), 'Pré-natal do parceiro, sem queixas', 'PA 120x80', 'Pré-natal do parceiro',
  'Exames e testes rápidos', NULL);
SELECT public.registrar_conduta_aps(pg_temp.v('par'), 'pre_natal_parceiro', '{}', '{}',
  '{retorno_consulta_agendada}', 'Retorno com os exames', '{A29}');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND tipo_atendimento_aps = 'pre_natal_parceiro' AND 'A29' = ANY (ciap_aps)
                     FROM public.episodios WHERE id = pg_temp.v('par')),
  '3. a consulta da parceria fecha com o tipo novo e CIAP A29');
SELECT pg_temp.ok((SELECT r -> 'parceria' ->> 'nome' = 'Parceiro Um'
                      AND (r -> 'parceria' ->> 'consultas')::int = 1
                      AND jsonb_array_length(r -> 'parceria' -> 'exames') = 2
                      AND NOT (r -> 'parceria')::text LIKE '%resultado%'
                     FROM (SELECT private.pre_natal_registros(g.id) r FROM public.pre_natal_gestacoes g
                            WHERE g.paciente_id = '00000000-0000-4000-8000-0000000083c1') s),
  '3. o pré-natal da gestante mostra a parceria, a consulta e os dois exames pedidos');
SELECT pg_temp.ok('pre_natal_parceiro' = ANY (private.lista_aps('tipo_atendimento')), '3. o tipo novo está na lista da ficha');

ROLLBACK;
