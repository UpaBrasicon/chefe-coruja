-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000004_ubs_cid_um_lugar.sql (percurso da UBS,
-- U10). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o CID do SOAP entra em cid_aps na conduta, e o hiperdia vê o I10 digitado
--    só no SOAP;
-- 2. a notificação lê o CID da conduta da UBS, o problema da lista (dengue) e a
--    CIAP-2 (X70, sífilis), com a origem escrita.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000074a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000074a2'),
  ('cons', '00000000-0000-4000-8000-0000000074a3'),
  ('rec',  '00000000-0000-4000-8000-0000000074b1'),
  ('med',  '00000000-0000-4000-8000-0000000074b2');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE TEMP TABLE n (origem text, cid text, agravo text, episodio uuid) ON COMMIT DROP;
GRANT ALL ON n TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u10.local' FROM ids WHERE nome IN ('rec', 'med');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U10');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U10', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['med', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1. CID do SOAP na conduta ───────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep1', (public.registrar_ficha(pg_temp.id('cons'), 'Pressão alta', NULL,
  '{"nome":"Paciente U10 Um","data_nascimento":"1960-02-02","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
INSERT INTO v SELECT 'ep2', (public.registrar_ficha(pg_temp.id('cons'), 'Febre e manchas', NULL,
  '{"nome":"Paciente U10 Dois","data_nascimento":"1985-03-03","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep1'));
SELECT public.registrar_soap(pg_temp.v('ep1'), 'Cefaleia', 'PA 170x100', 'Hipertensão arterial', 'Iniciar tratamento', 'I10');
-- a conduta não repete o I10: só a lista de outro problema
SELECT public.registrar_conduta_aps(pg_temp.v('ep1'), 'consulta_no_dia', '{tabagismo}', '{}', '{retorno_cuidado_continuado}', NULL, '{}');
RESET ROLE;
SELECT pg_temp.ok((SELECT 'I10' = ANY (cid_aps) FROM public.episodios WHERE id = pg_temp.v('ep1')),
  '1. o CID do SOAP entra no CID da conduta');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.programa_participantes WHERE paciente_id = (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.v('ep1'))),
  '1. o hiperdia vê o I10 digitado só no SOAP');
SET LOCAL ROLE authenticated;

-- ── 2. notificação lê a consulta da UBS ─────────────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.v('ep2'));
SELECT public.registrar_soap(pg_temp.v('ep2'), 'Febre há 3 dias', 'Exantema', 'Suspeita de arbovirose', 'Hidratação');
-- sem CID no SOAP, a conduta ainda exige um problema avaliado
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.v('ep2'), 'consulta_no_dia', '{}', '{}', '{alta_episodio}', NULL, '{}')$$,
  'Informe ao menos um problema', '2. sem CID no SOAP, a conduta exige um problema');
SELECT public.registrar_conduta_aps(pg_temp.v('ep2'), 'consulta_no_dia', '{dengue}', '{}', '{alta_episodio}', NULL, '{X70}');
INSERT INTO n SELECT origem, cid, agravo, episodio_id
  FROM public.notificacao_compulsoria_periodo(pg_temp.id('ubs'), private.data_atual(), NULL, NULL);
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM n WHERE episodio = pg_temp.v('ep2') AND cid = 'A90' AND origem = 'Problema da consulta da UBS'),
  '2. dengue da lista de problemas vira sugestão de notificação (A90)');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM n WHERE episodio = pg_temp.v('ep2') AND cid = 'A53.9'),
  '2. CIAP-2 X70 (sífilis) vira sugestão de notificação');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM n WHERE episodio = pg_temp.v('ep1')),
  '2. hipertensão não é notificável: nada aparece');

ROLLBACK;
