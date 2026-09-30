-- Testes das telas do gestor, parte 2 (migrations 20261007000001 a …003).
-- ROLLBACK no fim. Precisa da carga do protocolo (supabase/dados/).
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_gestor_parte2.sql
-- Farmácia do gestor, Revisão Clínica vista pelo gestor, mapa de leitos,
-- revisão dos fluxogramas pela unidade (e a triagem conferindo contra ela),
-- protocolos de receita com fonte e versões, e a escala: faixas do mês,
-- marcar e retirar vaga, publicar.
BEGIN;
-- a enfermeira (…0004) no Pronto Socorro agora; a gestora é a …0001
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000004';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
   private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'frasco-ampola 1 g', 'teste-gestor-p2');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'med', id::text FROM public.medicamento WHERE fonte = 'teste-gestor-p2';
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
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
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

-- dados: uma falta sinalizada, um estoque em falta, uma pendência vencida
INSERT INTO public.faltas_medicamento (unidade_id, medicamento_id, observacao, sinalizada_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('med'), 'acabou no PS', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.estoque_medicamento (unidade_id, medicamento_id, quantidade, limite_critico, limite_falta, atualizado_por)
VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('med'), 2, 10, 3, '10000000-0000-4000-8000-000000000002');
INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id)
SELECT i.unidade_id, i.paciente_id, i.id, 'exame', 'Coletar hemocultura', now() - interval '2 hours', '10000000-0000-4000-8000-000000000002'::uuid
  FROM public.internacoes i WHERE i.paciente_id = '23000000-0000-4000-8000-000000000002' AND i.data_alta IS NULL LIMIT 1;

-- ── 1. farmácia do gestor ───────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.farmacia_do_gestor('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'o plantonista não abre a farmácia do gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'farm', public.farmacia_do_gestor('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('farm')::jsonb -> 'faltas') f
                          WHERE f ->> 'medicamento' = 'Ceftriaxona' AND f ->> 'situacao' = 'registrada'
                            AND f ->> 'sinalizada_por' = 'Plantonista de Teste'),
  'a gestora vê a falta sinalizada, com quem sinalizou');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('farm')::jsonb -> 'estoque') e
                          WHERE e ->> 'medicamento' = 'Ceftriaxona' AND e ->> 'situacao' = 'falta'),
  'o estoque vem com o selo da comparação (2 ≤ limite de falta 3: em falta)');
SELECT pg_temp.falha($$SELECT public.avancar_falta((SELECT id FROM public.faltas_medicamento WHERE medicamento_id = pg_temp.u('med')), 'reposta')$$,
  'Acompanhar a falta é do farmacêutico', 'a gestora vê, mas não mexe na falta');

-- ── 2. revisão clínica vista pelo gestor ────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM public.revisao_clinica_panorama('21000000-0000-4000-8000-000000000001')) > 0,
  'a gestora vê o panorama da revisão clínica');
SELECT pg_temp.falha($$SELECT public.decidir_versao_ferramenta('x', '1', true)$$,
  'Só o responsável técnico', 'a gestora não decide versão (é do responsável técnico)');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT * FROM public.revisao_clinica_panorama('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'o plantonista sem nomeação não abre o panorama da revisão');

-- ── 3. mapa de leitos ───────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.mapa_leitos_gestor('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado', 'o plantonista não abre o mapa de leitos do gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'mapa', public.mapa_leitos_gestor('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('mapa')::jsonb -> 'setores') s
                          WHERE s ->> 'nome' = 'Clínica Médica' AND (s ->> 'leitos_total')::int = 6),
  'o mapa traz a Clínica Médica com os 6 leitos');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('mapa')::jsonb -> 'alertas') a
                          WHERE a ->> 'selo' = 'Vencida' AND a ->> 'texto' = 'Coletar hemocultura'),
  'a pendência vencida entra nos alertas');
SELECT pg_temp.ok(pg_temp.v('mapa') NOT LIKE '%Paciente Fictício%',
  'o mapa lê por leito: nome de paciente não entra');

-- ── 4. revisão dos fluxogramas pela unidade ────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'manter')$$,
  'Só o gestor', 'a enfermeira não revisa o protocolo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok((SELECT f ->> 'estado' FROM jsonb_array_elements(
                     public.protocolo_classificacao_da_unidade('21000000-0000-4000-8000-000000000001') -> 'fluxogramas') f
                    WHERE (f ->> 'id')::uuid = pg_temp.u('flx')) = 'revisao',
  'sem decisão, o fluxograma está em revisão (vale o original)');
