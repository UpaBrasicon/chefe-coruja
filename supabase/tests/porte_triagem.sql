-- Testes da migration 20261003000004_triagem_completa.sql
-- Precisa da carga supabase/dados/protocolo_aparecida_2025.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_triagem.sql
BEGIN;

-- enfermeiro de teste e o plantonista do seed, os dois escalados AGORA no PS
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-4000-8000-0000000000e3', 'enf@porte-triagem.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000e3', 'Enfermeira Porte Triagem')
  ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000e3', '21000000-0000-4000-8000-000000000001', 'enfermeiro');
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-0000000000e3', '10000000-0000-4000-8000-000000000002']::uuid[]) p;
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
CREATE FUNCTION pg_temp.disc_ped() RETURNS text LANGUAGE sql AS $$
  SELECT d ->> 0 FROM public.protocolo_fluxogramas f, jsonb_each(f.discriminadores) c, jsonb_array_elements(c.value) d
   WHERE f.id = (SELECT id FROM ids WHERE nome = 'flx_ped') LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION pg_temp.disc_ped() TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000e3');
INSERT INTO ids SELECT 'epi_homem', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Lesão na pele', NULL,
  '{"nome":"Homem Porte Triagem","data_nascimento":"1980-01-01","sexo":"M"}') ->> 'episodio_id')::uuid;
INSERT INTO ids SELECT 'epi_mulher', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Manchas na pele', NULL,
  '{"nome":"Mulher Porte Triagem","data_nascimento":"1995-03-10","sexo":"F"}') ->> 'episodio_id')::uuid;
-- 15 anos: adulto pela idade
INSERT INTO ids SELECT 'epi_troca', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  jsonb_build_object('nome', 'Adolescente Porte Triagem', 'data_nascimento', (private.data_atual() - interval '15 years 2 days')::date)) ->> 'episodio_id')::uuid;
-- 2 anos: FLACC
INSERT INTO ids SELECT 'epi_crianca', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Choro e febre', NULL,
  jsonb_build_object('nome', 'Criança Porte Triagem', 'data_nascimento', (private.data_atual() - interval '2 years')::date)) ->> 'episodio_id')::uuid;
INSERT INTO ids SELECT 'epi_compat', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  jsonb_build_object('nome', 'Chamada Antiga Porte Triagem', 'data_nascimento', (private.data_atual() - interval '6 years')::date)) ->> 'episodio_id')::uuid;

DO $$
DECLARE
  sem_pa jsonb := '{"frequencia-cardiaca":110,"frequencia-respiratoria":24,"temperatura":38.2,"saturacao-o2":96,"escala-dor":3}';
  vitais jsonb := sem_pa || '{"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":85}';
  flacc3 jsonb := '{"escala":"flacc","itens":{"face":1,"pernas":0,"atividade":1,"choro":1,"consolo":0},"total":3}';
  n integer;
