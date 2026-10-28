-- Testes da migration 20270120000004_erp_telas.sql (Fase 5C, tarefa 3, etapa
-- 3.4): a tela "Envio ao ERP" lista as versões das contas (faturamento e
-- gestor) e baixa o mesmo conteúdo da API, com registro na auditoria; os
-- plantões só o gestor baixa, e só de mês fechado.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(uuid) TO authenticated;
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
CREATE TEMP TABLE r (n int PRIMARY KEY, j jsonb);
GRANT ALL ON r TO authenticated;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000e6a01'), ('un', '00000000-0000-4000-8000-0000000e6a02'),
  ('setor', '00000000-0000-4000-8000-0000000e6a03'), ('pac', '00000000-0000-4000-8000-0000000e6a04'),
  ('epi', '00000000-0000-4000-8000-0000000e6a05'),
  ('gestor', '00000000-0000-4000-8000-0000000e6a11'), ('fat', '00000000-0000-4000-8000-0000000e6a12'),
  ('plant', '00000000-0000-4000-8000-0000000e6a13'),
  ('comp', to_char(now() - interval '1 month', 'YYYYMM')), ('dia', (date_trunc('month', now() - interval '1 month'))::date::text);
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'erp.telas.' || k || '.ficticio@exemplo.invalid', '{"origem": "admin"}', jsonb_build_object('nome_completo', 'Ficticio ' || k), now(), now()
  FROM unnest(ARRAY['gestor', 'fat', 'plant']) k;
INSERT INTO public.perfis (id, nome_completo, cpf) VALUES
  (pg_temp.u('gestor'), 'Gestor Ficticio Telas', NULL), (pg_temp.u('fat'), 'Faturista Ficticia Telas', NULL),
  (pg_temp.u('plant'), 'Plantonista Ficticio Telas', '52998224725')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cpf = EXCLUDED.cpf;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede Telas ERP Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES (pg_temp.u('un'), pg_temp.u('org'), 'UPA Telas ERP', 'upa', '9999996');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor'), pg_temp.u('un'), 'PS Telas', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor'), (pg_temp.u('fat'), pg_temp.u('un'), 'faturamento'),
  (pg_temp.u('plant'), pg_temp.u('un'), 'plantonista') ON CONFLICT DO NOTHING;

-- uma conta faturada (versão 1)
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio Telas', '1980-01-01', 'TEL-0001', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
VALUES (pg_temp.u('epi'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Teste telas', pg_temp.u('gestor'), now() - interval '2 days');
UPDATE public.contas SET status = 'fechada', congelada_em = now(),
  itens_congelados = '[{"origem": "atendimento", "procedimento": "0301060029", "nome": "ATENDIMENTO DE URGENCIA", "quantidade": 1,
                        "em": "2026-10-05T10:00:00-03:00", "valor_unitario": 11.00, "valor_total": 11.00, "destino": "bpa_i"}]'::jsonb,
  medicamentos_congelados = '[]'::jsonb
 WHERE episodio_id = pg_temp.u('epi');
UPDATE public.contas SET status = 'faturada', status_em = now() WHERE episodio_id = pg_temp.u('epi');

