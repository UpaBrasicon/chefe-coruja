-- Testes da onda 8 do porte: administrador e painel da TV (migration
-- 20261008000001). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_admin_recepcao_painel.sql
-- Chamados técnicos só do administrador da organização (abrir, andamento só
-- inserção, resolver com nota); unidades e servidores só para ele e só das
-- suas unidades; propaganda do painel só do gestor, arte na pasta da unidade;
-- a TV sem login lê as artes ativas, quem chamou e a vez da chamada.
BEGIN;

-- enfermeira (…0004) e recepção (…0005) de plantão AGORA no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
ALTER TABLE public.chamadas DISABLE TRIGGER trg_chamadas_so_insercao;
DELETE FROM public.chamadas WHERE setor_id = '22000000-0000-4000-8000-000000000003';
ALTER TABLE public.chamadas ENABLE TRIGGER trg_chamadas_so_insercao;
DELETE FROM public.chamados_tecnicos;
DELETE FROM public.painel_propagandas WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
DELETE FROM public.painel_config WHERE unidade_id = '21000000-0000-4000-8000-000000000001';

-- a arte "já enviada" ao bucket (o upload real passa pela API do Storage)
INSERT INTO storage.objects (bucket_id, name, metadata)
VALUES ('painel', '21000000-0000-4000-8000-000000000001/teste-arte.png', '{"size": 1234}');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO anon, authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO anon, authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO anon, authenticated;

-- ── administrador: unidades, chamados e servidores ──────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT * FROM public.admin_unidades()$$, 'Acesso negado: tela do administrador', 'a recepção não abre as unidades da rede');
SELECT pg_temp.falha($$SELECT public.admin_servidores()$$, 'Acesso negado: tela do administrador', 'a recepção não abre os servidores');
SELECT pg_temp.falha($$SELECT * FROM public.chamados_tecnicos_lista()$$, 'Acesso negado: tela do administrador', 'a recepção não lê chamados técnicos');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Impressora sem resposta', 'integracao', 'media')$$,
  'Acesso negado: chamado técnico é do administrador', 'o gestor não abre chamado técnico');
SELECT pg_temp.falha($$SELECT * FROM public.chamados_tecnicos$$, 'permission denied', 'a tabela de chamados não se lê direto');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT pg_temp.falha($$SELECT public.abrir_chamado_tecnico('00000000-0000-0000-0000-000000000101', 'Chamado em outra rede', 'servidor', 'alta')$$,
  'Acesso negado: chamado técnico é do administrador', 'o administrador não abre chamado em unidade de outra organização');
SELECT pg_temp.falha($$SELECT public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Pane', 'servidor', 'alta')$$,
  'Descreva o chamado', 'chamado com título curto é recusado');
INSERT INTO t VALUES ('ch', public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Sincronização da RNDS parada',
  'integracao', 'alta', 'Fila da RNDS com erro desde a madrugada', 'Infraestrutura'));
INSERT INTO t VALUES ('ch_rede', public.abrir_chamado_tecnico(NULL, 'Certificado de assinatura vence em 9 dias', 'seguranca', 'media'));
INSERT INTO t SELECT 'lista', jsonb_agg(to_jsonb(x))::text FROM public.chamados_tecnicos_lista() x;
INSERT INTO t SELECT 'unidades', jsonb_agg(to_jsonb(x))::text FROM public.admin_unidades() x;
INSERT INTO t VALUES ('servidores', public.admin_servidores()::text);
SELECT pg_temp.falha(format($$SELECT public.atualizar_chamado_tecnico(%L, 'resolvido', 'ok')$$, pg_temp.v('ch')),
  'Para resolver, diga o que foi feito', 'resolver exige dizer o que foi feito');
SELECT public.atualizar_chamado_tecnico(pg_temp.u('ch'), 'em_atendimento', NULL, 'Suporte N2');
SELECT public.atualizar_chamado_tecnico(pg_temp.u('ch'), 'resolvido', 'Credencial da RNDS renovada e fila reenviada');
INSERT INTO t SELECT 'andamento', jsonb_agg(to_jsonb(x))::text FROM public.andamento_chamado_tecnico(pg_temp.u('ch')) x;
INSERT INTO t SELECT 'abertos', count(*)::text FROM public.chamados_tecnicos_lista() x;
INSERT INTO t SELECT 'todos', count(*)::text FROM public.chamados_tecnicos_lista(true) x;
RESET ROLE;

