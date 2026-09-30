-- Testes da migration 20260927000009_fase2_documentos_episodio.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase2_documentos.sql
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor jsonb) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ficha', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Lombalgia', NULL,
  '{"nome":"Documento Teste","data_nascimento":"1980-01-01"}');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'at1', public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'atestado', '{"dias":1}');
INSERT INTO t SELECT 'at1b', public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'atestado', '{"dias":1}');
INSERT INTO t SELECT 'at2', public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'atestado', '{"dias":2}');
INSERT INTO t SELECT 'rec', public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'receita', '{"itens":["dipirona"]}');

DO $$ BEGIN
  BEGIN
    PERFORM public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'atestado', '{"dias":3}', NULL,
      (pg_temp.v('at2') ->> 'id')::uuid, 'curto');
    RAISE EXCEPTION 'FALHOU: retificação sem motivo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Informe o motivo%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  retificar exige motivo';
  END;
  INSERT INTO t SELECT 'ret', public.emitir_documento((pg_temp.v('ficha') ->> 'paciente_id')::uuid, 'atestado', '{"dias":3}', NULL,
    (pg_temp.v('at2') ->> 'id')::uuid, 'dias corrigidos após reavaliação');
END $$;
RESET ROLE;

DO $$
DECLARE a1 public.documentos_clinicos; a2 public.documentos_clinicos; re public.documentos_clinicos; epi uuid := (pg_temp.v('ficha') ->> 'episodio_id')::uuid;
BEGIN
  SELECT * INTO a1 FROM public.documentos_clinicos WHERE id = (pg_temp.v('at1') ->> 'id')::uuid;
  SELECT * INTO a2 FROM public.documentos_clinicos WHERE id = (pg_temp.v('at2') ->> 'id')::uuid;
  SELECT * INTO re FROM public.documentos_clinicos WHERE id = (pg_temp.v('ret') ->> 'id')::uuid;
  IF a1.episodio_id <> epi OR a2.episodio_id <> epi THEN RAISE EXCEPTION 'FALHOU: documento sem o episódio aberto'; END IF;
  RAISE NOTICE 'OK  documento pertence ao episódio aberto do paciente';
  IF a1.documento_raiz_id = a2.documento_raiz_id OR a2.versao <> 1 OR a1.estado <> 'ativo' THEN
    RAISE EXCEPTION 'FALHOU: segundo atestado virou retificação do primeiro';
  END IF;
  RAISE NOTICE 'OK  segundo atestado é documento novo, não retificação';
  IF (pg_temp.v('at1b') ->> 'id') <> (pg_temp.v('at1') ->> 'id') THEN RAISE EXCEPTION 'FALHOU: duplo clique duplicou'; END IF;
  RAISE NOTICE 'OK  duplo clique não duplica';
  IF a1.numero !~ '^\d{4}/\d{6}$' OR a1.numero = a2.numero THEN RAISE EXCEPTION 'FALHOU: numeração (%, %)', a1.numero, a2.numero; END IF;
  RAISE NOTICE 'OK  cada documento tem número próprio da unidade (% / %)', a1.numero, a2.numero;
  IF re.documento_raiz_id <> a2.documento_raiz_id OR re.versao <> 2
     OR (SELECT estado FROM public.documentos_clinicos WHERE id = a2.id) <> 'retificado' THEN
    RAISE EXCEPTION 'FALHOU: retificação explícita';
  END IF;
  RAISE NOTICE 'OK  retificação explícita gera versão 2 e marca a anterior';
END $$;

-- folha provisória: sincroniza como documento sem conexão, com impressão registrada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'sync', public.sincronizar_registros(jsonb_build_array(jsonb_build_object(
  'id', 'd0000000-0000-4000-8000-000000000001', 'tipo', 'documento', 'hora', now() - interval '20 minutes',
  'sem_conexao', true, 'ultimo_contato', now() - interval '50 minutes', 'aparelho_id', 'aparelho-teste',
  'dados', jsonb_build_object('paciente_id', pg_temp.v('ficha') ->> 'paciente_id', 'tipo', 'receita', 'conteudo', '{"itens":["paracetamol"]}'))));
INSERT INTO t SELECT 'sync2', public.sincronizar_registros(jsonb_build_array(jsonb_build_object(
  'id', 'd0000000-0000-4000-8000-000000000001', 'tipo', 'documento', 'hora', now() - interval '20 minutes',
  'sem_conexao', true, 'ultimo_contato', now() - interval '50 minutes', 'aparelho_id', 'aparelho-teste',
  'dados', jsonb_build_object('paciente_id', pg_temp.v('ficha') ->> 'paciente_id', 'tipo', 'receita', 'conteudo', '{"itens":["paracetamol"]}'))));
RESET ROLE;
DO $$
DECLARE d public.documentos_clinicos;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = 'd0000000-0000-4000-8000-000000000001';
  IF (pg_temp.v('sync') -> 0 ->> 'status') <> 'gravado' OR NOT d.sem_conexao OR d.numero IS NULL
     OR d.emitido_em > now() - interval '19 minutes' OR d.episodio_id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: folha provisória sincronizada (%)', pg_temp.v('sync');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario WHERE documento_id = d.id AND tipo_acesso = 'impressao'
                   AND documento_tipo = 'Folha provisória (sem conexão)') THEN
    RAISE EXCEPTION 'FALHOU: impressão provisória não registrada';
  END IF;
  IF (pg_temp.v('sync2') -> 0 ->> 'status') <> 'ja_recebido' THEN RAISE EXCEPTION 'FALHOU: reenvio duplicou'; END IF;
  RAISE NOTICE 'OK  folha provisória: ao voltar a conexão ganha número, hora do fato, episódio e impressão registrada';
  RAISE NOTICE 'OK  reenviar a folha provisória não duplica';
END $$;
ROLLBACK;