-- um mês de plantões fechado
INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor) VALUES (pg_temp.u('un'), NULL, NULL, 900);
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('00000000-0000-4000-8000-0000000e6a21', pg_temp.u('un'), pg_temp.u('setor'), pg_temp.u('plant'), pg_temp.v('dia')::date + 3, 'manha',
   (pg_temp.v('dia')::date + 3 + time '07:00') AT TIME ZONE 'America/Sao_Paulo', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkout_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, e.inicio + interval '6 hours'
  FROM public.escala_plantao e WHERE e.id = '00000000-0000-4000-8000-0000000e6a21';

SET LOCAL ROLE authenticated;
-- o plantonista não vê nem baixa
SELECT pg_temp.como(pg_temp.u('plant'));
SELECT pg_temp.falha(format('SELECT public.erp_contas_da_unidade(%L)', pg_temp.u('un')), 'Acesso negado: o envio ao ERP', 'plantonista não vê as contas');
SELECT pg_temp.falha(format('SELECT public.erp_baixar(%L, %L, %L)', pg_temp.u('un'), 'contas', 'csv'), 'Acesso negado: o envio ao ERP', 'plantonista não baixa');
-- o faturamento vê e baixa as contas, não os plantões
SELECT pg_temp.como(pg_temp.u('fat'));
INSERT INTO r SELECT 1, public.erp_contas_da_unidade(pg_temp.u('un'));
INSERT INTO r SELECT 2, public.erp_baixar(pg_temp.u('un'), 'contas', 'csv');
SELECT pg_temp.falha(format('SELECT public.erp_baixar(%L, %L, %L, %L)', pg_temp.u('un'), 'plantoes', 'csv', pg_temp.v('comp')),
  'Acesso negado: os plantões para o ERP', 'faturamento não baixa os plantões');
SELECT pg_temp.falha(format('SELECT public.erp_baixar(%L, %L, %L)', pg_temp.u('un'), 'contas', 'xlsx'), 'Formato: csv ou json', 'formato fora da lista');
SELECT pg_temp.falha(format('SELECT public.erp_baixar(%L, %L, %L)', pg_temp.u('un'), 'pacientes', 'csv'), 'Conjunto: contas ou plantoes', 'conjunto fora da lista');
-- o gestor fecha o mês e baixa os plantões
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT pg_temp.falha(format('SELECT public.erp_baixar(%L, %L, %L, %L)', pg_temp.u('un'), 'plantoes', 'json', pg_temp.v('comp')),
  'Os plantões deste mês ainda não foram fechados', 'mês aberto não se baixa');
SELECT public.fechar_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'));
INSERT INTO r SELECT 3, public.erp_baixar(pg_temp.u('un'), 'plantoes', 'json', pg_temp.v('comp'));
INSERT INTO r SELECT 4, public.erp_contas_da_unidade(pg_temp.u('un'));
RESET ROLE;

DO $$
DECLARE a jsonb := (SELECT j FROM r WHERE n = 1); b jsonb := (SELECT j FROM r WHERE n = 2); p jsonb := (SELECT j FROM r WHERE n = 3);
BEGIN
  IF jsonb_array_length(a) <> 1 OR a -> 0 ->> 'prontuario' <> 'TEL-0001' OR (a -> 0 ->> 'total')::numeric <> 11
     OR a -> 0 ->> 'situacao' <> 'vigente' OR a -> 0 ->> 'conciliacao' <> 'pendente' OR a -> 0 -> 'glosas' IS NULL
     OR a::text LIKE '%Paciente Ficticio Telas%' THEN
    RAISE EXCEPTION 'FALHOU: lista das contas: %', a;
  END IF;
  IF b <> a THEN RAISE EXCEPTION 'FALHOU: o arquivo das contas não é o mesmo conteúdo da lista'; END IF;
  IF jsonb_array_length((SELECT j FROM r WHERE n = 4)) <> 1 THEN RAISE EXCEPTION 'FALHOU: o gestor vê as contas'; END IF;
  IF jsonb_array_length(p) <> 1 OR (p -> 0 ->> 'total')::numeric <> 900 OR p -> 0 -> 'plantoes' -> 0 -> 'profissional' ->> 'cpf' <> '52998224725' THEN
    RAISE EXCEPTION 'FALHOU: arquivo dos plantões: %', p;
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE unidade_id = pg_temp.u('un') AND acao = 'erp_baixado') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: cada baixa vai para a auditoria';
  END IF;
  IF has_function_privilege('anon', 'public.erp_baixar(uuid, text, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.erp_contas_da_unidade(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon executa';
  END IF;
  RAISE NOTICE 'OK  lista e arquivo das contas iguais ao da API, só o prontuário do paciente; plantões só do gestor e de mês fechado; cada baixa na auditoria';
END $$;
ROLLBACK;
