-- Testes da migration 20261012000001 (limites da unidade, chamado técnico do
-- gestor e fracionar plantão). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_limites_chamados_fracionar.sql
-- Limites: padrões, leitura por membro, escrita só do gestor e com faixa,
-- valor inválido na tabela vale o padrão, mapa de leitos e pergunta usam o
-- limite. Chamados: o gestor abre e acompanha os da SUA unidade, comenta, não
-- muda situação nem responsável. Fracionar: janela dividida em partes iguais,
-- a 1ª parte é o próprio registro encurtado, as demais viram vagas marcadas
-- com a janela; candidatura à vaga, aprovação vira plantão da parte; desfazer
-- só sem parte assumida.
BEGIN;
-- gestora …0001; plantonista …0002; admin …0003; recepção …0005; o tele
-- (…0006) ganha vínculo de plantonista para se candidatar
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'plantonista')
ON CONFLICT DO NOTHING;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006');
DELETE FROM public.chamados_tecnicos;
DELETE FROM public.configuracoes_unidade WHERE unidade_id = '21000000-0000-4000-8000-000000000001'
   AND chave IN ('descanso_minimo_ativo', 'descanso_minimo_horas', 'sobrecarga_horas_7d', 'ocupacao_limite_pct', 'checkin_tolerancia_min');
-- plantões da plantonista: noite de 12 h daqui a 2 dias; manhã daqui a 3;
-- noite de 12 h daqui a 4; e um de 12 h que começou há 7 horas
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual() + 2, 'noite', 720),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual() + 3, 'manha', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual() + 4, 'noite', 720);
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', private.data_atual() - 1, 'noite', now() - interval '7 hours', 720);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'p_noite', id::text FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND data = private.data_atual() + 2;
INSERT INTO t SELECT 'p_manha', id::text FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND data = private.data_atual() + 3;
INSERT INTO t SELECT 'p_noite4', id::text FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND data = private.data_atual() + 4;
INSERT INTO t SELECT 'p_passou', id::text FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND data = private.data_atual() - 1;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated;
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
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;

-- ════ 1. limites da unidade ════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t VALUES ('lim_padrao', public.limites_unidade('21000000-0000-4000-8000-000000000001')::text);
SELECT pg_temp.falha($$SELECT public.limites_unidade('00000000-0000-0000-0000-000000000101')$$,
  'Acesso negado: limites de outra unidade', 'limites de outra unidade não se leem');
SELECT pg_temp.falha($$SELECT public.salvar_limites_unidade('21000000-0000-4000-8000-000000000001', true, 11, 60, 85, 30)$$,
  'Acesso negado: os limites são do gestor', 'a plantonista não muda os limites');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.salvar_limites_unidade('21000000-0000-4000-8000-000000000001', true, 11, 60, 40, 30)$$,
  'Limite de ocupação entre', 'ocupação fora da faixa é recusada');
SELECT pg_temp.falha($$SELECT public.salvar_limites_unidade('21000000-0000-4000-8000-000000000001', true, 30, 60, 85, 30)$$,
  'Descanso mínimo entre 1 e 24', 'descanso fora da faixa é recusado');
SELECT pg_temp.falha($$SELECT public.salvar_limites_unidade('21000000-0000-4000-8000-000000000001', true, 11, 60, 85, 121)$$,
  'Tolerância do check-in entre 0 e 120', 'tolerância do check-in fora da faixa é recusada');
INSERT INTO t VALUES ('lim_salvo', public.salvar_limites_unidade('21000000-0000-4000-8000-000000000001', true, 12, 48, 90, 20)::text);
INSERT INTO t VALUES ('mapa', public.mapa_leitos_gestor('21000000-0000-4000-8000-000000000001')::text);
INSERT INTO t VALUES ('perg', public.perguntar_gestao('21000000-0000-4000-8000-000000000001', 'Quem está com mais plantões que o limite?')::text);
RESET ROLE;
-- valor inválido gravado direto na tabela vale o padrão
UPDATE public.configuracoes_unidade SET valor = 'abc'
 WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND chave = 'ocupacao_limite_pct';