BEGIN
  PERFORM pg_temp.como('10000000-0000-4000-8000-0000000000e3');

  -- ── discriminador livre ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Lesão extensa em dorso');
    RAISE EXCEPTION 'FALHOU: discriminador livre sem marcar aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Discriminador não pertence%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  discriminador fora da lista só entra marcado como livre';
  END;

  -- ── dor ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_dor => flacc3);
    RAISE EXCEPTION 'FALHOU: FLACC no adulto aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'NIPS e FLACC são escalas pediátricas%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  NIPS/FLACC não entram no grupo adulto';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais || '{"escala-dor":11}', pg_temp.id('flx_adulto'), 'Edema de face',
      p_dor => '{"escala":"numerica"}');
    RAISE EXCEPTION 'FALHOU: dor 11 aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Dor pela escala numérica vai de 0 a 10%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  escala numérica de 0 a 10';
  END;

  -- ── oxigênio ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_oxigenio => '{"modo":"ar_ambiente","litros_min":2}');
    RAISE EXCEPTION 'FALHOU: L/min em ar ambiente aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Fluxo de O₂ só se informa com O₂%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  L/min só com O₂ suplementar';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_oxigenio => '{"modo":"cateter"}');
    RAISE EXCEPTION 'FALHOU: modo de O₂ desconhecido aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Informe se a SpO₂ foi medida%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  modo da SpO₂: ar ambiente ou O₂ suplementar';
  END;

  -- ── Glasgow ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face', '{"glasgow":16}');
    RAISE EXCEPTION 'FALHOU: Glasgow 16 aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Glasgow vai de 3 a 15%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  Glasgow de 3 a 15';
  END;

  -- ── gestação ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_gestacao => '{"tipo":"gestacao_unica"}');
    RAISE EXCEPTION 'FALHOU: gestação em paciente masculino aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Gestação não se aplica%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  gestação não se registra para sexo masculino';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_mulher'), 'verde', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_gestacao => jsonb_build_object('tipo', 'gestacao_unica', 'dum', private.data_atual() + 1));
    RAISE EXCEPTION 'FALHOU: DUM no futuro aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'A DUM não pode ser depois de hoje%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  DUM no futuro é recusada';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_mulher'), 'verde', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_gestacao => jsonb_build_object('tipo', 'gestacao_unica', 'dum', private.data_atual() - 30, 'dum_nao_informada', true));
    RAISE EXCEPTION 'FALHOU: DUM e "não informada" juntas aceitas';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Informe a DUM ou marque%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  DUM e "DUM não informada" não vão juntas';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_mulher'), 'verde', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
      p_gestacao => '{"tipo":"gestacao_unica","intercorrencias":true}');
    RAISE EXCEPTION 'FALHOU: intercorrência sem descrição aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Descreva as intercorrências%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  intercorrência pede descrição';
  END;

  -- sucesso: homem com discriminador livre, dor numérica, O₂ 2 L/min, queixa revista
  PERFORM public.classificar_risco(pg_temp.id('epi_homem'), 'amarelo', vitais, pg_temp.id('flx_adulto'), 'Lesão extensa em dorso',
    '{"glasgow":15,"avdi":"A"}', NULL, NULL, NULL,
    p_queixa => 'Lesão avermelhada no dorso há 2 dias', p_discriminador_livre => true,
    p_dor => '{"escala":"numerica","total":3}', p_oxigenio => '{"modo":"o2_suplementar","litros_min":2}');
  -- sucesso: mulher gestante com DUM há 120 dias
  PERFORM public.classificar_risco(pg_temp.id('epi_mulher'), 'verde', vitais, pg_temp.id('flx_adulto'), 'Edema de face',
    p_gestacao => jsonb_build_object('tipo', 'gestacao_unica', 'g', 2, 'p', 1, 'a', 0,
      'dum', private.data_atual() - 120, 'ig_semanas', 3, 'dpp', '2000-01-01', 'observacao', ' pré-natal na UBS '));

  -- ── grupo trocado à mão ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_troca'), 'verde', sem_pa, pg_temp.id('flx_ped'), pg_temp.disc_ped(), '{}', 'pediatrico');
    RAISE EXCEPTION 'FALHOU: p_publico sem p_grupo_trocado mudou o grupo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Fluxograma de outro público%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  sem marcar a troca, vale o grupo da idade';
  END;
  PERFORM public.classificar_risco(pg_temp.id('epi_troca'), 'verde', sem_pa, pg_temp.id('flx_ped'), pg_temp.disc_ped(), '{}', 'pediatrico',
    p_grupo_trocado => true, p_dor => flacc3);
  RAISE NOTICE 'OK  troca à mão para pediatria: PA opcional e FLACC aceitas';

  -- ── criança: FLACC ──
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_crianca'), 'amarelo', sem_pa, pg_temp.id('flx_ped'), pg_temp.disc_ped(),
      p_dor => '{"escala":"flacc","itens":{"face":1,"pernas":0,"atividade":1,"choro":1}}');
    RAISE EXCEPTION 'FALHOU: FLACC incompleta aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Marque todos os itens da FLACC%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  FLACC exige os cinco itens';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_crianca'), 'amarelo', sem_pa || '{"escala-dor":5}', pg_temp.id('flx_ped'), pg_temp.disc_ped(),
      p_dor => flacc3);
    RAISE EXCEPTION 'FALHOU: dor diferente da soma aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'A dor registrada (5) não é a soma%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  a dor registrada é a soma dos itens';
  END;
  BEGIN
    PERFORM public.classificar_risco(pg_temp.id('epi_crianca'), 'amarelo', sem_pa || '{"escala-dor":2}', pg_temp.id('flx_ped'), pg_temp.disc_ped(),
      p_dor => '{"escala":"nips","itens":{"face":1,"choro":0,"resp":0,"bracos":0,"pernas":0,"alerta":0,"extra":1}}');
    RAISE EXCEPTION 'FALHOU: item inventado aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Item extra não existe na NIPS%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  item fora da escala é recusado';
  END;
  PERFORM public.classificar_risco(pg_temp.id('epi_crianca'), 'amarelo', sem_pa, pg_temp.id('flx_ped'), pg_temp.disc_ped(), p_dor => flacc3);

  -- chamada antiga, só com os parâmetros da Fase 2.2 (posicionais)
  PERFORM public.classificar_risco(pg_temp.id('epi_compat'), 'verde', sem_pa, pg_temp.id('flx_ped'), pg_temp.disc_ped(), '{"avdi":"A"}', NULL);
  RAISE NOTICE 'OK  chamada com os parâmetros antigos continua valendo';

  -- ── histórico ──
  BEGIN
    PERFORM * FROM public.classificacoes_do_episodio(pg_temp.id('epi_homem'));
    RAISE EXCEPTION 'FALHOU: histórico lido sem prontuário aberto depois da triagem';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Acesso negado%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  depois da triagem o histórico pede prontuário aberto';
  END;