SELECT pg_temp.falha($$SELECT public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'alterar',
    '{"amarelo":[["Lesão bolhosa extensa",""]],"verde":[["Prurido intenso",""]]}')$$,
  'Alterar o fluxograma exige a fonte', 'alterar sem a fonte da unidade é recusado');
SELECT pg_temp.falha($$SELECT public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'alterar',
    '{"roxo":[["Qualquer coisa",""]]}', 'POP 12 da unidade, versão 3, 01/09/2026')$$,
  'Cor desconhecida', 'só as cinco cores do protocolo');
SELECT pg_temp.ok(public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'alterar',
    '{"amarelo":[["Lesão bolhosa extensa",""]],"verde":[["Prurido intenso",""]]}', 'POP 12 da unidade, versão 3, 01/09/2026') = 'alterado',
  'a gestora altera o fluxograma com a fonte');
SELECT pg_temp.ok((SELECT f -> 'discriminadores' ? 'amarelo' AND f ->> 'estado' = 'alterado' AND f ->> 'fonte_alteracao' LIKE 'POP 12%'
                     FROM jsonb_array_elements(public.protocolo_classificacao_da_unidade('21000000-0000-4000-8000-000000000001') -> 'fluxogramas') f
                    WHERE (f ->> 'id')::uuid = pg_temp.u('flx')),
  'a triagem lê os discriminadores da unidade, com a fonte');

-- a triagem confere contra a lista da unidade
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'ep', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Lesões na pele', NULL,
  '{"nome":"Adulto Protocolo Unidade","data_nascimento":"1980-01-01"}') ->> 'episodio_id');
SELECT pg_temp.falha($$SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
    '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":37,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
    pg_temp.u('flx'), 'Edema de face')$$,
  'Discriminador não pertence', 'discriminador que a unidade tirou não vale mais na triagem');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":37,"saturacao-o2":97,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Lesão bolhosa extensa');
RESET ROLE;
SELECT pg_temp.ok((SELECT discriminador_cor FROM public.classificacoes_risco WHERE episodio_id = pg_temp.u('ep')) = 'amarelo',
  'o discriminador da unidade guarda a cor de referência dele (a cor continua do enfermeiro)');
SET LOCAL ROLE authenticated;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'reabrir') = 'revisao',
  'voltar para em revisão usa o original de novo');
SELECT pg_temp.ok(public.revisar_fluxograma('21000000-0000-4000-8000-000000000001', pg_temp.u('flx'), 'alterar',
    (SELECT discriminadores FROM public.protocolo_fluxogramas WHERE id = pg_temp.u('flx'))) = 'mantido',
  'alterar para o mesmo texto do original é manter (sem exigir fonte)');
SELECT pg_temp.falha($$DELETE FROM public.classificacao_fluxograma_unidade$$, 'permission denied',
  'a revisão não se apaga por fora das funções');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.classificacao_fluxograma_unidade WHERE fluxograma_id = pg_temp.u('flx')) = 2
                  AND (SELECT count(*) FROM public.classificacao_fluxograma_unidade WHERE fluxograma_id = pg_temp.u('flx') AND vigente_ate IS NULL) = 1,
  'cada decisão é uma linha; só a última vale');
SET LOCAL ROLE authenticated;

-- ── 5. protocolos de receita: fonte e versões ──────────────────────────────
SELECT pg_temp.falha($$SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Pneumonia comunitária', 'PAC sem critério de internação',
    '[{"medicamento":"Amoxicilina 500 mg","posologia":"1 cápsula de 8/8 h por 7 dias","quantidade":"21 cápsulas"}]', NULL, true, '1')$$,
  'Publicar exige a fonte', 'publicar protocolo de receita sem fonte é recusado');
INSERT INTO t SELECT 'rp', public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Pneumonia comunitária', 'PAC sem critério de internação',
  '[{"medicamento":"Amoxicilina 500 mg","posologia":"1 cápsula de 8/8 h por 7 dias","quantidade":"21 cápsulas"}]', NULL, false)::text;
SELECT pg_temp.ok(pg_temp.u('rp') IS NOT NULL, 'rascunho (inativo) pode ficar sem fonte');
SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'Pneumonia comunitária', 'PAC sem critério de internação',
  '[{"medicamento":"Amoxicilina 500 mg","posologia":"1 cápsula de 8/8 h por 7 dias","quantidade":"21 cápsulas"}]', pg_temp.u('rp'), true,
  '2026.1', 'Protocolo de PAC da unidade, revisão de agosto de 2026');
