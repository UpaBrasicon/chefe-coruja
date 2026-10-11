-- Fase 4, tarefa 8 — migration 20261114000001_mapa_vagas.sql: mapa simples de
-- vagas. Cobre:
-- - oferta do setor com o tipo de leito da regulação (só o gestor da unidade);
-- - contagem dos leitos ofertados por situação; setor não ofertado fica fora;
-- - serviços: cadastro, validação, atualização, confirmação, desativação,
--   histórico e "desatualizado" depois de 12 h;
-- - quem vê o mapa (regulador e gestor da central, gestor das unidades) e quem
--   edita (só o gestor da própria unidade); sem nome de paciente.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0206010079', 'TOMOGRAFIA DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-0000000009f0', 'Rede das Vagas');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-0000000009f0', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009f1'::uuid, 'UPA Vagas', '7654482'),
               ('21000000-0000-4000-8000-0000000009f2'::uuid, 'Hospital Vagas', '7654490'),
               ('21000000-0000-4000-8000-0000000009f3'::uuid, 'Central Vagas', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009f0', '21000000-0000-4000-8000-0000000009f3', '10000000-0000-4000-8000-000000000003');
-- hospital: UTI (3 leitos), enfermaria (3 leitos), sala não ofertada (1 leito)
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT x.id, '21000000-0000-4000-8000-0000000009f2', x.nome, tipo
  FROM public.setores, (VALUES ('22000000-0000-4000-8000-0000000009f1'::uuid, 'UTI'), ('22000000-0000-4000-8000-0000000009f2'::uuid, 'Enfermaria'),
                               ('22000000-0000-4000-8000-0000000009f3'::uuid, 'Sala de espera')) x(id, nome)
 WHERE setores.id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.leitos (setor_id, identificador, status) VALUES
  ('22000000-0000-4000-8000-0000000009f1', 'UTI-1', 'livre'), ('22000000-0000-4000-8000-0000000009f1', 'UTI-2', 'ocupado'),
  ('22000000-0000-4000-8000-0000000009f1', 'UTI-3', 'higienizacao'),
  ('22000000-0000-4000-8000-0000000009f2', 'ENF-1', 'livre'), ('22000000-0000-4000-8000-0000000009f2', 'ENF-2', 'reservado'),
  ('22000000-0000-4000-8000-0000000009f2', 'ENF-3', 'bloqueado'),
  ('22000000-0000-4000-8000-0000000009f3', 'SALA-1', 'livre');
-- 001 gestor do hospital; 002 médico do hospital; 003 gestor da UPA; 006 regulador da central
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009f2', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009f2', 'plantonista'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-0000000009f1', 'gestor'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009f3', 'regulador');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
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
-- unidade do mapa por id
CREATE FUNCTION pg_temp.un(m jsonb, id text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT u FROM jsonb_array_elements(m->'unidades') u WHERE u->>'id' = id $$;
CREATE FUNCTION pg_temp.leito(u jsonb, tipo text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT l FROM jsonb_array_elements(u->'leitos') l WHERE l->>'tipo_leito' = tipo $$;

SET LOCAL ROLE authenticated;
-- ── 1. oferta dos setores ───────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_ofertar_setor('22000000-0000-4000-8000-0000000009f1', 'uti_adulto')$$,
  'Quem informa a oferta da unidade é o gestor dela', 'médico não oferta setor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.regulacao_ofertar_setor('22000000-0000-4000-8000-0000000009f1', 'uti_adulto')$$,
  'Quem informa a oferta da unidade é o gestor dela', 'gestor de outra unidade não oferta setor do hospital');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.regulacao_ofertar_setor('22000000-0000-4000-8000-0000000009f1', 'uti_lunar')$$,
  'Tipo de leito fora da lista da regulação', 'tipo fora da lista');
SELECT public.regulacao_ofertar_setor('22000000-0000-4000-8000-0000000009f1', 'uti_adulto');
SELECT public.regulacao_ofertar_setor('22000000-0000-4000-8000-0000000009f2', 'clinico');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.regulacao_setores_oferta('21000000-0000-4000-8000-0000000009f2')) s
                    WHERE s->>'regulacao_tipo_leito' IS NOT NULL) = 2
              AND jsonb_array_length(public.regulacao_setores_oferta('21000000-0000-4000-8000-0000000009f2')) = 3,
  'gestor vê os três setores e dois ofertados');

-- ── 2. leitos no mapa ───────────────────────────────────────────────────────
INSERT INTO t SELECT 'mapa_hosp', public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2')::text;
SELECT pg_temp.ok((pg_temp.leito(pg_temp.un(pg_temp.v('mapa_hosp')::jsonb, '21000000-0000-4000-8000-0000000009f2'), 'uti_adulto')
                   = '{"tipo_leito":"uti_adulto","livre":1,"reservado":0,"higienizacao":1,"bloqueado":0,"ocupado":1,"total":3}'::jsonb),
  'UTI adulto: 1 livre, 1 higienização, 1 ocupado, total 3');
SELECT pg_temp.ok((pg_temp.leito(pg_temp.un(pg_temp.v('mapa_hosp')::jsonb, '21000000-0000-4000-8000-0000000009f2'), 'clinico')
                   = '{"tipo_leito":"clinico","livre":1,"reservado":1,"higienizacao":0,"bloqueado":1,"ocupado":0,"total":3}'::jsonb),
  'clínico: 1 livre, 1 reservado, 1 bloqueado');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.un(pg_temp.v('mapa_hosp')::jsonb, '21000000-0000-4000-8000-0000000009f2')->'leitos') = 2
              AND (SELECT sum((x->>'total')::int) FROM jsonb_array_elements(pg_temp.v('mapa_hosp')::jsonb->'totais') x) = 6,
  'setor não ofertado fica fora do mapa e dos totais');
