-- Testes da migration 20261126000001_desfecho_sempre_com_data.sql (Portão 2,
-- tarefa 7, R2-09): a exclusão da fila grava a data e o autor do desfecho, a
-- evasão entra no indicador de 7 dias e nenhum desfecho fica sem data. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005',
        private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id = '10000000-0000-4000-8000-000000000005' AND e.data = private.data_atual()
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
INSERT INTO t SELECT 'ev', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Saiu Sem Avisar","data_nascimento":"1980-01-01"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'dup', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Ficha Por Engano","data_nascimento":"1981-01-01"}'::jsonb) ->> 'episodio_id';
SELECT public.retirar_da_fila(pg_temp.u('ev'), 'evasao', 'paciente saiu sem avisar ninguém');
SELECT public.retirar_da_fila(pg_temp.u('dup'), 'engano', 'ficha aberta no paciente errado');
RESET ROLE;

DO $$
DECLARE a public.episodios; b public.episodios;
BEGIN
  SELECT * INTO a FROM public.episodios WHERE id = pg_temp.u('ev');
  SELECT * INTO b FROM public.episodios WHERE id = pg_temp.u('dup');
  IF a.desfecho <> 'evasao' OR a.desfecho_em IS NULL OR a.desfecho_por <> '10000000-0000-4000-8000-000000000005'
     OR a.desfecho_em <> a.encerrado_em THEN
    RAISE EXCEPTION 'FALHOU: evasão pela fila sem data/autor do desfecho: % %', a.desfecho_em, a.desfecho_por;
  END IF;
  IF b.desfecho <> 'cancelado' OR b.desfecho_em IS NULL THEN
    RAISE EXCEPTION 'FALHOU: cancelamento sem data do desfecho';
  END IF;
  RAISE NOTICE 'OK  exclusão da fila grava data e autor do desfecho (evasão e cancelamento)';
END $$;

-- o indicador de 7 dias conta a evasão (por desfecho_em); cancelamento não é evasão
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO t SELECT 'pano', public.panorama_gestor('21000000-0000-4000-8000-000000000001')::text;
RESET ROLE;
DO $$
DECLARE n int := ((SELECT v FROM t WHERE k = 'pano')::jsonb -> 'n' ->> 'evasoes_7d')::int;
BEGIN
  IF n <> (SELECT count(*) FROM public.episodios WHERE unidade_id = '21000000-0000-4000-8000-000000000001'
             AND desfecho = 'evasao' AND desfecho_em > now() - interval '7 days') OR n < 1 THEN
    RAISE EXCEPTION 'FALHOU: indicador de evasão (%) não bate com o banco', n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.episodios WHERE desfecho IS NOT NULL AND desfecho_em IS NULL) THEN
    RAISE EXCEPTION 'FALHOU: ainda há desfecho sem data';
  END IF;
  RAISE NOTICE 'OK  evasão pela fila entra no indicador de 7 dias; nenhum desfecho sem data';
END $$;

-- 4a. a regra no banco recusa desfecho sem data
DO $$ BEGIN
  BEGIN
    UPDATE public.episodios SET desfecho_em = NULL WHERE id = pg_temp.u('ev');
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK  desfecho sem data é recusado pelo banco'; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: desfecho sem data passou';
END $$;
ROLLBACK;