DO $$
DECLARE
  l jsonb := pg_temp.v('lista')::jsonb;
  u jsonb := pg_temp.v('unidades')::jsonb;
  s jsonb := pg_temp.v('servidores')::jsonb;
  a jsonb := pg_temp.v('andamento')::jsonb;
  c public.chamados_tecnicos;
BEGIN
  IF jsonb_array_length(l) <> 2 OR l -> 0 ->> 'severidade' <> 'alta' OR l -> 0 ->> 'unidade_nome' <> 'Unidade Teste'
     OR l -> 1 ->> 'unidade_id' IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: lista de chamados (%)', l;
  END IF;
  RAISE NOTICE 'OK  chamados abertos: da unidade e da rede, severidade alta primeiro';
  IF jsonb_array_length(u) <> 1 OR u -> 0 ->> 'nome' <> 'Unidade Teste' THEN
    RAISE EXCEPTION 'FALHOU: admin_unidades trouxe unidade de outra organização (%)', u;
  END IF;
  IF (u -> 0 ->> 'chamados_abertos')::int <> 1 OR (u -> 0 ->> 'chamados_alta')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: contagem de chamados por unidade (%)', u;
  END IF;
  IF u -> 0 ? 'paciente' OR u -> 0 ? 'nome_paciente' THEN RAISE EXCEPTION 'FALHOU: unidade com dado de paciente'; END IF;
  RAISE NOTICE 'OK  admin_unidades: só as unidades da organização, com os chamados de cada uma';
  IF NOT (s ? 'banco' AND s ? 'rnds' AND s ? 'armazenamento' AND s ? 'push' AND s ? 'auditoria' AND s ? 'sessoes')
     OR (s -> 'banco' ->> 'tamanho_bytes')::bigint <= 0 THEN
    RAISE EXCEPTION 'FALHOU: admin_servidores (%)', s;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'armazenamento') b WHERE b ->> 'bucket' = 'painel' AND (b ->> 'bytes')::int >= 1234) THEN
    RAISE EXCEPTION 'FALHOU: armazenamento da unidade não contou a arte (%)', s -> 'armazenamento';
  END IF;
  RAISE NOTICE 'OK  admin_servidores mede banco, sessões, RNDS, arquivos das unidades, push e auditoria';
  SELECT * INTO c FROM public.chamados_tecnicos WHERE id = pg_temp.u('ch');
  IF c.situacao <> 'resolvido' OR c.resolvido_em IS NULL OR c.responsavel <> 'Suporte N2'
     OR c.resolvido_por <> '10000000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'FALHOU: resolver chamado (%)', row_to_json(c);
  END IF;
  IF jsonb_array_length(a) <> 3 OR a -> 0 ->> 'situacao' <> 'resolvido' OR a -> 2 ->> 'situacao' <> 'aberto' THEN
    RAISE EXCEPTION 'FALHOU: andamento do chamado (%)', a;
  END IF;
  IF pg_temp.v('abertos') <> '1' OR pg_temp.v('todos') <> '2' THEN
    RAISE EXCEPTION 'FALHOU: resolvido sai da lista de abertos (% / %)', pg_temp.v('abertos'), pg_temp.v('todos');
  END IF;
  RAISE NOTICE 'OK  chamado resolvido com nota, autor e andamento; sai da lista de abertos';
  BEGIN
    UPDATE public.chamados_tecnicos_andamento SET nota = 'x';
    RAISE EXCEPTION 'FALHOU: andamento alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  andamento do chamado não se altera';
  END;
END $$;

-- ── propaganda do painel ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.salvar_painel_config('21000000-0000-4000-8000-000000000001', 'Informe', 10)$$,
  'Acesso negado: a propaganda do painel é do gestor', 'a recepção não mexe na propaganda');