SELECT pg_temp.ok(pg_temp.un(pg_temp.v('mapa_hosp')::jsonb, '21000000-0000-4000-8000-0000000009f3') IS NULL,
  'a central não aparece como unidade do mapa');
SELECT pg_temp.ok(pg_temp.v('mapa_hosp') NOT LIKE '%paciente%', 'mapa sem dado de paciente');

-- ── 3. serviços ─────────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_servico('21000000-0000-4000-8000-0000000009f2', NULL, '{"nome":"Tomografia","tipo":"exame","situacao":"talvez"}')$$,
  'Situação: disponível, restrito ou indisponível', 'situação fora da lista');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_servico('21000000-0000-4000-8000-0000000009f2', NULL, '{"nome":"Tomografia","tipo":"exame","situacao":"disponivel","procedimento":"9999999999"}')$$,
  'Procedimento SIGTAP não encontrado', 'SIGTAP inexistente');
SELECT pg_temp.falha($$SELECT public.regulacao_salvar_servico('21000000-0000-4000-8000-0000000009f2', NULL, '{"nome":"Tomografia","tipo":"exame","situacao":"disponivel","vagas":"-1"}')$$,
  'Vagas: número de 0 a 9999', 'vagas negativas');
INSERT INTO t SELECT 'tc', public.regulacao_salvar_servico('21000000-0000-4000-8000-0000000009f2', NULL,
  '{"nome":"Tomografia","tipo":"exame","situacao":"disponivel","procedimento":"0206010079","vagas":"4","observacao":"Até 22h"}')::text;
SELECT public.regulacao_salvar_servico('21000000-0000-4000-8000-0000000009f2', pg_temp.v('tc')::uuid,
  '{"nome":"Tomografia","tipo":"exame","situacao":"restrito","procedimento":"0206010079","vagas":"1","observacao":"Um aparelho em manutenção"}');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha(format('SELECT public.regulacao_confirmar_servico(%L)', pg_temp.v('tc')),
  'Quem informa a oferta da unidade é o gestor dela', 'gestor de outra unidade não confirma o serviço do hospital');
SELECT pg_temp.falha(format('SELECT public.regulacao_salvar_servico(%L, %L, %L)', '21000000-0000-4000-8000-0000000009f1', pg_temp.v('tc'),
    '{"nome":"Tomografia","tipo":"exame","situacao":"indisponivel"}'),
  'Serviço não encontrado', 'serviço de outra unidade não se edita pela própria');

-- ── 4. quem vê ──────────────────────────────────────────────────────────────
SELECT pg_temp.ok((pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f1'), '21000000-0000-4000-8000-0000000009f2')->'servicos'->0->>'situacao') = 'restrito'
              AND NOT (pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f1'), '21000000-0000-4000-8000-0000000009f2')->>'editavel')::boolean
              AND (pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f1'), '21000000-0000-4000-8000-0000000009f1')->>'editavel')::boolean,
  'gestor da UPA vê a rede e edita só a dele');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f3'), '21000000-0000-4000-8000-0000000009f2') IS NOT NULL,
  'regulador da central vê o mapa');
SELECT pg_temp.falha($$SELECT public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2')$$, 'Acesso negado',
  'regulador não vê pelo hospital, onde não tem papel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2')$$, 'Acesso negado', 'médico não vê o mapa');

-- ── 5. desatualizado, confirmar, desativar, histórico ───────────────────────
RESET ROLE;
UPDATE public.regulacao_servicos SET atualizado_em = now() - interval '13 hours', confirmado_em = now() - interval '13 hours' WHERE id = pg_temp.v('tc')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2'), '21000000-0000-4000-8000-0000000009f2')->'servicos'->0->>'desatualizado')::boolean,
  '13 h sem confirmar: desatualizado');
SELECT public.regulacao_confirmar_servico(pg_temp.v('tc')::uuid);
SELECT pg_temp.ok(NOT (pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2'), '21000000-0000-4000-8000-0000000009f2')->'servicos'->0->>'desatualizado')::boolean
              AND (pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2'), '21000000-0000-4000-8000-0000000009f2')->'servicos'->0->>'situacao') = 'restrito',
  'confirmar renova sem mudar a situação');
SELECT public.regulacao_desativar_servico(pg_temp.v('tc')::uuid);
SELECT pg_temp.ok(jsonb_array_length(pg_temp.un(public.regulacao_mapa_vagas('21000000-0000-4000-8000-0000000009f2'), '21000000-0000-4000-8000-0000000009f2')->'servicos') = 0,
  'serviço desativado sai do mapa');
RESET ROLE;
SELECT pg_temp.ok((SELECT string_agg(acao, ',' ORDER BY em, acao) FROM public.regulacao_servicos_historico WHERE servico_id = pg_temp.v('tc')::uuid)
                  IN ('atualizado,confirmado,criado,desativado', 'criado,atualizado,confirmado,desativado')
              AND (SELECT count(*) FROM public.regulacao_servicos_historico WHERE servico_id = pg_temp.v('tc')::uuid) = 4,
  'histórico: criado, atualizado, confirmado, desativado');
SELECT pg_temp.falha(format('DELETE FROM public.regulacao_servicos_historico WHERE servico_id = %L', pg_temp.v('tc')), 'regulacao_servicos_historico é só de inserção', 'histórico não se apaga');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'regulacao_setor_ofertado' AND payload->>'tipo' = 'uti_adulto'),
  'oferta do setor na auditoria');

ROLLBACK;
