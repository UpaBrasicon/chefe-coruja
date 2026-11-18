-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U11, PR 1 (plano em docs/ubs/U11-PLANO.md; U11 = A, N2 = A do
-- RT em 18/11/2026). Achados A10 e E4.
--
-- 1. DUM contra parto recente: a DUM não pode cair no dia ou antes do último
--    parto ou aborto da mesma mulher. Contam o desfecho de gestação anterior e o
--    nascimento de RN ligado a ela (pacientes.mae_id), em qualquer cadastro dela
--    na rede (private.regulacao_mesmo_paciente: CNS, CPF ou unificação). Vale na
--    inclusão no pré-natal, na correção da DUM e na escuta inicial (recusa) e na
--    abertura pela consulta (a DUM impossível é descartada, como as outras).
-- 2. Data de nascimento obrigatória na ficha da UBS (N2 = A): cadastro sem data
--    não abre ficha. Na UPA e no hospital segue opcional (paciente não
--    identificado da emergência).
--
-- Idempotente. Teste: supabase/tests/ubs_u11_dum_nascimento.sql
--
-- Rollback (na ordem): as trocas invertidas (os trechos estão abaixo);
--   DROP FUNCTION private.conferir_dum_parto(uuid, date, uuid), private.parto_depois_da_dum(uuid, date, uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u11a_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. DUM contra parto ─────────────────────────────────────────────────────
-- o parto ou aborto da mulher no dia da DUM ou depois dela (fora a gestação
-- que se está corrigindo); nulo se não houver
CREATE OR REPLACE FUNCTION private.parto_depois_da_dum(p_paciente uuid, p_dum date, p_gestacao uuid DEFAULT NULL)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ela AS (SELECT m.paciente_id FROM private.regulacao_mesmo_paciente(p_paciente) m)
  SELECT max(d) FROM (
    SELECT g.desfecho_em AS d FROM public.pre_natal_gestacoes g
     WHERE g.paciente_id IN (SELECT paciente_id FROM ela) AND g.desfecho_em IS NOT NULL
       AND g.id IS DISTINCT FROM p_gestacao
    UNION ALL
    SELECT rn.data_nascimento FROM public.pacientes rn
     WHERE rn.mae_id IN (SELECT paciente_id FROM ela) AND rn.data_nascimento IS NOT NULL
  ) x
  WHERE p_dum IS NOT NULL AND x.d >= p_dum
$$;
REVOKE ALL ON FUNCTION private.parto_depois_da_dum(uuid, date, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.conferir_dum_parto(p_paciente uuid, p_dum date, p_gestacao uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_parto date := private.parto_depois_da_dum(p_paciente, p_dum, p_gestacao);
BEGIN
  IF v_parto IS NOT NULL THEN
    RAISE EXCEPTION 'A DUM (%) cai antes do parto ou aborto de % registrado para esta mulher: confira a data.',
      to_char(p_dum, 'DD/MM/YYYY'), to_char(v_parto, 'DD/MM/YYYY');
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.conferir_dum_parto(uuid, date, uuid) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u11a_trocar('public.pre_natal_incluir(uuid,date,uuid)'::regprocedure,
  $a$  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = pa.id) THEN$a$,
  $b$  PERFORM private.conferir_dum_parto(pa.id, p_dum, NULL);  -- U11
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = pa.id) THEN$b$);

SELECT pg_temp.u11a_trocar('public.pre_natal_definir_dum(uuid,date)'::regprocedure,
  $a$  IF g.desfecho_em IS NOT NULL AND p_dum > g.desfecho_em THEN$a$,
  $b$  PERFORM private.conferir_dum_parto(g.paciente_id, p_dum, g.id);  -- U11
  IF g.desfecho_em IS NOT NULL AND p_dum > g.desfecho_em THEN$b$);

SELECT pg_temp.u11a_trocar('public.registrar_escuta_aps(uuid,text,text,text,jsonb,text,text,date)'::regprocedure,
  $a$    IF v_hoje - p_dum > 336 THEN RAISE EXCEPTION 'DUM com mais de 48 semanas: confira a data.'; END IF;$a$,
  $b$    IF v_hoje - p_dum > 336 THEN RAISE EXCEPTION 'DUM com mais de 48 semanas: confira a data.'; END IF;
    PERFORM private.conferir_dum_parto(e.paciente_id, p_dum, NULL);  -- U11$b$);

SELECT pg_temp.u11a_trocar('private.pre_natal_na_consulta()'::regprocedure,
  $a$        IF v_dum IS NOT NULL AND (v_dum > v_dia OR v_dia - v_dum > 336) THEN v_dum := NULL; END IF;$a$,
  $b$        IF v_dum IS NOT NULL AND (v_dum > v_dia OR v_dia - v_dum > 336) THEN v_dum := NULL; END IF;
        IF private.parto_depois_da_dum(NEW.paciente_id, v_dum, NULL) IS NOT NULL THEN v_dum := NULL; END IF;  -- U11$b$);

-- ── 2. data de nascimento obrigatória na UBS ────────────────────────────────
SELECT pg_temp.u11a_trocar('public.registrar_ficha(uuid,text,uuid,jsonb,text[],boolean)'::regprocedure,
  $a$  v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;$a$,
  $b$  v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;
  -- U11 (N2 = A): na UBS a ficha exige a data de nascimento
  IF v_ubs AND v_nasc IS NULL AND (v_novo OR v_atual.data_nascimento IS NULL) THEN
    RAISE EXCEPTION 'Na UBS, informe a data de nascimento do paciente.';
  END IF;$b$);
