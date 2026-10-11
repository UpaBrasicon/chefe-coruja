-- Fase 4, tarefa 1 — migration 20261107000001_regulacao_solicitacao.sql:
-- solicitação de regulação. Cobre:
-- - central por organização (só o super admin define);
-- - quem abre (médico e gestor da origem; enfermeiro não); sem central não abre;
-- - os quatro tipos com o campo de cada um; destino na rede, fora ou a definir;
-- - CID-10 e SIGTAP conferidos; justificativa mínima;
-- - vínculo com atendimento aberto ou só com o paciente;
-- - médico assistente (o próprio médico; o gestor informa um médico da unidade);
-- - listas da origem e da central; detalhe com histórico; quem não vê;
-- - cancelamento com motivo; registro externo só pelo regulador da central.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('I21.9', 'CID do teste I21.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0206010079', 'TOMOGRAFIA DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
-- rede de teste: organização própria com UPA (origem), hospital (destino) e central
INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000097', 'Rede da Regulação');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000097', x.nome, u.tipo, NULL, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000971'::uuid, 'UPA Origem'), ('21000000-0000-4000-8000-000000000972'::uuid, 'Hospital Destino'),
               ('21000000-0000-4000-8000-000000000973'::uuid, 'Central de Regulação')) x(id, nome)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000971', 'Porta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000971', 'plantonista'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000971', 'gestor'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000971', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000973', 'regulador');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
VALUES ('23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000971', 'Paciente Regulado', '1960-02-03', 'R-1',
        '22000000-0000-4000-8000-000000000971', 'M');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971',
        '22000000-0000-4000-8000-000000000971', 'atendimento', 'Dor torácica', '10000000-0000-4000-8000-000000000004', now() - interval '1 hour');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
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
-- pedido base (leito de UTI para o hospital da rede), com sobrescrita
CREATE FUNCTION pg_temp.pedido(extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('tipo', 'leito', 'tipo_leito', 'uti_adulto', 'destino_tipo', 'rede',
    'destino_unidade_id', '21000000-0000-4000-8000-000000000972', 'prioridade', 'emergencia', 'cid', 'I21.9',
    'justificativa', 'IAM com supra, trombólise feita, precisa de UTI e hemodinâmica.') || extra $$;
GRANT EXECUTE ON FUNCTION pg_temp.pedido(jsonb) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. central ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido())$$,
  'A rede ainda não tem Central de Regulação', 'sem central não se solicita');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.regulacao_definir_central('21000000-0000-4000-8000-000000000973')$$,
  'Só a administração da plataforma define', 'gestor não define a central');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.regulacao_definir_central('21000000-0000-4000-8000-000000000973');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(public.regulacao_centrais()) o
                           WHERE o->>'organizacao' = 'Rede da Regulação' AND o->'central'->>'nome' = 'Central de Regulação'),
  'super admin vê a central da organização');

-- ── 2. quem abre e validações ───────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido())$$,
  'Abre a solicitação o médico ou o gestor', 'enfermeiro não abre');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok((public.regulacao_contexto('21000000-0000-4000-8000-000000000971')->'central'->>'nome') = 'Central de Regulação'
              AND (public.regulacao_contexto('21000000-0000-4000-8000-000000000971')->>'pode_solicitar')::boolean
              AND jsonb_array_length(public.regulacao_contexto('21000000-0000-4000-8000-000000000971')->'unidades_rede') = 2,
  'contexto: central da rede e destinos (sem a central)');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"cid": "Z99.99"}'))$$,
  'Informe um CID-10 válido', 'CID inexistente recusado');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"justificativa": "curta"}'))$$,
  'Confira o pedido', 'justificativa curta recusada');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"tipo_leito": null}'))$$,
  'Confira o pedido', 'leito sem tipo de leito recusado');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"destino_unidade_id": "21000000-0000-4000-8000-000000000973"}'))$$,
  'O destino precisa ser uma unidade ativa da rede', 'a central não é destino');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"destino_unidade_id": "21000000-0000-4000-8000-000000000001"}'))$$,
  'O destino precisa ser uma unidade ativa da rede', 'unidade de outra rede não é destino');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"tipo": "exame", "procedimento": "9999999999"}'))$$,
  'Informe um procedimento do SIGTAP', 'exame com procedimento inexistente');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', pg_temp.pedido('{"episodio_id": "25000000-0000-4000-8000-000000000001"}'))$$,
  'O atendimento informado não está aberto', 'atendimento de outro paciente recusado');

-- médico: leito de UTI ligado ao atendimento aberto; CID sem ponto aceito
INSERT INTO t SELECT 's1', public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971',
  pg_temp.pedido('{"cid": "i219", "episodio_id": "25000000-0000-4000-8000-000000000971"}'))->>'id';
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'enviada' AND cid = 'I21.9' AND solicitante_papel = 'medico'
                          AND medico_assistente_id = '10000000-0000-4000-8000-000000000002'
                          AND central_id = '21000000-0000-4000-8000-000000000973'
                          AND episodio_id = '25000000-0000-4000-8000-000000000971'
                     FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('s1')::uuid),
  'médico abre: enviada à central, CID normalizado, médico assistente é ele, ligada ao atendimento');
SET LOCAL ROLE authenticated;