END $$;

-- ficha ainda na triagem: o enfermeiro de plantão lê o histórico (vazio)
SELECT pg_temp.como('10000000-0000-4000-8000-0000000000e3');
INSERT INTO ids SELECT 'epi_fila', (public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor de dente', NULL,
  '{"nome":"Na Fila Porte Triagem","data_nascimento":"1990-01-01"}') ->> 'episodio_id')::uuid;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.classificacoes_do_episodio(pg_temp.id('epi_fila'))) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: histórico de ficha na triagem';
  END IF;
  RAISE NOTICE 'OK  na triagem o enfermeiro de plantão lê o histórico sem abrir prontuário';
END $$;

RESET ROLE;
INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel)
SELECT u.organizacao_id, e.unidade_id, e.paciente_id, '10000000-0000-4000-8000-0000000000e3', 'enfermeiro'
  FROM public.episodios e JOIN public.unidades u ON u.id = e.unidade_id WHERE e.id = pg_temp.id('epi_homem');

DO $$
DECLARE c public.classificacoes_risco; h record; e public.episodios;
BEGIN
  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = pg_temp.id('epi_homem');
  IF NOT c.discriminador_livre OR c.discriminador_cor IS NOT NULL OR c.discriminador <> 'Lesão extensa em dorso' THEN
    RAISE EXCEPTION 'FALHOU: discriminador livre (%, %)', c.discriminador_livre, c.discriminador_cor;
  END IF;
  IF c.queixa <> 'Lesão avermelhada no dorso há 2 dias' OR (SELECT queixa FROM public.episodios WHERE id = c.episodio_id) <> 'Lesão na pele' THEN
    RAISE EXCEPTION 'FALHOU: queixa revista (%)', c.queixa;
  END IF;
  IF c.dor <> '{"escala":"numerica","total":3}'::jsonb OR c.oxigenio <> '{"modo":"o2_suplementar","litros_min":2}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: dor/oxigênio (%, %)', c.dor, c.oxigenio;
  END IF;
  RAISE NOTICE 'OK  discriminador livre sem cor de referência; queixa revista fica na classificação; dor e O₂ guardados';

  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = pg_temp.id('epi_mulher');
  IF c.gestacao ->> 'dpp' <> to_char(private.data_atual() - 120 + 280, 'YYYY-MM-DD')
     OR (c.gestacao ->> 'ig_semanas')::int <> 17 OR (c.gestacao ->> 'ig_dias')::int <> 1
     OR c.gestacao ->> 'ig_origem' <> 'dum' OR c.gestacao ->> 'observacao' <> 'pré-natal na UBS'
     OR (c.gestacao ->> 'g')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: gestação (%)', c.gestacao;
  END IF;
  RAISE NOTICE 'OK  IG e DPP pela DUM calculadas no servidor (Naegele), ignorando as digitadas';

  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = pg_temp.id('epi_troca');
  SELECT * INTO e FROM public.episodios WHERE id = pg_temp.id('epi_troca');
  IF NOT c.grupo_trocado OR c.publico <> 'pediatrico' OR c.publico_pela_idade <> 'adulto' OR e.publico <> 'adulto' THEN
    RAISE EXCEPTION 'FALHOU: grupo trocado (%, %, %, %)', c.grupo_trocado, c.publico, c.publico_pela_idade, e.publico;
  END IF;
  RAISE NOTICE 'OK  troca de grupo registrada na classificação; o episódio fica com o grupo da idade';

  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = pg_temp.id('epi_crianca');
  IF c.dor ->> 'escala' <> 'flacc' OR (c.dor ->> 'total')::int <> 3 OR (c.dor -> 'itens' ->> 'choro')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: FLACC (%)', c.dor;
  END IF;
  SELECT * INTO c FROM public.classificacoes_risco WHERE episodio_id = pg_temp.id('epi_compat');
  IF c.queixa <> 'Tosse' OR c.dor IS NOT NULL OR c.grupo_trocado OR c.discriminador_livre THEN
    RAISE EXCEPTION 'FALHOU: chamada antiga (%)', row_to_json(c);
  END IF;
  RAISE NOTICE 'OK  FLACC com itens; chamada antiga guarda a queixa da recepção e nada novo';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-0000000000e3', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO h FROM public.classificacoes_do_episodio(pg_temp.id('epi_homem'));
  RESET ROLE;
  IF h.autor_nome <> 'Enfermeira Porte Triagem' OR (h.sinais ->> 'frequencia-cardiaca')::numeric <> 110
     OR (h.sinais ->> 'escala-dor')::numeric <> 3 OR h.discriminador <> 'Lesão extensa em dorso' THEN
    RAISE EXCEPTION 'FALHOU: histórico (%, %)', h.autor_nome, h.sinais;
  END IF;
  RAISE NOTICE 'OK  histórico traz autor e os sinais vitais daquela classificação';
END $$;

ROLLBACK;
