-- Testes da migration 20270120000002_erp_plantoes.sql (Fase 5C, tarefa 3,
-- etapa 3.2): plantões do mês para o ERP. Realizado com o valor da tabela de
-- remuneração (setor e turno antes do genérico; parte fracionada
-- proporcional); falta justificada e plantão sem presença com valor zero;
-- profissional com nome, CPF, conselho, registro e CBO; só o gestor fecha,
-- só mês encerrado; reabrir com motivo substitui e o fechamento seguinte gera
-- a versão 2.
-- Não depende da semente local: cria unidade, setores, profissionais e escala
-- fictícios (roda também na homologação). ROLLBACK no fim.
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

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000e5e01'), ('un', '00000000-0000-4000-8000-0000000e5e02'),
  ('sa', '00000000-0000-4000-8000-0000000e5e03'), ('sb', '00000000-0000-4000-8000-0000000e5e04'),
  ('gestor', '00000000-0000-4000-8000-0000000e5e11'), ('p1', '00000000-0000-4000-8000-0000000e5e12'),
  ('p2', '00000000-0000-4000-8000-0000000e5e13'),
  -- meses no horário de Brasília, como nas funções: em UTC, das 21h às 24h do
  -- último dia o "mês passado" seria o mês corrente
  ('comp', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM')), ('atual', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('vazio', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '3 months', 'YYYYMM')),
  ('dia', (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month'))::date::text);
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'erp.' || k || '.ficticio@exemplo.invalid', '{"origem": "admin"}', jsonb_build_object('nome_completo', 'Ficticio ' || k), now(), now()
  FROM unnest(ARRAY['gestor', 'p1', 'p2']) k;
INSERT INTO public.perfis (id, nome_completo, cpf, conselho, registro_numero, registro_uf, cbo) VALUES
  (pg_temp.u('gestor'), 'Gestora Ficticia', NULL, NULL, NULL, NULL, NULL),
  (pg_temp.u('p1'), 'Medica Ficticia', '52998224725', 'CRM', '123456', 'SP', '225125'),
  (pg_temp.u('p2'), 'Enfermeiro Ficticio', '11144477735', 'COREN', '654321', 'SP', '223505')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cpf = EXCLUDED.cpf, conselho = EXCLUDED.conselho,
  registro_numero = EXCLUDED.registro_numero, registro_uf = EXCLUDED.registro_uf, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede Plantões ERP Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES (pg_temp.u('un'), pg_temp.u('org'), 'UPA Plantões ERP', 'upa', '9999993');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.u('sa'), pg_temp.u('un'), 'PS Plantões', 'emergencia'), (pg_temp.u('sb'), pg_temp.u('un'), 'Observação Plantões', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor'), (pg_temp.u('p1'), pg_temp.u('un'), 'plantonista'), (pg_temp.u('p2'), pg_temp.u('un'), 'plantonista') ON CONFLICT DO NOTHING;
-- remuneração: genérica 1000; PS à noite 1500
INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor) VALUES
  (pg_temp.u('un'), NULL, NULL, 1000), (pg_temp.u('un'), pg_temp.u('sa'), 'noite', 1500);

-- escala do mês passado (e um plantão deste mês, que não entra)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, fracionado) VALUES
  ('00000000-0000-4000-8000-0000000e5e21', pg_temp.u('un'), pg_temp.u('sa'), pg_temp.u('p1'), pg_temp.v('dia')::date + 9, 'noite',
   (pg_temp.v('dia')::date + 9 + time '19:00') AT TIME ZONE 'America/Sao_Paulo', 720, false),
  ('00000000-0000-4000-8000-0000000e5e22', pg_temp.u('un'), pg_temp.u('sb'), pg_temp.u('p1'), pg_temp.v('dia')::date + 11, 'manha',
   (pg_temp.v('dia')::date + 11 + time '07:00') AT TIME ZONE 'America/Sao_Paulo', 360, false),
  ('00000000-0000-4000-8000-0000000e5e23', pg_temp.u('un'), pg_temp.u('sa'), pg_temp.u('p2'), pg_temp.v('dia')::date + 9, 'tarde',
   (pg_temp.v('dia')::date + 9 + time '13:00') AT TIME ZONE 'America/Sao_Paulo', 180, true),
  ('00000000-0000-4000-8000-0000000e5e24', pg_temp.u('un'), pg_temp.u('sb'), pg_temp.u('p2'), pg_temp.v('dia')::date + 11, 'manha',
   (pg_temp.v('dia')::date + 11 + time '07:00') AT TIME ZONE 'America/Sao_Paulo', 360, false),
  ('00000000-0000-4000-8000-0000000e5e25', pg_temp.u('un'), pg_temp.u('sb'), pg_temp.u('p2'), pg_temp.v('dia')::date + 12, 'tarde',
   (pg_temp.v('dia')::date + 12 + time '13:00') AT TIME ZONE 'America/Sao_Paulo', 360, false),
  ('00000000-0000-4000-8000-0000000e5e26', pg_temp.u('un'), pg_temp.u('sb'), pg_temp.u('p2'), (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'tarde',
   ((now() AT TIME ZONE 'America/Sao_Paulo')::date + time '13:00') AT TIME ZONE 'America/Sao_Paulo', 360, false);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkout_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio + interval '5 minutes',
       CASE WHEN e.id = '00000000-0000-4000-8000-0000000e5e21' THEN e.inicio + interval '12 hours' END
  FROM public.escala_plantao e
 WHERE e.id IN ('00000000-0000-4000-8000-0000000e5e21', '00000000-0000-4000-8000-0000000e5e22', '00000000-0000-4000-8000-0000000e5e23');
INSERT INTO public.solicitacoes_escala (unidade_id, escala_plantao_id, perfil_id, tipo, status, tipo_falta, criado_por)
VALUES (pg_temp.u('un'), '00000000-0000-4000-8000-0000000e5e24', pg_temp.u('p2'), 'justificar_falta', 'aprovado', 'atestado_medico', pg_temp.u('p2'));

-- só o gestor
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('p1'));
SELECT pg_temp.falha(format('SELECT public.plantoes_erp_previa(%L, %L)', pg_temp.u('un'), pg_temp.v('comp')),
  'Acesso negado: os plantões para o ERP são do gestor', 'plantonista não vê a prévia');
SELECT pg_temp.falha(format('SELECT public.fechar_plantoes_erp(%L, %L)', pg_temp.u('un'), pg_temp.v('comp')),
  'Acesso negado: quem fecha', 'plantonista não fecha');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.plantao_versoes_erp) <> 0 THEN RAISE EXCEPTION 'FALHOU: plantonista lê versões'; END IF;
