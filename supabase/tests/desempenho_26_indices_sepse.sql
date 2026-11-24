-- Testes da migration 20270419000020 (pedido 26, F8 de 23/11/2026): os três
-- índices das tabelas do aviso de sepse existem, e a busca do "dispensado"
-- passa a ter caminho por índice.
BEGIN;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;

SELECT pg_temp.confere(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
  AND indexname = 'avisos_sepse_atendimento_episodio_idx'
  AND indexdef LIKE '%(episodio_id, nivel, evento)%'), 'índice do dispensado por episódio, nível e evento');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
  AND indexname = 'avisos_sepse_atendimento_paciente_fk_idx'), 'índice da chave de paciente do aviso da porta');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
  AND indexname = 'alertas_sepse_internacao_paciente_fk_idx'), 'índice da chave de paciente do alerta da internação');

SET LOCAL enable_seqscan = off;
CREATE FUNCTION pg_temp.plano() RETURNS text LANGUAGE plpgsql AS $$
DECLARE l text; t text := '';
BEGIN
  FOR l IN EXPLAIN SELECT 1 FROM public.avisos_sepse_atendimento x
    WHERE x.episodio_id = '00000000-0000-4000-8000-000000000001' AND x.nivel = 'alto' AND x.evento = 'dispensado'
  LOOP t := t || l || chr(10); END LOOP;
  RETURN t;
END $$;
SELECT pg_temp.confere(pg_temp.plano() NOT LIKE '%Seq Scan%', 'busca do dispensado usa índice quando o seq scan sai');

ROLLBACK;
