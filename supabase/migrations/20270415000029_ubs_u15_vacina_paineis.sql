-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 5 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC1 a VC7 = A): a vacina conta nos indicadores C2, C3, C6 e C7.
--
-- Fonte: notas metodológicas C2, C3, C6 e C7 da SAPS/MS (junho de 2026), as
-- mesmas do U13. A vacina conta pelo registro (aplicada na UBS ou transcrita da
-- caderneta; a nota aceita "registro da vacina ou transcrição"), sem o
-- registro cancelado.
--
-- C2 (E, 20 pontos), criança até 2 anos, esquema primário com todas as doses:
--   - pentavalente: 3 doses de cada componente (difteria, tétano e coqueluche;
--     hepatite B; Hib), com pelo menos 30 dias entre as doses, pelos códigos da
--     nota (09, 17, 29, 39, 42, 43, 46, 47, 58);
--   - VIP: 3 doses, 30 dias entre elas (22, 29, 43, 58);
--   - tríplice viral: 2 doses, sem contar a dose antes dos 12 meses (24, 56);
--   - pneumocócica: 2 doses, 30 dias entre elas (26, 59, 106, 107).
--   private.puericultura_registros ganha "vacinas_faltam" (o que falta).
-- C3 (F, 9 pontos): dTpa (57) a partir da 20ª semana de cada gestação (DUM + 140
--   dias até o fim da gestação). private.pre_natal_registros ganha "dtpa".
-- C6 (D, 25 pontos): 1 dose da vacina da influenza (33 ou 77) nos últimos 12
--   meses. indicadores_aps ganha "influenza" e a média passa a somar o D.
-- C7 (B, 30 pontos): 1 dose da vacina HPV (67 ou 93) aplicada dos 9 aos 14 anos,
--   no sexo feminino de 9 a 14 anos. indicadores_aps ganha "hpv".
--
-- Idempotente. Teste: supabase/tests/ubs_u15_vacina_paineis.sql
--
-- Rollback (na ordem): as trocas invertidas (os trechos estão abaixo);
--   DROP FUNCTION IF EXISTS private.vacina_c2_faltam(uuid, date),
--     private.vacina_doses_espacadas(uuid, integer[], date, date, integer);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15e_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
  de text; para text;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    de := replace(p_pares[k], chr(13), '');
    para := replace(p_pares[k + 1], chr(13), '');
    CONTINUE WHEN position(para IN novo) > 0;
    IF position(de IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, de;
    END IF;
    novo := replace(novo, de, para);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── doses contadas com o intervalo mínimo ───────────────────────────────────
-- Conta as doses (uma por dia) dos códigos dados entre p_desde e p_ate, só
-- quando a dose vem p_intervalo dias ou mais depois da última contada.
CREATE OR REPLACE FUNCTION private.vacina_doses_espacadas(p_paciente uuid, p_codigos integer[], p_desde date, p_ate date,
  p_intervalo integer)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d date;
  v_ultima date;
  v_n integer := 0;
BEGIN
  FOR d IN SELECT DISTINCT v.data_aplicacao FROM public.vacinacoes v
            WHERE v.paciente_id = p_paciente AND v.imunobiologico = ANY (p_codigos) AND v.cancelado_em IS NULL
              AND v.data_aplicacao >= p_desde AND v.data_aplicacao <= p_ate
            ORDER BY 1 LOOP
    IF v_ultima IS NULL OR d - v_ultima >= p_intervalo THEN
      v_n := v_n + 1;
      v_ultima := d;
    END IF;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION private.vacina_doses_espacadas(uuid, integer[], date, date, integer) FROM PUBLIC, anon, authenticated;

-- ── C2: o que falta no esquema primário ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.vacina_c2_faltam(p_paciente uuid, p_nasc date)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ate date := least(private.data_atual(), (p_nasc + interval '2 years')::date - 1);
  f text[] := '{}';
BEGIN
  IF p_nasc IS NULL THEN RETURN NULL; END IF;
  IF private.vacina_doses_espacadas(p_paciente, ARRAY[29, 39, 42, 43, 46, 47, 58], p_nasc, v_ate, 30) < 3
     OR private.vacina_doses_espacadas(p_paciente, ARRAY[9, 42, 43], p_nasc, v_ate, 30) < 3
     OR private.vacina_doses_espacadas(p_paciente, ARRAY[17, 29, 39, 42, 43], p_nasc, v_ate, 30) < 3 THEN
    f := f || 'pentavalente'::text;
  END IF;
  IF private.vacina_doses_espacadas(p_paciente, ARRAY[22, 29, 43, 58], p_nasc, v_ate, 30) < 3 THEN f := f || 'VIP'::text; END IF;
  IF private.vacina_doses_espacadas(p_paciente, ARRAY[24, 56], (p_nasc + interval '12 months')::date, v_ate, 1) < 2 THEN
    f := f || 'tríplice viral'::text;
  END IF;
  IF private.vacina_doses_espacadas(p_paciente, ARRAY[26, 59, 106, 107], p_nasc, v_ate, 30) < 2 THEN f := f || 'pneumocócica'::text; END IF;
  RETURN f;
END $$;
REVOKE ALL ON FUNCTION private.vacina_c2_faltam(uuid, date) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u15e_trocar('private.puericultura_registros(uuid,date)'::regprocedure,
  $a$    'peso_altura', jsonb_array_length(v_pa_datas), 'datas_peso_altura', v_pa_datas,$a$,
  $b$    'peso_altura', jsonb_array_length(v_pa_datas), 'datas_peso_altura', v_pa_datas,
    'vacinas_faltam', to_jsonb(private.vacina_c2_faltam(p_paciente, p_nasc)),  -- U15, C2 (E)$b$);

-- ── C3: dTpa a partir da 20ª semana ─────────────────────────────────────────
SELECT pg_temp.u15e_trocar('private.pre_natal_registros(uuid)'::regprocedure,
  $a$    'testes_1tri', v_t1, 'testes_3tri', v_t3, 'consulta_puerperio', v_puerperio);$a$,
  $b$    'testes_1tri', v_t1, 'testes_3tri', v_t3, 'consulta_puerperio', v_puerperio,
    'dtpa', (SELECT min(v.data_aplicacao) FROM public.vacinacoes v  -- U15, C3 (F)
              WHERE v.paciente_id = g.paciente_id AND v.imunobiologico = 57 AND v.cancelado_em IS NULL
                AND v.data_aplicacao BETWEEN g.dum + 140 AND v_fim));$b$);