INSERT INTO t VALUES ('lim_lixo', private.limites_unidade('21000000-0000-4000-8000-000000000001')::text);

DO $$
DECLARE
  p jsonb := pg_temp.v('lim_padrao')::jsonb;
  s jsonb := pg_temp.v('lim_salvo')::jsonb;
BEGIN
  IF (p ->> 'descanso_ativo')::boolean OR (p ->> 'descanso_horas')::int <> 11 OR (p ->> 'sobrecarga_horas')::int <> 60
     OR (p ->> 'ocupacao_pct')::int <> 85 OR (p ->> 'checkin_tolerancia_min')::int <> 30 THEN
    RAISE EXCEPTION 'FALHOU: padrões dos limites (%)', p;
  END IF;
  RAISE NOTICE 'OK  padrões: descanso desligado (11 h), 60 h em 7 dias, 85%%, tolerância de 30 min';
  IF NOT (s ->> 'descanso_ativo')::boolean OR (s ->> 'descanso_horas')::int <> 12 OR (s ->> 'sobrecarga_horas')::int <> 48
     OR (s ->> 'ocupacao_pct')::int <> 90 OR (s ->> 'checkin_tolerancia_min')::int <> 20 THEN
    RAISE EXCEPTION 'FALHOU: limites salvos (%)', s;
  END IF;
  RAISE NOTICE 'OK  o gestor salva os limites da unidade';
  IF (pg_temp.v('mapa')::jsonb ->> 'limite')::numeric <> 0.9 THEN
    RAISE EXCEPTION 'FALHOU: o mapa de leitos usa o limite da unidade (%)', pg_temp.v('mapa')::jsonb ->> 'limite';
  END IF;
  RAISE NOTICE 'OK  mapa de leitos com o limite de ocupação da unidade';
  IF pg_temp.v('perg')::jsonb ->> 'resposta' NOT LIKE '%48 horas em 7 dias%' THEN
    RAISE EXCEPTION 'FALHOU: a pergunta sobre carga usa o limite da unidade (%)', pg_temp.v('perg');
  END IF;
  RAISE NOTICE 'OK  a pergunta sobre a carga usa o limite da unidade';
  IF (pg_temp.v('lim_lixo')::jsonb ->> 'ocupacao_pct')::int <> 85 THEN
    RAISE EXCEPTION 'FALHOU: valor inválido deveria valer o padrão (%)', pg_temp.v('lim_lixo');
  END IF;
  RAISE NOTICE 'OK  valor inválido na tabela vale o padrão';
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'salvar_limites_unidade') THEN
    RAISE EXCEPTION 'FALHOU: salvar limites não ficou na auditoria';
  END IF;
  RAISE NOTICE 'OK  salvar limites fica na auditoria';
END $$;

-- ════ 2. chamado técnico do gestor ═════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t VALUES ('ch', public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Impressora da recepção sem resposta',
  'aplicativo', 'media', 'Não imprime a ficha desde as 8h', 'Eu mesmo'));
SELECT pg_temp.falha($$SELECT public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Chamado qualquer', 'outra', 'media')$$,
  'Escolha a categoria', 'categoria inválida é recusada');
INSERT INTO t SELECT 'lista_g', jsonb_agg(to_jsonb(x))::text FROM public.chamados_tecnicos_da_unidade('21000000-0000-4000-8000-000000000001') x;
SELECT pg_temp.falha(format($$SELECT public.atualizar_chamado_tecnico(%L, 'resolvido', 'feito por mim')$$, pg_temp.v('ch')),
  'Acesso negado: chamado técnico é do administrador', 'o gestor não muda situação nem responsável');