END $$;
SELECT pg_temp.como(pg_temp.u('gestor'));
INSERT INTO r SELECT 1, public.plantoes_erp_previa(pg_temp.u('un'), pg_temp.v('comp'));
SELECT pg_temp.falha(format('SELECT public.plantoes_erp_previa(%L, %L)', pg_temp.u('un'), '2026-10'), 'Competência no formato AAAAMM', 'competência fora do formato');
SELECT pg_temp.falha(format('SELECT public.fechar_plantoes_erp(%L, %L)', pg_temp.u('un'), pg_temp.v('atual')),
  'O mês só fecha depois de acabar', 'mês corrente não fecha');
SELECT pg_temp.falha(format('SELECT public.fechar_plantoes_erp(%L, %L)', pg_temp.u('un'), pg_temp.v('vazio')),
  'Não há plantão na escala deste mês', 'mês sem escala não fecha');
RESET ROLE;

-- 1a/2a. prévia: realizado com valor, falta justificada e sem presença com zero
DO $$
DECLARE p jsonb := (SELECT j FROM r WHERE n = 1); l jsonb;
BEGIN
  IF (p -> 'totais' ->> 'plantoes')::int <> 5 OR (p -> 'totais' ->> 'realizados')::int <> 3
     OR (p -> 'totais' ->> 'faltas_justificadas')::int <> 1 OR (p -> 'totais' ->> 'sem_presenca')::int <> 1
     OR (p -> 'totais' ->> 'sem_checkout')::int <> 2 OR (p ->> 'total')::numeric <> 3000
     OR NOT (p ->> 'mes_encerrado')::boolean OR (p ->> 'fechado')::boolean OR p -> 'unidade' ->> 'cnes' <> '9999993' THEN
    RAISE EXCEPTION 'FALHOU: totais da prévia: %', p - 'plantoes';
  END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e21';
  IF (l ->> 'valor')::numeric <> 1500 OR (l ->> 'minutos_presentes')::int <> 715 OR l ->> 'situacao' <> 'realizado'
     OR l -> 'profissional' ->> 'cpf' <> '52998224725' OR l -> 'profissional' ->> 'conselho' <> 'CRM'
     OR l -> 'profissional' ->> 'registro' <> '123456' OR l -> 'profissional' ->> 'registro_uf' <> 'SP'
     OR l -> 'profissional' ->> 'cbo' <> '225125' OR l -> 'setor' ->> 'nome' <> 'PS Plantões' THEN
    RAISE EXCEPTION 'FALHOU: plantão noturno do PS: %', l;
  END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e22';
  IF (l ->> 'valor')::numeric <> 1000 THEN RAISE EXCEPTION 'FALHOU: remuneração genérica: %', l; END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e23';
  IF (l ->> 'valor')::numeric <> 500 OR NOT (l ->> 'fracionado')::boolean THEN RAISE EXCEPTION 'FALHOU: parte fracionada proporcional: %', l; END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e24';
  IF l ->> 'situacao' <> 'falta_justificada' OR l ->> 'tipo_falta' <> 'atestado_medico' OR (l ->> 'valor')::numeric <> 0
     OR (l ->> 'valor_referencia')::numeric <> 1000 THEN
    RAISE EXCEPTION 'FALHOU: falta justificada: %', l;
  END IF;
  SELECT x INTO l FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e25';
  IF l ->> 'situacao' <> 'sem_presenca' OR (l ->> 'valor')::numeric <> 0 THEN RAISE EXCEPTION 'FALHOU: sem presença: %', l; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'plantoes') x WHERE x ->> 'plantao_id' = '00000000-0000-4000-8000-0000000e5e26') THEN
    RAISE EXCEPTION 'FALHOU: plantão de outro mês na prévia';
  END IF;
  RAISE NOTICE 'OK  1a/2a: realizado com o valor da tabela (setor e turno, genérico, parte proporcional); falta e sem presença com zero; profissional completo';