SELECT pg_temp.falha($$INSERT INTO storage.objects (bucket_id, name) VALUES ('painel', '21000000-0000-4000-8000-000000000001/da-recepcao.png')$$,
  'new row violates row-level security', 'a recepção não sobe arte para o painel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.salvar_painel_config('21000000-0000-4000-8000-000000000001', 'Informe da Prefeitura', 10);
SELECT pg_temp.falha($$SELECT public.salvar_painel_config('21000000-0000-4000-8000-000000000001', 'Informe', 2)$$,
  'Tempo de cada arte', 'tempo de cada arte fora de 4 a 60 segundos é recusado');
SELECT pg_temp.falha($$SELECT public.adicionar_propaganda('21000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001/nao-existe.png', 'Vacinação')$$,
  'Arte não encontrada', 'arte que não está no bucket não entra');
SELECT pg_temp.falha($$SELECT public.adicionar_propaganda('21000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000101/x.png', 'Vacinação')$$,
  'A arte precisa estar na pasta da unidade', 'arte de outra pasta não entra');
INSERT INTO t VALUES ('arte', public.adicionar_propaganda('21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001/teste-arte.png', 'Campanha de vacinação contra a gripe'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t VALUES ('vista_rec', public.painel_propaganda('21000000-0000-4000-8000-000000000001')::text);
-- ficha e duas chamadas para a triagem
INSERT INTO t SELECT 'epi', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  '{"nome":"Paciente Painel Teste","data_nascimento":"1985-05-05"}') ->> 'episodio_id';
INSERT INTO t VALUES ('token', public.gerar_link_painel('22000000-0000-4000-8000-000000000003'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.chamar_paciente(pg_temp.u('epi'), (SELECT id FROM public.salas WHERE setor_id = '22000000-0000-4000-8000-000000000003' AND nome = 'Triagem 1'));
SELECT public.chamar_paciente(pg_temp.u('epi'), (SELECT id FROM public.salas WHERE setor_id = '22000000-0000-4000-8000-000000000003' AND nome = 'Triagem 1'));
RESET ROLE;

DO $$
DECLARE r jsonb := pg_temp.v('vista_rec')::jsonb;
BEGIN
  IF (r ->> 'posso_editar')::boolean OR r ->> 'rotulo' <> 'Informe da Prefeitura' OR (r ->> 'segundos')::int <> 10
     OR jsonb_array_length(r -> 'itens') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: propaganda vista pela recepção (%)', r;
  END IF;
  RAISE NOTICE 'OK  a recepção vê a propaganda da unidade, sem poder editar';
END $$;

-- a TV, sem login
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
DECLARE p jsonb := public.painel_chamadas(pg_temp.v('token'));
BEGIN
  IF (p -> 'chamadas' -> 0 ->> 'vez')::int <> 2 OR p -> 'chamadas' -> 0 ->> 'quem' <> 'Enfermeira de Teste'
     OR p -> 'chamadas' -> 0 ->> 'nome' <> 'Paciente Painel Teste' THEN
    RAISE EXCEPTION 'FALHOU: chamada na TV (%)', p -> 'chamadas';
  END IF;
  RAISE NOTICE 'OK  a TV mostra a vez da chamada e quem chamou';
  IF p -> 'propaganda' ->> 'rotulo' <> 'Informe da Prefeitura' OR (p -> 'propaganda' ->> 'segundos')::int <> 10
     OR jsonb_array_length(p -> 'propaganda' -> 'itens') <> 1
     OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p -> 'propaganda' -> 'itens' -> 0) k) <> ARRAY['caminho', 'id', 'titulo'] THEN
    RAISE EXCEPTION 'FALHOU: propaganda na TV (%)', p -> 'propaganda';
  END IF;
  RAISE NOTICE 'OK  a TV lê as artes ativas, o rótulo e o tempo da unidade';
END $$;
SELECT pg_temp.falha($$SELECT * FROM public.painel_propagandas$$, 'permission denied', 'sem login não se lê a tabela de propaganda');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.atualizar_propaganda(pg_temp.u('arte'), 'Campanha de vacinação', false);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$ BEGIN
  IF jsonb_array_length(public.painel_chamadas(pg_temp.v('token')) -> 'propaganda' -> 'itens') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: arte pausada continua na TV';
  END IF;
  RAISE NOTICE 'OK  arte pausada sai do rodízio da TV';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t VALUES ('removida', public.remover_propaganda(pg_temp.u('arte')));
RESET ROLE;
DO $$ BEGIN
  IF pg_temp.v('removida') <> '21000000-0000-4000-8000-000000000001/teste-arte.png'
     OR EXISTS (SELECT 1 FROM public.painel_propagandas WHERE id = pg_temp.u('arte')) THEN
    RAISE EXCEPTION 'FALHOU: remover arte (%)', pg_temp.v('removida');
  END IF;
  RAISE NOTICE 'OK  remover tira a arte e devolve o caminho para apagar do bucket';
END $$;

ROLLBACK;