-- ── C6 (D) e C7 (B) ─────────────────────────────────────────────────────────
SELECT pg_temp.u15e_trocar('public.indicadores_aps(uuid)'::regprocedure,
  $a$                THEN 25 ELSE 0 END AS b$a$,
  $b$                THEN 25 ELSE 0 END AS b,
           CASE WHEN EXISTS (SELECT 1 FROM public.vacinacoes v  -- U15, C6 (D): influenza em 12 meses
                              WHERE v.paciente_id = i.id AND v.imunobiologico IN (33, 77) AND v.cancelado_em IS NULL
                                AND v.data_aplicacao > (v_hoje - interval '12 months')::date) THEN 25 ELSE 0 END AS d$b$,
  $a$'peso_altura', count(*) FILTER (WHERE b > 0),$a$,
  $b$'peso_altura', count(*) FILTER (WHERE b > 0), 'influenza', count(*) FILTER (WHERE d > 0),$b$,
  $a$'media', CASE WHEN count(*) > 0 THEN round(avg(a + b), 1) END)$a$,
  $b$'media', CASE WHEN count(*) > 0 THEN round(avg(a + b + d), 1) END)$b$,
  $a$    SELECT pa.id, date_part('year', age(v_hoje, pa.data_nascimento))::int AS idade$a$,
  $b$    SELECT pa.id, pa.data_nascimento AS nasc, date_part('year', age(v_hoje, pa.data_nascimento))::int AS idade$b$,
  $a$                 AND x.procedimento IN ('0204030030', '0204030188') AND x.pedido_em > now() - interval '24 months')) AS mama$a$,
  $b$                 AND x.procedimento IN ('0204030030', '0204030188') AND x.pedido_em > now() - interval '24 months')) AS mama,
           (w.idade BETWEEN 9 AND 14 AND EXISTS (  -- U15, C7 (B): HPV aplicada dos 9 aos 14 anos
              SELECT 1 FROM public.vacinacoes v WHERE v.paciente_id = w.id AND v.imunobiologico IN (67, 93) AND v.cancelado_em IS NULL
                 AND v.data_aplicacao >= (w.nasc + interval '9 years')::date AND v.data_aplicacao < (w.nasc + interval '15 years')::date)) AS hpv$b$,
  $a$           'mama', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 50 AND 69), 'feito', count(*) FILTER (WHERE mama)))$a$,
  $b$           'mama', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 50 AND 69), 'feito', count(*) FILTER (WHERE mama)),
           'hpv', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 9 AND 14), 'feito', count(*) FILTER (WHERE hpv)))$b$);