-- gestor: exame fora da rede, sem atendimento, informando o médico assistente
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971',
  pg_temp.pedido('{"tipo": "exame", "procedimento": "0206010079", "destino_tipo": "externo", "destino_externo": "Clínica X", "prioridade": "eletiva", "medico_assistente_id": "10000000-0000-4000-8000-000000000004"}'))$$,
  'O médico assistente precisa ser médico da unidade', 'médico assistente precisa ser médico');
INSERT INTO t SELECT 's2', public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971',
  pg_temp.pedido('{"tipo": "exame", "procedimento": "02.06.01.007-9", "destino_tipo": "externo", "destino_externo": "Clínica de Imagem X", "prioridade": "eletiva", "medico_assistente_id": "10000000-0000-4000-8000-000000000002"}'))->>'id';
RESET ROLE;
SELECT pg_temp.ok((SELECT solicitante_papel = 'gestor' AND procedimento = '0206010079' AND tipo_leito IS NULL
                          AND destino_tipo = 'externo' AND episodio_id IS NULL
                     FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('s2')::uuid),
  'gestor envia direto: exame fora da rede, sem atendimento');
SET LOCAL ROLE authenticated;
-- consulta e transferência a definir
INSERT INTO t SELECT 's3', public.regulacao_solicitar('21000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971',
  pg_temp.pedido('{"tipo": "transferencia", "transporte": "uti_movel", "destino_tipo": "a_definir", "destino_unidade_id": null, "prioridade": "urgencia"}'))->>'id';
RESET ROLE;
SELECT pg_temp.ok((SELECT tipo = 'transferencia' AND transporte = 'uti_movel' AND destino_unidade_id IS NULL
                     FROM public.regulacao_solicitacoes WHERE id = pg_temp.v('s3')::uuid), 'transferência a definir pela regulação');
SET LOCAL ROLE authenticated;

-- ── 3. listas, detalhe e quem vê ────────────────────────────────────────────
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_lista('21000000-0000-4000-8000-000000000971')) = 3, 'origem vê as suas três');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_lista('21000000-0000-4000-8000-000000000973')) = 3
              AND (public.regulacao_contexto('21000000-0000-4000-8000-000000000973')->>'sou_central')::boolean
              AND (public.regulacao_contexto('21000000-0000-4000-8000-000000000973')->>'sou_regulador')::boolean,
  'central recebe as três; regulador reconhecido');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('s1')::uuid)->'eventos'->0->>'evento') = 'enviada'
              AND (public.regulacao_detalhe(pg_temp.v('s1')::uuid)->>'cid_descricao') IS NOT NULL
              AND (public.regulacao_detalhe(pg_temp.v('s1')::uuid)->'destino_unidade'->>'nome') = 'Hospital Destino',
  'detalhe com histórico, CID e destino');
SELECT pg_temp.falha($$SELECT public.regulacao_solicitar('21000000-0000-4000-8000-000000000973', '23000000-0000-4000-8000-000000000971', pg_temp.pedido())$$,
  'Abre a solicitação o médico ou o gestor', 'regulador não solicita');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.regulacao_detalhe(%L)', pg_temp.v('s1')), 'Solicitação não encontrada', 'quem não é da origem nem da central não vê');
SELECT pg_temp.falha($$SELECT * FROM public.regulacao_solicitacoes$$, 'permission denied', 'tabela fechada para leitura direta');

-- ── 4. externo e cancelamento ───────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_registrar_externo(%L, %L, %L)', pg_temp.v('s1'), 'SISREG', '123456'),
  'Quem anota a regulação externa é o regulador', 'médico da origem não anota protocolo externo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.regulacao_registrar_externo(pg_temp.v('s1')::uuid, 'Central estadual', 'CE-2026-000123');
SELECT pg_temp.ok((public.regulacao_detalhe(pg_temp.v('s1')::uuid)->>'externo_protocolo') = 'CE-2026-000123', 'protocolo externo registrado');
SELECT pg_temp.falha(format('SELECT public.regulacao_cancelar(%L, %L)', pg_temp.v('s1'), 'Paciente melhorou muito'),
  'Cancela quem solicitou ou o gestor', 'regulador não cancela pela origem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.regulacao_cancelar(%L, %L)', pg_temp.v('s1'), 'curto'), 'Escreva o motivo', 'cancelar pede motivo');
SELECT public.regulacao_cancelar(pg_temp.v('s1')::uuid, 'Paciente evoluiu bem, sem indicação de UTI');
SELECT pg_temp.falha(format('SELECT public.regulacao_cancelar(%L, %L)', pg_temp.v('s1'), 'De novo com motivo longo'),
  'Esta solicitação não pode mais ser cancelada', 'cancelada não se cancela de novo');
SELECT pg_temp.ok((SELECT string_agg(e->>'evento', ',' ORDER BY e->>'em') FROM jsonb_array_elements(public.regulacao_detalhe(pg_temp.v('s1')::uuid)->'eventos') e)
                  = 'enviada,externo_registrado,cancelada', 'histórico completo');

RESET ROLE;
SELECT pg_temp.falha($$UPDATE public.regulacao_eventos SET evento = 'x'$$, '', 'histórico não se altera');
SELECT pg_temp.ok((SELECT count(*) FROM public.log_auditoria WHERE acao LIKE 'regulacao%'
                    AND unidade_id IN ('21000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000973')) >= 5,
  'auditoria registra central, solicitações e cancelamento');

ROLLBACK;
