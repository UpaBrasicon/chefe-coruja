-- ════════════════════════════════════════════════════════════════════════════
-- Testes das migrations 20270211000001_tipo_setor_consultorio.sql e
-- 20270211000002_atendimento_ubs.sql (5A, tarefa 2, parte 2.1). Tudo em
-- transação com ROLLBACK. O cenário é criado aqui, sem depender do seed; roda
-- também na homologação.
--
-- 1. ficha: na UBS só no consultório e com o tipo de atendimento; o
--    consultório de uma UPA é recusado; a porta da UPA segue em triagem;
-- 2. consulta: médico fora da escala não abre; desfecho da porta recusado na
--    UBS; a conduta exige atendimento aberto, SOAP com Avaliação, tipo, ao
--    menos um problema (lista ou CID-10) e uma conduta, todos da ficha;
-- 3. conduta encerra a consulta, com auditoria; não encerra duas vezes;
-- 4. evasão na UBS pelo desfecho; conduta recusada no episódio da porta;
-- 5. BPA: a UBS não gera linha (a mesma unidade como UPA gera);
-- 6. as listas da RPC e dos CHECKs são iguais.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000052a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000052a2'),
  ('upa',  '00000000-0000-4000-8000-0000000052a3'),
  ('cons', '00000000-0000-4000-8000-0000000052a4'),
  ('eubs', '00000000-0000-4000-8000-0000000052a5'),
  ('cupa', '00000000-0000-4000-8000-0000000052a6'),
  ('eupa', '00000000-0000-4000-8000-0000000052a7'),
  ('rec',  '00000000-0000-4000-8000-0000000052a8'),
  ('med',  '00000000-0000-4000-8000-0000000052a9'),
  ('med2', '00000000-0000-4000-8000-0000000052aa'),
  ('recu', '00000000-0000-4000-8000-0000000052ab'),
  ('medu', '00000000-0000-4000-8000-0000000052ac');
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
CREATE TEMP TABLE epi (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON epi TO authenticated;
CREATE FUNCTION pg_temp.e(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM epi WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.e(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@5a2.local' FROM ids WHERE nome IN ('rec', 'med', 'med2', 'recu', 'medu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'med', 'med2', 'recu', 'medu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do 5A2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do 5A2', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do 5A2', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('eubs'), pg_temp.id('ubs'), 'Sala de urgência', 'emergencia'),
  (pg_temp.id('cupa'), pg_temp.id('upa'), 'Consultório da UPA', 'consultorio'),
  (pg_temp.id('eupa'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao'),
  (pg_temp.id('medu'), pg_temp.id('upa'), 'plantonista');
-- de plantão agora, com check-in: recepção e médico no consultório da UBS;
-- recepção e médico na porta da UPA. O med2 é da UBS, mas não está na escala.
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('rec')),
               (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med')),
               (pg_temp.id('upa'), pg_temp.id('eupa'), pg_temp.id('recu')),
               (pg_temp.id('upa'), pg_temp.id('eupa'), pg_temp.id('medu'))) v(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa'))
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1. ficha ────────────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('eubs'), 'Cefaleia', NULL, '{"nome":"Paciente Um UBS","tipo_atendimento":"consulta_no_dia"}')$$,
  'Na UBS, a ficha abre num consultório', 'na UBS, a ficha não abre na sala de urgência');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Cefaleia', NULL, '{"nome":"Paciente Um UBS"}')$$,
  'Informe o tipo de atendimento da UBS', 'ficha da UBS exige o tipo de atendimento');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Cefaleia', NULL, '{"nome":"Paciente Um UBS","tipo_atendimento":"retorno"}')$$,
  'Informe o tipo de atendimento da UBS', 'tipo de atendimento fora da ficha é recusado');
INSERT INTO epi SELECT 'um', (public.registrar_ficha(pg_temp.id('cons'), 'Cefaleia há 3 dias', NULL,
  '{"nome":"Paciente Um UBS","data_nascimento":"1980-05-10","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
INSERT INTO epi SELECT 'dois', (public.registrar_ficha(pg_temp.id('cons'), 'Renovação de receita', NULL,
  '{"nome":"Paciente Dois UBS","data_nascimento":"1975-02-03","tipo_atendimento":"consulta_programada"}') ->> 'episodio_id')::uuid;
SELECT pg_temp.como('recu');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cupa'), 'Dor', NULL, '{"nome":"Paciente UPA"}')$$,
  'A ficha abre numa porta', 'consultório de UPA não abre ficha');
INSERT INTO epi SELECT 'porta', (public.registrar_ficha(pg_temp.id('eupa'), 'Dor abdominal', NULL,
  '{"nome":"Paciente Porta UPA","data_nascimento":"1990-01-01","tipo_atendimento":"consulta_no_dia"}') ->> 'episodio_id')::uuid;
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'atendimento' AND tipo_atendimento_aps = 'consulta_no_dia' AND cor_atual IS NULL
                     FROM public.episodios WHERE id = pg_temp.e('um')), 'ficha da UBS nasce em atendimento, sem classificação');
SELECT pg_temp.ok((SELECT etapa = 'triagem' AND tipo_atendimento_aps IS NULL FROM public.episodios WHERE id = pg_temp.e('porta')),
  'ficha da porta segue em triagem, sem o tipo da UBS');
SET LOCAL ROLE authenticated;