END $$;

-- 3a. fechar, reabrir com motivo, fechar de novo
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
INSERT INTO r SELECT 2, public.fechar_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'));
SELECT pg_temp.falha(format('SELECT public.fechar_plantoes_erp(%L, %L)', pg_temp.u('un'), pg_temp.v('comp')),
  'Os plantões deste mês já estão fechados', 'não fecha duas vezes');
SELECT pg_temp.falha(format('SELECT public.reabrir_plantoes_erp(%L, %L, %L)', pg_temp.u('un'), pg_temp.v('comp'), 'curto'),
  'Diga por que o mês é reaberto', 'reabrir pede motivo');
INSERT INTO r SELECT 3, public.reabrir_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'), 'presença do dia 13 lançada depois');
SELECT pg_temp.falha(format('SELECT public.reabrir_plantoes_erp(%L, %L, %L)', pg_temp.u('un'), pg_temp.v('comp'), 'reabrindo de novo sem fechar'),
  'Os plantões deste mês não estão fechados', 'não reabre mês aberto');
RESET ROLE;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkout_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, e.inicio + interval '6 hours'
  FROM public.escala_plantao e WHERE e.id = '00000000-0000-4000-8000-0000000e5e25';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
INSERT INTO r SELECT 4, public.fechar_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'));
RESET ROLE;
DO $$
DECLARE a jsonb := (SELECT j FROM r WHERE n = 2); b jsonb := (SELECT j FROM r WHERE n = 3); c jsonb := (SELECT j FROM r WHERE n = 4);
        v1 public.plantao_versoes_erp; v2 public.plantao_versoes_erp;
BEGIN
  IF NOT (a ->> 'fechado')::boolean OR jsonb_array_length(a -> 'versoes') <> 1 OR (a -> 'versoes' -> 0 ->> 'total')::numeric <> 3000
     OR a -> 'versoes' -> 0 ->> 'gerada_por' <> 'Gestora Ficticia' THEN
    RAISE EXCEPTION 'FALHOU: fechamento: %', a -> 'versoes';
  END IF;
  IF (b ->> 'fechado')::boolean OR b -> 'versoes' -> 0 ->> 'situacao' <> 'substituida' THEN RAISE EXCEPTION 'FALHOU: reabertura: %', b -> 'versoes'; END IF;
  SELECT * INTO v1 FROM public.plantao_versoes_erp WHERE unidade_id = pg_temp.u('un') AND versao = 1;
  SELECT * INTO v2 FROM public.plantao_versoes_erp WHERE unidade_id = pg_temp.u('un') AND versao = 2;
  IF v1.situacao <> 'substituida' OR v1.total <> 3000 OR v1.motivo_reabertura <> 'presença do dia 13 lançada depois'
     OR v2.situacao <> 'vigente' OR v2.total <> 4000 OR (v2.dados -> 'totais' ->> 'sem_presenca')::int <> 0
     OR jsonb_array_length(c -> 'versoes') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: versão 2: v1 % % / v2 % %', v1.situacao, v1.total, v2.situacao, v2.total;
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE unidade_id = pg_temp.u('un') AND acao = 'plantoes_erp_fechados') <> 2
     OR (SELECT count(*) FROM public.log_auditoria WHERE unidade_id = pg_temp.u('un') AND acao = 'plantoes_erp_reabertos') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: auditoria do fechamento';
  END IF;
  RAISE NOTICE 'OK  3a: o gestor fecha o mês encerrado; reabre com motivo; o fechamento seguinte gera a versão 2 com a correção';
END $$;

-- guarda e privilégios
SELECT pg_temp.falha(format('DELETE FROM public.plantao_versoes_erp WHERE unidade_id = %L', pg_temp.u('un')), '', 'versão não se apaga');
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.fechar_plantoes_erp(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.plantoes_erp_previa(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.plantoes_erp_dados(uuid, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.plantao_versoes_erp', 'INSERT')
     OR has_table_privilege('authenticated', 'public.plantao_versoes_erp', 'UPDATE')
     OR has_table_privilege('anon', 'public.plantao_versoes_erp', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  RAISE NOTICE 'OK  versões só pelas funções do gestor; nada para anon';
END $$;
ROLLBACK;
