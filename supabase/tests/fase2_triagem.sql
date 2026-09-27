-- Testes da migration 20260927000002_fase2_triagem_classificacao.sql
-- Precisa da carga supabase/dados/protocolo_aparecida_2025.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase2_triagem.sql
BEGIN;

-- enfermeiro de teste e o plantonista do seed, os dois escalados AGORA no PS
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-4000-8000-0000000000e1', 'enf@triagem.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000e1', 'Enfermeira de Teste')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000e1', '21000000-0000-4000-8000-000000000001', 'enfermeiro');
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-000000000002']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;
INSERT INTO ids SELECT 'flx_adulto', id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
INSERT INTO ids SELECT 'flx_ped', id FROM public.protocolo_fluxogramas WHERE publico = 'pediatrico' ORDER BY ordem LIMIT 1;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000e1');
INSERT INTO ids SELECT 'epi_adulto', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema de face súbito', NULL,
  '{"nome":"Adulto Triagem Teste","data_nascimento":"1980-01-01"}') ->> 'episodio_id')::uuid;
INSERT INTO ids SELECT 'epi_crianca', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Criança Triagem Teste","data_nascimento":"2019-06-01"}') ->> 'episodio_id')::uuid;

DO $$
DECLARE
  vitais_sem_pa jsonb := '{"frequencia-cardiaca":110,"frequencia-respiratoria":24,"temperatura":38.2,"saturacao-o2":96,"escala-dor":3}';
  vitais jsonb := vitais_sem_pa || '{"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":85}';
BEGIN
  -- o médico não faz a primeira classificação
  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000002');
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'laranja', vitais, pg_temp.id('flx_adulto'), 'Edema de face');
    RAISE EXCEPTION 'FALHOU: médico fez a primeira classificação';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%é do enfermeiro%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  a primeira classificação é do enfermeiro';
  END;

  PERFORM pg_temp.como('10000000-0000-4000-8000-0000000000e1');
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'laranja', vitais_sem_pa, pg_temp.id('flx_adulto'), 'Edema de face');
    RAISE EXCEPTION 'FALHOU: adulto sem PA aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Sinal vital obrigatório ausente: pressao arterial%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  no adulto a PA é obrigatória';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'laranja', vitais, pg_temp.id('flx_adulto'), 'Discriminador inventado');
    RAISE EXCEPTION 'FALHOU: discriminador fora do fluxograma aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Discriminador não pertence%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  discriminador tem de ser do fluxograma';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'laranja', vitais, pg_temp.id('flx_ped'), 'x');
    RAISE EXCEPTION 'FALHOU: fluxograma pediátrico em adulto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Fluxograma de outro público%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  fluxograma do público errado é recusado';
  END;

  -- a enfermeira escolhe AMARELO num discriminador que o protocolo põe em LARANJA: vale a dela
  PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
    '{"avdi":"A"}');
  -- criança sem PA
  PERFORM public.classificar_risco(pg_temp.id('epi_crianca'), 'verde', vitais_sem_pa, pg_temp.id('flx_ped'),
    (SELECT d ->> 0 FROM public.protocolo_fluxogramas f, jsonb_each(f.discriminadores) c, jsonb_array_elements(c.value) d
      WHERE f.id = pg_temp.id('flx_ped') LIMIT 1));
  RAISE NOTICE 'OK  pediatria classifica sem PA';

  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'vermelho', vitais, NULL, NULL, '{}', NULL, 'piora do quadro agora');
    RAISE EXCEPTION 'FALHOU: enfermeiro reclassificou';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Só o médico reclassifica%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  enfermeiro não reclassifica';
  END;

  PERFORM pg_temp.como('10000000-0000-4000-8000-000000000002');
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'verde', vitais, NULL, NULL, '{}', NULL, 'reavaliado no consultório');
    RAISE EXCEPTION 'FALHOU: baixou a prioridade sem justificativa';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Baixar a prioridade exige%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  baixar a prioridade exige justificativa';
  END;
  PERFORM public.classificar_risco(pg_temp.id('epi_adulto'), 'verde', vitais, NULL, NULL, '{}', NULL,
    'reavaliado no consultório', 'edema regrediu após anti-histamínico, sem sinais de via aérea');
END $$;

RESET ROLE;

DO $$
DECLARE e public.episodios; n integer; c public.classificacoes_risco;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = pg_temp.id('epi_adulto');
  SELECT count(*) INTO n FROM public.classificacoes_risco WHERE episodio_id = e.id;
  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = e.id AND NOT reclassificacao;
  IF e.cor_atual <> 'verde' OR e.etapa <> 'atendimento' OR n <> 2 THEN
    RAISE EXCEPTION 'FALHOU: episódio/histórico errados (%, %, %)', e.cor_atual, e.etapa, n;
  END IF;
  IF c.cor <> 'amarelo' OR c.discriminador_cor <> 'laranja' OR c.autor_papel <> 'enfermeiro' THEN
    RAISE EXCEPTION 'FALHOU: cor escolhida/cor do protocolo (%, %)', c.cor, c.discriminador_cor;
  END IF;
  RAISE NOTICE 'OK  vale a cor do enfermeiro; a do protocolo fica ao lado, como referência';
  RAISE NOTICE 'OK  médico reclassifica com motivo e justificativa; histórico com as duas';
  IF (SELECT count(*) FROM public.observacao WHERE episodio_id = e.id) <> 14 THEN
    RAISE EXCEPTION 'FALHOU: sinais vitais da triagem e da reclassificação não ficaram no episódio';
  END IF;
  RAISE NOTICE 'OK  sinais vitais gravados no episódio (triagem + reclassificação)';
  IF (SELECT publico FROM public.episodios WHERE id = pg_temp.id('epi_crianca')) <> 'pediatrico' THEN
    RAISE EXCEPTION 'FALHOU: público da criança';
  END IF;
  BEGIN
    UPDATE public.classificacoes_risco SET cor = 'vermelho' WHERE id = c.id;
    RAISE EXCEPTION 'FALHOU: classificação alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  histórico de classificação não se altera';
  END;
END $$;

ROLLBACK;