SELECT pg_temp.ok((SELECT r ->> 'fonte' LIKE 'Protocolo de PAC%' AND (r ->> 'versoes')::int = 2 AND (r ->> 'ativo')::boolean
                     FROM jsonb_array_elements(public.receita_protocolos_da_unidade('21000000-0000-4000-8000-000000000001')) r
                    WHERE (r ->> 'id')::uuid = pg_temp.u('rp')),
  'publicado com fonte e versão; as duas gravações ficam guardadas');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.salvar_receita_protocolo('21000000-0000-4000-8000-000000000001', 'X', 'y', '[]')$$,
  'Só o gestor', 'o plantonista não escreve protocolo de receita');

-- ── 6. escala: faixas, vaga, publicar ──────────────────────────────────────
-- o mês que vem: a fixa prevê manhã de segunda na Clínica Médica; ninguém
-- escalado ainda nessa manhã
RESET ROLE;
INSERT INTO t VALUES ('mes1', to_char(date_trunc('month', private.data_atual() + interval '1 month'), 'YYYY-MM-DD'));
INSERT INTO t SELECT 'seg', min(d)::date::text FROM generate_series(pg_temp.v('mes1')::date, pg_temp.v('mes1')::date + 6, interval '1 day') d
  WHERE extract(dow FROM d) = 1;
INSERT INTO t SELECT 'ter', (pg_temp.v('seg')::date + 1)::text;
-- o mês começa vazio na unidade (o seed pode ter plantões nele); desfeito no ROLLBACK
DELETE FROM public.escala_plantao WHERE unidade_id = '21000000-0000-4000-8000-000000000001'
   AND data >= pg_temp.v('mes1')::date AND data < (pg_temp.v('mes1')::date + interval '1 month');
INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 1, 'manha');
SET LOCAL ROLE authenticated;

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.escala_mes_gestor('21000000-0000-4000-8000-000000000001', 2026, 10)$$,
  'Acesso negado', 'o plantonista não abre o mês do gestor');
SELECT pg_temp.falha($$SELECT public.publicar_escala('21000000-0000-4000-8000-000000000001', 2026, 10)$$,
  'Só o gestor', 'o plantonista não publica a escala');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
CREATE FUNCTION pg_temp.faixa(p_data text, p_turno text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT f FROM jsonb_array_elements(public.escala_mes_gestor('21000000-0000-4000-8000-000000000001',
           extract(year FROM p_data::date)::int, extract(month FROM p_data::date)::int) -> 'faixas') f
   WHERE f ->> 'data' = p_data AND f ->> 'turno' = p_turno AND f ->> 'setor_id' = '22000000-0000-4000-8000-000000000001' $$;
GRANT EXECUTE ON FUNCTION pg_temp.faixa(text, text) TO authenticated;
SELECT pg_temp.ok(pg_temp.faixa(pg_temp.v('seg'), 'manha') ->> 'situacao' = 'vaga',
  'faixa prevista pela fixa, sem ninguém: vaga aberta');
SELECT pg_temp.ok(pg_temp.faixa(pg_temp.v('ter'), 'manha') ->> 'situacao' = 'sem_plantao',
  'faixa que a fixa não prevê e sem ninguém: sem plantão');
SELECT pg_temp.falha($$SELECT public.publicar_escala('21000000-0000-4000-8000-000000000001',
    extract(year FROM pg_temp.v('mes1')::date)::int, extract(month FROM pg_temp.v('mes1')::date)::int)$$,
  'Não há plantão neste mês', 'não se publica mês sem plantão');

-- marcar vaga na terça: vira vaga e avisa o plantonista
INSERT INTO t SELECT 'vaga', public.marcar_vaga_escala('22000000-0000-4000-8000-000000000001', pg_temp.v('ter')::date, 'tarde', 'cobertura de férias')::text;
SELECT pg_temp.ok(pg_temp.faixa(pg_temp.v('ter'), 'tarde') ->> 'situacao' = 'vaga', 'a vaga marcada aparece como vaga aberta');
SELECT pg_temp.ok(public.marcar_vaga_escala('22000000-0000-4000-8000-000000000001', pg_temp.v('ter')::date, 'tarde') = pg_temp.u('vaga'),
  'marcar de novo não duplica');
SELECT pg_temp.falha($$SELECT public.marcar_vaga_escala('22000000-0000-4000-8000-000000000001', private.data_atual() - 1, 'manha')$$,
  'Não se marca vaga em dia que já passou', 'vaga não se marca no passado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo = 'vaga_' || pg_temp.v('vaga')),
  'o plantonista da unidade recebe o aviso da vaga');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.escala_vagas WHERE id = pg_temp.u('vaga')), 'o plantonista lê a vaga marcada');