-- ── 2. consulta ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('med2');
SELECT pg_temp.falha($$SELECT public.iniciar_atendimento(pg_temp.e('um'))$$, 'Acesso negado', 'médico fora da escala não abre a consulta');
SELECT pg_temp.como('med');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{diabetes}', '{}', '{alta_episodio}')$$,
  'Abra o atendimento', 'conduta só com o atendimento aberto');
SELECT public.iniciar_atendimento(pg_temp.e('um'));
SELECT pg_temp.falha($$SELECT public.registrar_desfecho(pg_temp.e('um'), 'alta')$$,
  'Na UBS, a consulta encerra pela conduta', 'desfecho da porta recusado na UBS');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{diabetes}', '{}', '{alta_episodio}')$$,
  'Registre o atendimento (SOAP)', 'conduta exige o SOAP com Avaliação');
SELECT public.registrar_soap(pg_temp.e('um'), 'Cefaleia frontal há 3 dias', 'PA 150x95, sem sinais focais',
  'Cefaleia tensional; HAS sem controle', 'Analgésico, ajuste do anti-hipertensivo', 'G44.2');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{}', '{}', '{alta_episodio}')$$,
  'Informe ao menos um problema', 'conduta exige ao menos um problema ou CID');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{cefaleia}', '{}', '{alta_episodio}')$$,
  'Problema/condição avaliada fora da lista', 'problema fora da lista da ficha é recusado');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{hipertensao_arterial}', '{}', '{}')$$,
  'Informe ao menos uma conduta', 'conduta exige ao menos uma conduta');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{hipertensao_arterial}', '{}', '{receita}')$$,
  'Conduta fora da lista', 'conduta fora da lista da ficha é recusada');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta', '{hipertensao_arterial}', '{}', '{alta_episodio}')$$,
  'Informe o tipo de atendimento', 'tipo de atendimento fora da ficha é recusado na conduta');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{}', '{XX}', '{alta_episodio}')$$,
  'CID fora do formato', 'CID-10 em formato inválido é recusado');

-- ── 3. conduta encerra ──────────────────────────────────────────────────────
SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{hipertensao_arterial,hipertensao_arterial}',
  '{g44.2}', '{retorno_cuidado_continuado,encaminhamento_interno}', 'Retorno em 30 dias com o MAPA');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('um'), 'consulta_no_dia', '{diabetes}', '{}', '{alta_episodio}')$$,
  'A consulta já foi encerrada', 'consulta encerrada não recebe outra conduta');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND encerrado_por = pg_temp.id('med') AND desfecho IS NULL AND desfecho_por = pg_temp.id('med')
                          AND problemas_aps = '{hipertensao_arterial}' AND cid_aps = '{G44.2}'
                          AND conduta_aps = '{encaminhamento_interno,retorno_cuidado_continuado}'
                          AND desfecho_motivo = 'Retorno em 30 dias com o MAPA'
                     FROM public.episodios WHERE id = pg_temp.e('um')), 'conduta encerra a consulta com a ficha preenchida');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.e('um') AND acao = 'consulta_aps_encerrada'
                     AND payload ->> 'tipo' = 'consulta_no_dia' AND payload ->> 'status' = 'encerrado'), 'auditoria consulta_aps_encerrada');
SET LOCAL ROLE authenticated;

-- ── 4. evasão na UBS; conduta não serve à porta ─────────────────────────────
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.e('dois'));
SELECT public.registrar_desfecho(pg_temp.e('dois'), 'evasao', 'Chamado duas vezes no consultório, não estava');
SELECT pg_temp.como('medu');
SELECT pg_temp.falha($$SELECT public.registrar_conduta_aps(pg_temp.e('porta'), 'consulta_no_dia', '{diabetes}', '{}', '{alta_episodio}')$$,
  'A conduta da ficha da atenção primária é só da consulta da UBS', 'conduta da UBS recusada no episódio da porta');
RESET ROLE;
SELECT pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho = 'evasao' FROM public.episodios WHERE id = pg_temp.e('dois')),
  'evasão na UBS pelo desfecho');

-- ── 5. BPA ──────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) = 0 FROM private.bpa_i_linhas(pg_temp.id('ubs'), private.competencia_de(now()))),
  'a UBS não gera linha de BPA');
ALTER TABLE public.unidades DISABLE TRIGGER USER;
UPDATE public.unidades SET tipo = 'upa' WHERE id = pg_temp.id('ubs');
SELECT pg_temp.ok((SELECT count(*) > 0 FROM private.bpa_i_linhas(pg_temp.id('ubs'), private.competencia_de(now()))),
  'a mesma unidade como UPA gera a linha do atendimento');
UPDATE public.unidades SET tipo = 'ubs' WHERE id = pg_temp.id('ubs');
ALTER TABLE public.unidades ENABLE TRIGGER USER;

-- ── 6. listas da RPC e dos CHECKs iguais ────────────────────────────────────
SELECT pg_temp.ok((SELECT bool_and(
          (SELECT array_agg(m[1] ORDER BY m[1]) FROM regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') m)
          = (SELECT array_agg(x ORDER BY x) FROM unnest(private.lista_aps(l.lista)) x)) AND count(*) = 3
     FROM (VALUES ('episodios_tipo_atendimento_aps_check', 'tipo_atendimento'),
                  ('episodios_problemas_aps_check', 'problema'),
                  ('episodios_conduta_aps_check', 'conduta')) l(con, lista)
     JOIN pg_constraint c ON c.conname = l.con AND c.conrelid = 'public.episodios'::regclass),
  'as listas da RPC e dos CHECKs são iguais');

SELECT '5a_atendimento_ubs ok' AS resultado;
ROLLBACK;
