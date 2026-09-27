-- Testes da migration 20260926000013_fase1_sincronizacao.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase1_sincronizacao.sql
--
-- O plantão do plantonista (…0002) na Clínica Médica terminou há 1 hora:
-- de now()-7h a now()-1h. Paciente Um está na Clínica Médica.
BEGIN;

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '7 hours', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE TEMP TABLE r (caso text, saida jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;
CREATE FUNCTION pg_temp.item(p_id text, p_hora interval, p_sem boolean, p_contato interval, p_paciente text DEFAULT '23000000-0000-4000-8000-000000000001', p_tipo text DEFAULT 'observacao')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'tipo', p_tipo, 'hora', now() - p_hora, 'sem_conexao', p_sem,
    'ultimo_contato', CASE WHEN p_contato IS NULL THEN NULL ELSE now() - p_contato END,
    'aparelho_id', 'aparelho-teste',
    'dados', jsonb_build_object('paciente_id', p_paciente, 'conceito_id', '8d3ff6a6-6240-8c0d-bcd2-09186f3b518a',
                                'valor_num', 80, 'registrado_por', '10000000-0000-4000-8000-000000000001'))
$$;
GRANT EXECUTE ON FUNCTION pg_temp.item(text, interval, boolean, interval, text, text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

INSERT INTO r SELECT 'lote', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('a0000000-0000-4000-8000-000000000001', '2 hours',    true,  '3 hours'),          -- durante o plantão
  pg_temp.item('a0000000-0000-4000-8000-000000000002', '50 minutes', true,  '2 hours 30 minutes'), -- 10 min após o fim
  pg_temp.item('a0000000-0000-4000-8000-000000000003', '40 minutes', true,  '2 hours 10 minutes'), -- 20 min após o fim
  pg_temp.item('a0000000-0000-4000-8000-000000000004', '2 hours',    true,  '4 hours 30 minutes'), -- 2h30 sem conexão
  pg_temp.item('a0000000-0000-4000-8000-000000000005', '2 hours',    true,  '3 hours', '23000000-0000-4000-8000-000000000004'), -- outro setor
  pg_temp.item('a0000000-0000-4000-8000-000000000006', '0 seconds',  false, NULL),               -- agora, sem plantão
  pg_temp.item('a0000000-0000-4000-8000-000000000007', '-1 hour',    true,  '3 hours'),          -- hora no futuro
  pg_temp.item('a0000000-0000-4000-8000-000000000008', '2 hours',    true,  '3 hours', p_tipo => 'desconhecido'),
  pg_temp.item('a0000000-0000-4000-8000-000000000009', '3 hours',    false, NULL)                -- com conexão e hora antiga
));
INSERT INTO r SELECT 'reenvio', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('a0000000-0000-4000-8000-000000000001', '2 hours', true, '3 hours')));

-- o gestor tenta reaproveitar o id de um registro do plantonista
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO r SELECT 'id_alheio', public.sincronizar_registros(jsonb_build_array(
  pg_temp.item('a0000000-0000-4000-8000-000000000001', '0 seconds', false, NULL)));

RESET ROLE;

DO $$
DECLARE
  st jsonb := (SELECT jsonb_object_agg(e ->> 'id', e ->> 'status') FROM r, jsonb_array_elements(saida) e WHERE caso = 'lote');
  mo jsonb := (SELECT jsonb_object_agg(e ->> 'id', coalesce(e ->> 'motivo', '')) FROM r, jsonb_array_elements(saida) e WHERE caso = 'lote');
  o public.observacao;
  esperado jsonb := '{
    "a0000000-0000-4000-8000-000000000001": "gravado",
    "a0000000-0000-4000-8000-000000000002": "gravado",
    "a0000000-0000-4000-8000-000000000003": "recusado",
    "a0000000-0000-4000-8000-000000000004": "recusado",
    "a0000000-0000-4000-8000-000000000005": "recusado",
    "a0000000-0000-4000-8000-000000000006": "recusado",
    "a0000000-0000-4000-8000-000000000007": "recusado",
    "a0000000-0000-4000-8000-000000000008": "recusado",
    "a0000000-0000-4000-8000-000000000009": "recusado"}';
  k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(esperado) LOOP
    IF st ->> k IS DISTINCT FROM esperado ->> k THEN
      RAISE EXCEPTION 'FALHOU: item % deveria ser %, veio % (%)', right(k, 1), esperado ->> k, st ->> k, mo ->> k;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  lote misto: 2 gravados e 7 recusados, sem derrubar o lote';
  RAISE NOTICE 'OK  motivos: 3=%  4=%  5=%  6=%',
    split_part(mo ->> 'a0000000-0000-4000-8000-000000000003', ':', 1), split_part(mo ->> 'a0000000-0000-4000-8000-000000000004', ':', 1),
    split_part(mo ->> 'a0000000-0000-4000-8000-000000000005', ':', 1), split_part(mo ->> 'a0000000-0000-4000-8000-000000000006', ':', 1);
  IF split_part(mo ->> 'a0000000-0000-4000-8000-000000000004', ':', 1) <> 'SYNC_LIMITE' THEN
    RAISE EXCEPTION 'FALHOU: 2h30 sem conexão deveria cair no limite de 2 h';
  END IF;

  SELECT * INTO o FROM public.observacao WHERE id = 'a0000000-0000-4000-8000-000000000001';
  IF NOT o.sem_conexao OR o.aparelho_id <> 'aparelho-teste'
     OR o.registrado_por <> '10000000-0000-4000-8000-000000000002'
     OR o.aferido_em > now() - interval '119 minutes' OR o.created_at <> now() THEN
    RAISE EXCEPTION 'FALHOU: marca/autor/duas horas errados (%, %, %, %)', o.sem_conexao, o.registrado_por, o.aferido_em, o.created_at;
  END IF;
  RAISE NOTICE 'OK  marcado sem conexão, autor do login (não o enviado), hora clínica e hora de chegada';

  IF (SELECT saida -> 0 ->> 'status' FROM r WHERE caso = 'reenvio') <> 'ja_recebido'
     OR (SELECT count(*) FROM public.observacao WHERE id = 'a0000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reenvio duplicou ou não respondeu ja_recebido';
  END IF;
  RAISE NOTICE 'OK  reenviar não duplica (ja_recebido)';

  IF (SELECT saida -> 0 ->> 'motivo' FROM r WHERE caso = 'id_alheio') NOT LIKE 'SYNC_ID_EM_USO%' THEN
    RAISE EXCEPTION 'FALHOU: id de outro autor foi aceito';
  END IF;
  RAISE NOTICE 'OK  id de registro alheio é recusado';
END $$;

ROLLBACK;