SELECT pg_temp.falha($$SELECT * FROM public.chamados_tecnicos_lista()$$, 'Acesso negado: tela do administrador', 'o gestor não lê os chamados da rede');
SELECT public.comentar_chamado_tecnico(pg_temp.u('ch'), 'Trocamos o cabo e continua igual');
SELECT pg_temp.falha(format($$SELECT public.comentar_chamado_tecnico(%L, '')$$, pg_temp.v('ch')), 'Escreva a nota', 'nota vazia é recusada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT * FROM public.chamados_tecnicos_da_unidade('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado: chamados técnicos da unidade', 'a plantonista não lê os chamados da unidade');
SELECT pg_temp.falha(format($$SELECT * FROM public.andamento_chamado_tecnico(%L)$$, pg_temp.v('ch')),
  'Acesso negado', 'a plantonista não lê o andamento');
SELECT pg_temp.falha($$SELECT public.abrir_chamado_tecnico('21000000-0000-4000-8000-000000000001', 'Computador lento', 'aplicativo', 'baixa')$$,
  'Acesso negado', 'a plantonista não abre chamado técnico');
-- o administrador vê o chamado aberto pelo gestor e resolve
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'lista_a', count(*)::text FROM public.chamados_tecnicos_lista() x WHERE x.id = pg_temp.u('ch');
SELECT public.atualizar_chamado_tecnico(pg_temp.u('ch'), 'resolvido', 'Driver da impressora reinstalado', 'Suporte N1');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'andamento', jsonb_agg(to_jsonb(x))::text FROM public.andamento_chamado_tecnico(pg_temp.u('ch')) x;
INSERT INTO t SELECT 'lista_g_abertos', count(*)::text FROM public.chamados_tecnicos_da_unidade('21000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'lista_g_todos', count(*)::text FROM public.chamados_tecnicos_da_unidade('21000000-0000-4000-8000-000000000001', true) x;
SELECT pg_temp.falha(format($$SELECT public.comentar_chamado_tecnico(%L, 'Voltou a falhar')$$, pg_temp.v('ch')),
  'Este chamado já foi resolvido', 'chamado resolvido não recebe nota');
RESET ROLE;

DO $$
DECLARE
  l jsonb := pg_temp.v('lista_g')::jsonb;
  a jsonb := pg_temp.v('andamento')::jsonb;
BEGIN
  IF jsonb_array_length(l) <> 1 OR l -> 0 ->> 'responsavel' IS NOT NULL OR NOT (l -> 0 ->> 'meu')::boolean
     OR l -> 0 ->> 'aberto_por' <> 'Gestora de Teste' THEN
    RAISE EXCEPTION 'FALHOU: chamado aberto pelo gestor (%)', l;
  END IF;
  RAISE NOTICE 'OK  o gestor abre chamado da unidade (o responsável fica para o administrador)';
  IF pg_temp.v('lista_a')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: o administrador não viu o chamado do gestor'; END IF;
  RAISE NOTICE 'OK  o chamado do gestor aparece na lista do administrador';
  IF jsonb_array_length(a) <> 3 OR a -> 0 ->> 'situacao' <> 'resolvido' OR a -> 1 ->> 'nota' <> 'Trocamos o cabo e continua igual'
     OR a -> 1 ->> 'situacao' <> 'aberto' THEN
    RAISE EXCEPTION 'FALHOU: andamento com a nota do gestor (%)', a;
  END IF;
  RAISE NOTICE 'OK  a nota do gestor entra no andamento sem mudar a situação';
  IF pg_temp.v('lista_g_abertos')::int <> 0 OR pg_temp.v('lista_g_todos')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: resolvidos só com o filtro';
  END IF;
  RAISE NOTICE 'OK  o gestor acompanha até a resolução (resolvidos só com o filtro)';
END $$;

-- ════ 3. fracionar plantão ═════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format($$SELECT public.fracionar_plantao(%L, 2)$$, pg_temp.v('p_noite')),
  'Acesso negado: apenas o plantonista escalado ou o gestor', 'quem não é o escalado nem gestor não fraciona');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($$SELECT public.fracionar_plantao(%L, 5)$$, pg_temp.v('p_noite')),
  'O número de partes deve ser entre 2 e 4', 'no máximo 4 partes');
SELECT pg_temp.falha(format($$SELECT public.fracionar_plantao(%L, 2)$$, pg_temp.v('p_passou')),
  'A segunda parte deste plantão já começou', 'não se fraciona depois que a segunda parte começou');