SELECT pg_temp.falha($$SELECT public.retirar_vaga_escala(pg_temp.u('vaga'))$$, 'Só o gestor', 'o plantonista não retira vaga');

-- escalar alguém na segunda de manhã cobre a faixa; publicar conta a vaga da terça
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.adicionar_plantao_escala('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', pg_temp.v('seg')::date, 'manha');
SELECT pg_temp.ok(pg_temp.faixa(pg_temp.v('seg'), 'manha') ->> 'situacao' = 'coberto', 'com plantonista escalado a faixa fica coberta');
SELECT pg_temp.ok(public.publicar_escala('21000000-0000-4000-8000-000000000001',
    extract(year FROM pg_temp.v('mes1')::date)::int, extract(month FROM pg_temp.v('mes1')::date)::int, 'primeira versão') = 1,
  'a gestora publica a versão 1 do mês');
INSERT INTO t SELECT 'pub', (public.escala_mes_gestor('21000000-0000-4000-8000-000000000001',
    extract(year FROM pg_temp.v('mes1')::date)::int, extract(month FROM pg_temp.v('mes1')::date)::int) -> 'publicacao')::text;
SELECT pg_temp.ok((pg_temp.v('pub')::jsonb ->> 'versao')::int = 1 AND (pg_temp.v('pub')::jsonb ->> 'plantoes')::int = 1
                  AND (pg_temp.v('pub')::jsonb ->> 'vagas')::int >= 1 AND (pg_temp.v('pub')::jsonb ->> 'alteracoes_depois')::int = 0,
  'a publicação guarda versão, plantões e vagas daquele instante');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE tipo LIKE 'escala_publicada_%_v1'),
  'quem está escalado no mês recebe o aviso da publicação');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.historico_escala WHERE acao = 'publicar' AND dados ->> 'versao' = '1'),
  'a publicação entra no histórico da escala');
SELECT pg_temp.falha($$UPDATE public.escala_publicacoes SET vagas = 0$$, 'escala_publicacoes é só de inserção', 'a publicação não se altera');
-- na transação now() é fixo: o que veio antes da publicação vai para trás no relógio
ALTER TABLE public.escala_publicacoes DISABLE TRIGGER trg_escala_publicacoes_so_insercao;
UPDATE public.escala_publicacoes SET publicada_em = now() - interval '1 minute' WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
ALTER TABLE public.escala_publicacoes ENABLE TRIGGER trg_escala_publicacoes_so_insercao;
UPDATE public.historico_escala SET created_at = now() - interval '2 minutes' WHERE unidade_id = '21000000-0000-4000-8000-000000000001' AND created_at >= now() - interval '1 second';
SET LOCAL ROLE authenticated;

-- mudar depois de publicar aparece; publicar de novo é a versão 2
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.adicionar_plantao_escala('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', pg_temp.v('ter')::date, 'tarde');
SELECT pg_temp.ok((public.escala_mes_gestor('21000000-0000-4000-8000-000000000001',
    extract(year FROM pg_temp.v('mes1')::date)::int, extract(month FROM pg_temp.v('mes1')::date)::int) -> 'publicacao' ->> 'alteracoes_depois')::int >= 1,
  'mudança depois da publicação aparece como alterada');
SELECT pg_temp.ok(pg_temp.faixa(pg_temp.v('ter'), 'tarde') ->> 'situacao' = 'coberto', 'a vaga marcada coberta não conta mais como vaga');
SELECT pg_temp.ok(public.publicar_escala('21000000-0000-4000-8000-000000000001',
    extract(year FROM pg_temp.v('mes1')::date)::int, extract(month FROM pg_temp.v('mes1')::date)::int) = 2,
  'publicar de novo é a versão 2');
SELECT public.retirar_vaga_escala(pg_temp.u('vaga'));
RESET ROLE;
SELECT pg_temp.ok((SELECT fechada_em IS NOT NULL FROM public.escala_vagas WHERE id = pg_temp.u('vaga')), 'a gestora retira a vaga');

ROLLBACK;
