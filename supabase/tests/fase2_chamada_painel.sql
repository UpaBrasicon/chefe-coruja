-- Testes da migration 20260927000003_fase2_chamada_painel.sql
-- Banco local com o seed (enfermeiro …0004 e recepção …0005 escalados no PS).
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase2_chamada_painel.sql
BEGIN;

-- os dois de plantão AGORA no PS, independentemente da hora do seed
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

-- chamadas reais feitas no banco local não entram na conta do painel
ALTER TABLE public.chamadas DISABLE TRIGGER trg_chamadas_so_insercao;
DELETE FROM public.chamadas WHERE setor_id = '22000000-0000-4000-8000-000000000003';
ALTER TABLE public.chamadas ENABLE TRIGGER trg_chamadas_so_insercao;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO anon, authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO anon, authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
INSERT INTO t SELECT 'sala_tri', id::text FROM public.salas WHERE setor_id = '22000000-0000-4000-8000-000000000003' AND nome = 'Triagem 1';
INSERT INTO t SELECT 'sala_outra', id::text FROM public.salas WHERE setor_id <> '22000000-0000-4000-8000-000000000003' LIMIT 1;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000003')
     OR NOT EXISTS (SELECT 1 FROM public.salas WHERE setor_id = '22000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'FALHOU: recepção não enxerga as portas e salas da unidade';
  END IF;
  RAISE NOTICE 'OK  papéis novos enxergam setores e salas da unidade';
END $$;
INSERT INTO t SELECT 'epi', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Cefaleia', NULL,
  '{"nome":"Paciente Chamada Teste","nome_social":"Ana Chamada","data_nascimento":"1990-01-01"}') ->> 'episodio_id';

DO $$
DECLARE r jsonb;
BEGIN
  BEGIN
    PERFORM public.chamar_paciente(pg_temp.v('epi')::uuid, pg_temp.v('sala_tri')::uuid);
    RAISE EXCEPTION 'FALHOU: recepção chamou para a triagem';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'A chamada para a triagem é da enfermagem%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  chamada para a triagem é da enfermagem';
  END;
  INSERT INTO t VALUES ('token1', public.gerar_link_painel('22000000-0000-4000-8000-000000000003'));

  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000004');
  BEGIN
    PERFORM public.chamar_paciente(pg_temp.v('epi')::uuid, pg_temp.v('sala_outra')::uuid);
    RAISE EXCEPTION 'FALHOU: sala de outra porta aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Sala não pertence%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  só salas da própria porta';
  END;
  r := public.chamar_paciente(pg_temp.v('epi')::uuid, pg_temp.v('sala_tri')::uuid);
  r := public.chamar_paciente(pg_temp.v('epi')::uuid, pg_temp.v('sala_tri')::uuid);
  IF (r ->> 'aviso')::boolean THEN RAISE EXCEPTION 'FALHOU: aviso na 2ª chamada'; END IF;
  r := public.chamar_paciente(pg_temp.v('epi')::uuid, pg_temp.v('sala_tri')::uuid);
  IF (r ->> 'numero')::int <> 3 OR NOT (r ->> 'aviso')::boolean THEN RAISE EXCEPTION 'FALHOU: 3ª chamada sem aviso (%)', r; END IF;
  IF (SELECT etapa FROM public.episodios WHERE id = pg_temp.v('epi')::uuid) <> 'triagem' THEN
    RAISE EXCEPTION 'FALHOU: o sistema tirou o paciente da fila sozinho';
  END IF;
  RAISE NOTICE 'OK  3ª chamada gera aviso e o paciente continua na fila';
END $$;

-- a TV, sem login
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
DECLARE p jsonb := public.painel_chamadas(pg_temp.v('token1'));
BEGIN
  IF jsonb_array_length(p -> 'chamadas') <> 3 OR p -> 'chamadas' -> 0 ->> 'nome' <> 'Ana Chamada'
     OR p -> 'chamadas' -> 0 ->> 'sala' <> 'Triagem 1' THEN
    RAISE EXCEPTION 'FALHOU: painel (%)', p;
  END IF;
  -- onda 8 do porte (migration 20261008000001): a TV mostra também quem
  -- chamou (profissional) e a vez da chamada — nada mais do paciente
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p -> 'chamadas' -> 0) k) <> ARRAY['em', 'id', 'nome', 'quem', 'sala', 'vez'] THEN
    RAISE EXCEPTION 'FALHOU: painel expõe mais do que nome, sala, hora, vez e quem chamou';
  END IF;
  RAISE NOTICE 'OK  TV sem login lê só nome (social) e sala';
  BEGIN
    PERFORM public.painel_chamadas('token-errado');
    RAISE EXCEPTION 'FALHOU: token errado aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAINEL_INVALIDO' THEN RAISE; END IF;
    RAISE NOTICE 'OK  token errado não lê nada';
  END;
  BEGIN
    PERFORM 1 FROM public.chamadas;
    RAISE EXCEPTION 'FALHOU: anon leu a tabela de chamadas';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  sem login não se lê a tabela de chamadas';
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  PERFORM public.gerar_link_painel('22000000-0000-4000-8000-000000000003');
  BEGIN
    PERFORM public.painel_chamadas(pg_temp.v('token1'));
    RAISE EXCEPTION 'FALHOU: link antigo continua valendo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAINEL_INVALIDO' THEN RAISE; END IF;
    RAISE NOTICE 'OK  link novo revoga o anterior';
  END;
  BEGIN
    PERFORM public.retirar_da_fila(pg_temp.v('epi')::uuid, 'evasao', 'não veio');
    RAISE EXCEPTION 'FALHOU: retirada sem justificativa';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Justifique%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  retirar da fila exige justificativa';
  END;
  PERFORM public.retirar_da_fila(pg_temp.v('epi')::uuid, 'evasao', 'chamado três vezes, não está na recepção nem no pátio');
END $$;
RESET ROLE;

DO $$
DECLARE e public.episodios;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = pg_temp.v('epi')::uuid;
  IF e.etapa <> 'encerrado' OR e.desfecho <> 'evasao' OR e.encerrado_por <> '10000000-0000-4000-8000-000000000005' THEN
    RAISE EXCEPTION 'FALHOU: evasão (%, %, %)', e.etapa, e.desfecho, e.encerrado_por;
  END IF;
  RAISE NOTICE 'OK  evasão encerra o episódio com autor e justificativa';
  BEGIN
    UPDATE public.chamadas SET numero = 1;
    RAISE EXCEPTION 'FALHOU: chamada alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  chamadas não se alteram';
  END;
END $$;

ROLLBACK;