INSERT INTO t VALUES ('frac', public.fracionar_plantao(pg_temp.u('p_noite'), 2)::text);
SELECT pg_temp.falha(format($$SELECT public.fracionar_plantao(%L, 2)$$, pg_temp.v('p_noite')),
  'Este plantão já foi fracionado', 'não se fraciona duas vezes');
INSERT INTO t SELECT 'vaga', id::text FROM public.escala_vagas WHERE plantao_origem_id = pg_temp.u('p_noite');
SELECT pg_temp.falha(format($$SELECT public.candidatar_vaga(%L)$$, pg_temp.v('vaga')),
  'Esta parte é do seu próprio plantão', 'o dono do plantão não se candidata à própria parte');
-- o outro plantonista vê a vaga e se candidata
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'vaga_visivel', count(*)::text FROM public.escala_vagas WHERE id = pg_temp.u('vaga') AND fechada_em IS NULL;
INSERT INTO t VALUES ('cand', public.candidatar_vaga(pg_temp.u('vaga'))::text);
INSERT INTO t SELECT 'vaga_lista', to_jsonb(x)::text FROM public.vagas_abertas() x WHERE x.id = pg_temp.u('vaga');
SELECT pg_temp.falha(format($$SELECT public.candidatar_vaga(%L)$$, pg_temp.v('vaga')),
  'Você já se candidatou a esta vaga', 'uma candidatura por vaga');
SELECT pg_temp.falha(format($$SELECT public.aprovar_candidatura(%L)$$, pg_temp.v('cand')),
  'Acesso negado: apenas o gestor', 'o candidato não aprova');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t VALUES ('assumido', public.aprovar_candidatura(pg_temp.u('cand'))::text);
SELECT pg_temp.falha(format($$SELECT public.remover_fracionamento(%L)$$, pg_temp.v('p_noite')),
  'Uma parte já foi assumida', 'não se desfaz o fracionamento com parte assumida');
-- manhã de 6 h em 3 partes, desfeita pelo gestor
SELECT public.fracionar_plantao(pg_temp.u('p_manha'), 3);
INSERT INTO t SELECT 'vagas_manha', count(*)::text FROM public.escala_vagas WHERE plantao_origem_id = pg_temp.u('p_manha') AND fechada_em IS NULL;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format($$SELECT public.remover_fracionamento(%L)$$, pg_temp.v('p_manha')),
  'Apenas o gestor pode remover', 'só o gestor desfaz o fracionamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.remover_fracionamento(pg_temp.u('p_manha'));
-- noite de 12 h em 4: as partes da madrugada continuam na noite do dia
SELECT public.fracionar_plantao(pg_temp.u('p_noite4'), 4);
INSERT INTO t SELECT 'faixas4', count(*)::text FROM private.escala_faixas('21000000-0000-4000-8000-000000000001', private.data_atual() + 4, private.data_atual() + 4) f
  WHERE f.setor_id = '22000000-0000-4000-8000-000000000001' AND f.turno = 'noite';
RESET ROLE;

DO $$
DECLARE
  o public.escala_plantao;
  n public.escala_plantao;
  m public.escala_plantao;
  v public.escala_vagas;
  c public.candidaturas_escala;
