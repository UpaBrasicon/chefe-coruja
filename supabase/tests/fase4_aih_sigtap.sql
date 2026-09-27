-- Testes da migration 20260929000003_fase4_aih_sigtap.sql. ROLLBACK no fim.
-- As tabelas de terminologia vêm vazias no banco local: o teste traz uma
-- amostra fiel ao SIGTAP 08/2026 (tratamento de pneumonia e de fratura).
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
        private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

INSERT INTO terminologia.cid10 (codigo, descricao) VALUES
  ('J18.9', 'Pneumonia não especificada'), ('J18', 'Pneumonia por microorganismo não especificada'),
  ('S72.0', 'Fratura do colo do fêmur'), ('W19', 'Queda sem especificação'), ('N40', 'Hiperplasia da próstata')
ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303140151', 'Tratamento de pneumonias ou influenza (gripe)', '2', 'I', 0, 1571, '202608'),
  ('0408050489', 'Tratamento cirúrgico de fratura do colo do fêmur', '2', 'I', 0, 1571, '202608'),
  ('0409030040', 'Ressecção endoscópica de próstata', '2', 'M', 216, 1571, '202608')
ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento_cid (procedimento, cid, principal, competencia) VALUES
  ('0303140151', 'J18.9', true, '202608'),
  ('0408050489', 'S72.0', true, '202608'),
  ('0409030040', 'N40', true, '202608')
ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (unidade_id, nome, data_nascimento, sexo)
VALUES ('21000000-0000-4000-8000-000000000001', 'Aih Teste Mulher', '1990-01-01', 'F');
UPDATE public.pacientes SET setor_id = '22000000-0000-4000-8000-000000000003' WHERE nome = 'Aih Teste Mulher';

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'pac', id::text FROM public.pacientes WHERE nome = 'Aih Teste Mulher';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor::jsonb FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.v(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO t SELECT 'ok', public.conferir_aih(pg_temp.u('pac'), 'j189', NULL, NULL, '03.03.14.015-1')::text;
INSERT INTO t SELECT 'incomp', public.conferir_aih(pg_temp.u('pac'), 'J18.9', NULL, NULL, '0408050489')::text;
INSERT INTO t SELECT 'st', public.conferir_aih(pg_temp.u('pac'), 'S72.0', NULL, NULL, '0408050489')::text;
INSERT INTO t SELECT 'st2', public.conferir_aih(pg_temp.u('pac'), 'S72.0', NULL, 'W19', '0408050489')::text;
INSERT INTO t SELECT 'sexo', public.conferir_aih(pg_temp.u('pac'), 'N40', NULL, NULL, '0409030040')::text;
INSERT INTO t SELECT 'lista', (SELECT jsonb_agg(codigo) FROM public.procedimentos_do_cid('J18.9'))::text;
INSERT INTO t SELECT 'busca', (SELECT jsonb_agg(codigo) FROM public.procedimentos_do_cid(NULL, 'pneumon'))::text;
RESET ROLE;

DO $$
DECLARE txt text;
BEGIN
  IF jsonb_array_length(pg_temp.v('ok') -> 'avisos') <> 0 THEN RAISE EXCEPTION 'FALHOU: AIH correta com aviso (%)', pg_temp.v('ok'); END IF;
  RAISE NOTICE 'OK  AIH compatível não gera aviso (CID e código aceitos com ou sem pontuação)';
  SELECT string_agg(x ->> 'texto', ' | ') INTO txt FROM jsonb_array_elements(pg_temp.v('incomp') -> 'avisos') x;
  IF txt NOT LIKE '%não é compatível com o CID J18.9%' THEN RAISE EXCEPTION 'FALHOU: incompatível (%)', txt; END IF;
  RAISE NOTICE 'OK  procedimento incompatível com o CID gera aviso de glosa (sem bloquear)';
  SELECT string_agg(x ->> 'texto', ' | ') INTO txt FROM jsonb_array_elements(pg_temp.v('st') -> 'avisos') x;
  IF txt NOT LIKE '%causa externa%' OR jsonb_array_length(pg_temp.v('st2') -> 'avisos') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: CID S/T e causa externa (%, %)', txt, pg_temp.v('st2');
  END IF;
  RAISE NOTICE 'OK  CID S/T pede causa externa (V01–Y98); com W19 o aviso some';
  SELECT string_agg(x ->> 'texto', ' | ') INTO txt FROM jsonb_array_elements(pg_temp.v('sexo') -> 'avisos') x;
  IF txt NOT LIKE '%exclusivo do sexo masculino%' THEN RAISE EXCEPTION 'FALHOU: sexo (%)', txt; END IF;
  RAISE NOTICE 'OK  procedimento de sexo exclusivo avisa quando não bate com o paciente';
  IF pg_temp.v('lista') <> '["0303140151"]'::jsonb OR NOT pg_temp.v('busca') ? '0303140151' THEN
    RAISE EXCEPTION 'FALHOU: lista por CID (%, %)', pg_temp.v('lista'), pg_temp.v('busca');
  END IF;
  RAISE NOTICE 'OK  a lista de procedimentos é filtrada pelo CID principal; sem CID, busca por nome';
END $$;
ROLLBACK;
