-- ════════════════════════════════════════════════════════════════════════════
-- BI: o turno da noite conta pela data em que o plantão começou (decisão do RT
-- em 10/11/2026, bloco rápido, item 5; a pergunta de desenho estava no BACKLOG,
-- "Virada de data").
--
-- Antes: o recorte do período e o "dia" dos indicadores usavam a data da
-- chegada. O plantão das 19h às 7h aparecia partido: quem chegava às 2h do dia
-- 5 contava no dia 5, embora fosse do plantão que começou às 19h do dia 4.
--
-- Agora o dia do BI é o dia do plantão: das 7h de D às 7h de D+1 (horário de
-- Brasília). As chegadas de 0h a 6h59 contam no dia anterior. Manhã (7h–13h) e
-- tarde (13h–19h) não mudam; o turno de cada chegada também não.
--   - private.dia_do_plantao(timestamptz): a data do plantão de um instante;
--   - private.episodios_filtrados: o período vai das 7h de p_de às 7h do dia
--     seguinte a p_ate;
--   - indicador_espera_triagem, indicador_espera_medico, indicador_evasao e
--     pacientes_por_cor: o "dia" das séries passa a ser o dia do plantão.
-- Assinaturas, permissões e formato de resposta não mudam.
--
-- As funções são trocadas pelo texto atual delas (pg_get_functiondef), trecho a
-- trecho; se um trecho não existir mais, a migration para com erro e nada muda.
-- Conferido em 10/11/2026: as cinco funções têm o mesmo md5 na homologação e na
-- produção.
--
-- Rollback (testado na homologação): reaplicar as cinco funções de
-- 20261030000001_filtros_bi.sql (o texto de hoje é o daquela migration) e
--   DROP FUNCTION IF EXISTS private.dia_do_plantao(timestamptz);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.dia_do_plantao(p timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ((p AT TIME ZONE 'America/Sao_Paulo') - interval '7 hours')::date
$$;
REVOKE ALL ON FUNCTION private.dia_do_plantao(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.dia_do_plantao(timestamptz) TO authenticated;

CREATE FUNCTION pg_temp.trocar(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := replace(pg_get_functiondef(f), E'\r', ''); i int;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    IF position(trechos[i] IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, trechos[i];
    END IF;
    def := replace(def, trechos[i], trechos[i + 1]);
  END LOOP;
  EXECUTE def;
END $$;

-- o período: das 7h de p_de às 7h do dia seguinte a p_ate
SELECT pg_temp.trocar('private.episodios_filtrados(uuid, date, date, uuid, text, text, text, uuid)'::regprocedure, ARRAY[
  $a$AND e.chegada_em >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')$a$,
  $b$AND e.chegada_em >= ((p_de + time '07:00') AT TIME ZONE 'America/Sao_Paulo')$b$,
  $a$AND e.chegada_em <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')$a$,
  $b$AND e.chegada_em <  (((p_ate + 1) + time '07:00') AT TIME ZONE 'America/Sao_Paulo')$b$]);

-- o dia das séries: o dia do plantão
SELECT pg_temp.trocar('public.indicador_espera_triagem(uuid, date, date, uuid, text, text, text, uuid)'::regprocedure, ARRAY[
  $a$(e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia$a$, $b$private.dia_do_plantao(e.chegada_em) AS dia$b$]);
SELECT pg_temp.trocar('public.indicador_espera_medico(uuid, date, date, uuid, text, text, text, uuid)'::regprocedure, ARRAY[
  $a$(e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia$a$, $b$private.dia_do_plantao(e.chegada_em) AS dia$b$]);
SELECT pg_temp.trocar('public.indicador_evasao(uuid, date, date, uuid, text, text, text, uuid)'::regprocedure, ARRAY[
  $a$ep.local::date AS dia,$a$, $b$private.dia_do_plantao(ep.chegada_em) AS dia,$b$]);
SELECT pg_temp.trocar('public.pacientes_por_cor(uuid, date, date, uuid, text, text, text, uuid)'::regprocedure, ARRAY[
  $a$SELECT ep.*, ep.local::date AS dia,$a$, $b$SELECT ep.*, private.dia_do_plantao(ep.local AT TIME ZONE 'America/Sao_Paulo') AS dia,$b$]);