BEGIN
  SELECT * INTO o FROM public.escala_plantao WHERE id = pg_temp.u('p_noite');
  SELECT * INTO v FROM public.escala_vagas WHERE id = pg_temp.u('vaga');
  IF pg_temp.v('frac')::int <> 2 OR NOT o.fracionado OR NOT o.ativo OR o.duracao_min <> 360
     OR o.inicio <> private.inicio_do_turno(private.data_atual() + 2, 'noite') OR o.perfil_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: a 1ª parte é o próprio registro, de 6 h, com quem estava escalado (%)', row_to_json(o);
  END IF;
  RAISE NOTICE 'OK  12 h em 2: a 1ª parte (19h–01h) fica com quem estava escalado, no mesmo registro';
  IF (SELECT count(*) FROM public.escala_vagas WHERE plantao_origem_id = o.id) <> 1
     OR v.inicio <> o.inicio + interval '6 hours' OR v.duracao_min <> 360 OR v.parte <> 2 OR v.partes <> 2
     OR v.data <> private.data_atual() + 2 OR v.turno <> 'noite' THEN
    RAISE EXCEPTION 'FALHOU: a 2ª parte vira vaga com a janela 01h–07h (%)', row_to_json(v);
  END IF;
  RAISE NOTICE 'OK  a 2ª parte vira vaga marcada com a própria janela (01h–07h), na noite do dia';
  IF NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000006' AND tipo = 'vaga_' || v.id)
     OR EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE perfil_id = '10000000-0000-4000-8000-000000000002' AND tipo = 'vaga_' || v.id) THEN
    RAISE EXCEPTION 'FALHOU: aviso da vaga aos outros plantonistas';
  END IF;
  RAISE NOTICE 'OK  a vaga avisa os outros plantonistas da unidade';
  IF pg_temp.v('vaga_visivel')::int <> 1 OR pg_temp.v('vaga_lista') IS NULL
     OR pg_temp.v('vaga_lista')::jsonb ->> 'minha_candidatura' <> 'pendente'
     OR (pg_temp.v('vaga_lista')::jsonb ->> 'inicio')::timestamptz <> o.inicio + interval '6 hours'
     OR (pg_temp.v('vaga_lista')::jsonb ->> 'fim')::timestamptz <> o.inicio + interval '12 hours' THEN
    RAISE EXCEPTION 'FALHOU: o plantonista vê a vaga em Vagas, com a janela e a candidatura (%)', pg_temp.v('vaga_lista');
  END IF;
  RAISE NOTICE 'OK  o plantonista da unidade vê a vaga em Vagas, com a janela e a própria candidatura';
  SELECT * INTO n FROM public.escala_plantao WHERE id = pg_temp.u('assumido');
  SELECT * INTO c FROM public.candidaturas_escala WHERE id = pg_temp.u('cand');
  SELECT * INTO v FROM public.escala_vagas WHERE id = pg_temp.u('vaga');
  IF n.perfil_id <> '10000000-0000-4000-8000-000000000006' OR n.inicio <> o.inicio + interval '6 hours' OR n.duracao_min <> 360
     OR n.plantao_origem_id <> o.id OR NOT n.fracionado OR n.rotulo <> 'Parte 2/2' OR c.status <> 'aprovado' OR v.fechada_em IS NULL THEN
    RAISE EXCEPTION 'FALHOU: a aprovação vira plantão da parte e fecha a vaga (% % %)', row_to_json(n), row_to_json(c), row_to_json(v);
  END IF;
  RAISE NOTICE 'OK  aprovada, a candidatura vira plantão da parte (01h–07h) e a vaga fecha';
  SELECT * INTO m FROM public.escala_plantao WHERE id = pg_temp.u('p_manha');
  IF pg_temp.v('vagas_manha')::int <> 2 OR m.fracionado OR m.duracao_min <> 360
     OR m.inicio <> private.inicio_do_turno(private.data_atual() + 3, 'manha')
     OR EXISTS (SELECT 1 FROM public.escala_vagas WHERE plantao_origem_id = m.id AND fechada_em IS NULL) THEN
    RAISE EXCEPTION 'FALHOU: 6 h em 3 e desfazer (% vagas; %)', pg_temp.v('vagas_manha'), row_to_json(m);
  END IF;
  RAISE NOTICE 'OK  6 h em 3 partes de 2 h; o gestor desfaz e o plantão volta inteiro, sem vaga aberta';
  IF (SELECT count(*) FROM public.escala_vagas v4 WHERE v4.plantao_origem_id = pg_temp.u('p_noite4')
        AND v4.data = private.data_atual() + 4 AND v4.turno = 'noite' AND v4.duracao_min = 180) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: 12 h em 4 partes de 3 h, todas na noite do dia';
  END IF;
  IF pg_temp.v('faixas4')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: a faixa com duas vagas de partes aparece uma vez só (% linhas)', pg_temp.v('faixas4');
  END IF;
  RAISE NOTICE 'OK  12 h em 4 partes de 3 h, na noite do dia; a faixa da escala não se repete';
END $$;

ROLLBACK;
