-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000032_ubs_u15_vacina_cancelada_enviada.sql
-- (Percurso da UBS, U15, vacina). Tudo em transação com ROLLBACK.
--
-- 1. RNDS: vacina cancelada com o RIA já enviado põe na fila a exclusão,
--    assinada por quem cancelou; a carga é {"acao": "excluir"} e o id RNDS a
--    excluir vem em id_rnds_anterior; cancelada antes do envio, só descarta;
-- 2. SISAB: a Ficha de Vacinação enviada fica com o aviso para o PEC.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000127a1'),
  ('ubs', '00000000-0000-4000-8000-0000000127a2'),
  ('enf', '00000000-0000-4000-8000-0000000127b1'),
  ('ger', '00000000-0000-4000-8000-0000000127b2'),
  ('pac', '00000000-0000-4000-8000-0000000127c1');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
CREATE FUNCTION pg_temp.nova(p_nome text) RETURNS void LANGUAGE sql AS $$
  WITH x AS (
    INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, dose, via, local, registrado_por)
    VALUES (pg_temp.id('ubs'), pg_temp.id('pac'), true, date '2020-01-01', 9, 1, 3, 18, pg_temp.id('enf')) RETURNING id)
  INSERT INTO v SELECT p_nome, id FROM x $$;
CREATE FUNCTION pg_temp.cancelar(p_nome text) RETURNS void LANGUAGE sql AS $$
  UPDATE public.vacinacoes SET cancelado_em = now(), cancelado_por = pg_temp.id('ger'), motivo_cancelamento = 'lançada no paciente errado'
   WHERE id = pg_temp.v(p_nome) $$;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15canc.local' FROM ids WHERE nome IN ('enf', 'ger');
INSERT INTO public.perfis (id, nome_completo, cns, cbo) VALUES
  (pg_temp.id('enf'), 'Enfermeira', '700000000000005', '223505'), (pg_temp.id('ger'), 'Gestora', '700000000000013', '131210')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cns = EXCLUDED.cns, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 cancelada');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS cancelada', 'ubs', '9912347');
INSERT INTO public.rnds_config_unidade (unidade_id, financiamento) VALUES (pg_temp.id('ubs'), '07');
INSERT INTO public.pacientes (id, unidade_id, nome, sexo, data_nascimento, cpf) VALUES
  (pg_temp.id('pac'), pg_temp.id('ubs'), 'Paciente Cancelada', 'M', date '1990-01-01', '52998224725');

-- ── 1. RNDS ─────────────────────────────────────────────────────────────────
SELECT pg_temp.nova('enviada');
UPDATE public.interop_outbox SET status = 'enviado', id_rnds = 'rnds-123', enviado_em = now()
 WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('enviada');
UPDATE public.ledi_fila SET status = 'enviado', enviado_em = now() WHERE tipo = 'fv' AND referencia_id = pg_temp.v('enviada');
SELECT pg_temp.cancelar('enviada');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.interop_outbox
                    WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('enviada') AND payload ->> 'acao' = 'excluir'
                      AND status = 'pendente' AND profissional_id = pg_temp.id('ger')),
  '1. RIA enviado: a exclusão entra na fila, assinada por quem cancelou');
SELECT pg_temp.ok((SELECT status = 'enviado' FROM public.interop_outbox
                    WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('enviada') AND id_rnds = 'rnds-123'),
  '1. o RIA enviado continua como enviado');
SELECT pg_temp.ok((SELECT j -> 'dados' = '{"acao": "excluir"}'::jsonb AND j #>> '{envio,id_rnds_anterior}' = 'rnds-123'
                          AND j #>> '{envio,profissional_cns}' = '700000000000013'
                     FROM (SELECT public.rnds_dados_documento(o.id) AS j FROM public.interop_outbox o
                            WHERE o.tipo_documento = 'ria' AND o.referencia_id = pg_temp.v('enviada') AND o.payload ->> 'acao' = 'excluir') x),
  '1. a carga da exclusão traz o id RNDS do RIA enviado e o CNS de quem cancelou');
-- a exclusão enviada não vira o "anterior" de ninguém
UPDATE public.interop_outbox SET status = 'enviado', id_rnds = 'rnds-123', enviado_em = now() + interval '1 minute'
 WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('enviada') AND payload ->> 'acao' = 'excluir';
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.interop_outbox
                    WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('enviada') AND payload ->> 'acao' = 'excluir'),
  '1. só uma exclusão por vacina');

SELECT pg_temp.nova('pendente');
SELECT pg_temp.cancelar('pendente');
SELECT pg_temp.ok((SELECT bool_and(status = 'descartado') AND bool_and(coalesce(payload ->> 'acao', '') <> 'excluir')
                     FROM public.interop_outbox WHERE tipo_documento = 'ria' AND referencia_id = pg_temp.v('pendente')),
  '1. cancelada antes do envio: só descarta, sem exclusão');

-- ── 2. SISAB ────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT status = 'enviado' AND ultimo_erro LIKE 'vacina cancelada no app depois do envio%'
                     FROM public.ledi_fila WHERE tipo = 'fv' AND referencia_id = pg_temp.v('enviada')),
  '2. a Ficha de Vacinação enviada fica com o aviso para excluir no PEC');
SELECT pg_temp.ok((SELECT status = 'descartado' FROM public.ledi_fila WHERE tipo = 'fv' AND referencia_id = pg_temp.v('pendente')),
  '2. a ficha ainda não enviada é descartada');

ROLLBACK;
