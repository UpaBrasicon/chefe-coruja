-- Testes da migration 20270321000002_bi_noite_dia_do_plantao.sql (decisão do RT
-- em 10/11/2026, bloco rápido, item 5): no BI, a chegada de 0h a 6h59 conta no
-- plantão que começou às 19h do dia anterior. Não depende do seed (pega uma
-- unidade e um setor que existam). ROLLBACK no fim.
BEGIN;

-- 1. o dia do plantão
DO $$ BEGIN
  IF private.dia_do_plantao('2020-01-05 02:00-03') <> date '2020-01-04'
     OR private.dia_do_plantao('2020-01-05 06:59-03') <> date '2020-01-04'
     OR private.dia_do_plantao('2020-01-05 07:00-03') <> date '2020-01-05'
     OR private.dia_do_plantao('2020-01-05 23:30-03') <> date '2020-01-05'
     OR private.dia_do_plantao('2020-01-01 03:00-03') <> date '2019-12-31' THEN
    RAISE EXCEPTION 'FALHOU: dia do plantão';
  END IF;
  RAISE NOTICE 'OK  dia do plantão: das 7h de D às 7h de D+1, horário de Brasília';
END $$;

-- 2. três chegadas de teste: 20h do dia 4, 2h do dia 5 (noite do dia 4) e 8h do dia 5
CREATE TEMP TABLE t (nome text PRIMARY KEY, id uuid);
DO $$
DECLARE u uuid; s uuid; autor uuid;
BEGIN
  SELECT st.unidade_id, st.id INTO u, s FROM public.setores st ORDER BY st.created_at LIMIT 1;
  SELECT id INTO autor FROM public.perfis ORDER BY created_at LIMIT 1;
  INSERT INTO t VALUES ('unidade', u);
  INSERT INTO t SELECT x.nome, gen_random_uuid() FROM (VALUES ('noite4_20h'), ('noite4_02h'), ('manha5_08h')) x(nome);
  -- um paciente por chegada (só um atendimento aberto por paciente)
  INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo)
  SELECT t.id, u, 'Paciente BI Noite Teste ' || t.nome, '1970-01-01', 'T-BI-' || t.nome, s, 'M' FROM t WHERE t.nome <> 'unidade';
  INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
  SELECT t.id, u, t.id, s, 'atendimento', 'Teste BI', autor, c.em
    FROM t JOIN (VALUES ('noite4_20h', timestamptz '2020-01-04 20:00-03'), ('noite4_02h', timestamptz '2020-01-05 02:00-03'),
                        ('manha5_08h', timestamptz '2020-01-05 08:00-03')) c(nome, em) ON c.nome = t.nome;
END $$;

DO $$
DECLARE u uuid := (SELECT id FROM t WHERE nome = 'unidade');
        teste uuid[] := ARRAY(SELECT id FROM t WHERE nome <> 'unidade');
        d4 uuid[]; d5 uuid[]; noite4 uuid[];
BEGIN
  d4 := ARRAY(SELECT x FROM private.episodios_filtrados(u, '2020-01-04', '2020-01-04') x WHERE x = ANY (teste));
  d5 := ARRAY(SELECT x FROM private.episodios_filtrados(u, '2020-01-05', '2020-01-05') x WHERE x = ANY (teste));
  noite4 := ARRAY(SELECT x FROM private.episodios_filtrados(u, '2020-01-04', '2020-01-04', NULL, NULL, 'noite') x WHERE x = ANY (teste));
  IF cardinality(d4) <> 2 OR NOT ((SELECT id FROM t WHERE nome = 'noite4_02h') = ANY (d4)) THEN
    RAISE EXCEPTION 'FALHOU: o dia 4 devia ter as chegadas das 20h e das 2h (noite do dia 4); tem %', cardinality(d4);
  END IF;
  IF cardinality(d5) <> 1 OR NOT ((SELECT id FROM t WHERE nome = 'manha5_08h') = ANY (d5)) THEN
    RAISE EXCEPTION 'FALHOU: o dia 5 devia ter só a chegada das 8h; tem %', cardinality(d5);
  END IF;
  IF cardinality(noite4) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: a noite do dia 4 devia ter 2 chegadas; tem %', cardinality(noite4);
  END IF;
  RAISE NOTICE 'OK  período e turno da noite pela data em que o plantão começou';
END $$;

-- 3. o dia das séries nos quatro indicadores
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.indicador_espera_triagem(uuid, date, date, uuid, text, text, text, uuid)',
                           'public.indicador_espera_medico(uuid, date, date, uuid, text, text, text, uuid)',
                           'public.indicador_evasao(uuid, date, date, uuid, text, text, text, uuid)',
                           'public.pacientes_por_cor(uuid, date, date, uuid, text, text, text, uuid)'] LOOP
    IF position('private.dia_do_plantao(' IN pg_get_functiondef(f::regprocedure)) = 0 THEN
      RAISE EXCEPTION 'FALHOU: % não usa o dia do plantão', f;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  os quatro indicadores usam o dia do plantão';
END $$;

-- 4. privilégios
DO $$ BEGIN
  IF has_function_privilege('anon', 'private.dia_do_plantao(timestamptz)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: privilégios'; END IF;
  RAISE NOTICE 'OK  privilégios';
END $$;
ROLLBACK;
