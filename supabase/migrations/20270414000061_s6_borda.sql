-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S6: borda e API de integração
-- (docs/seguranca/S6-BORDA-DIAGNOSTICO.md). Decisões do RT em 15/11/2026: todas A.
--
-- B1. IP de origem: o gateway do Supabase mantém o X-Forwarded-For que o
--     cliente manda e acrescenta o IP real no fim (conferido na homologação em
--     15/11/2026). O IP passa a vir do cf-connecting-ip (a borda não deixa o
--     cliente mandá-lo) e, na falta dele, do ÚLTIMO item do X-Forwarded-For.
-- B2. Segredo do motor de webhooks comparado pelos resumos sha256.
-- B4. Trava curta por chave antes de contar os acessos do último minuto nas
--     quatro portas da API. contar_pedido_demonstracao já conta numa só
--     instrução (INSERT ... ON CONFLICT ... RETURNING) e não muda.
--
-- Idempotente. Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── B1. IP de origem ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.requisicao_ip()
RETURNS inet
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  h jsonb;
  v text;
BEGIN
  h := nullif(current_setting('request.headers', true), '')::jsonb;
  -- S6 (B1): o cf-connecting-ip vem da borda; o cliente não consegue trocá-lo
  v := btrim(coalesce(h ->> 'cf-connecting-ip', ''));
  IF v = '' THEN
    -- o gateway acrescenta o IP real no fim; o começo da lista é do cliente
    v := btrim(coalesce((regexp_split_to_array(coalesce(h ->> 'x-forwarded-for', ''), '\s*,\s*'))[
           array_length(regexp_split_to_array(coalesce(h ->> 'x-forwarded-for', ''), '\s*,\s*'), 1)], ''));
  END IF;
  RETURN nullif(v, '')::inet;
EXCEPTION WHEN others THEN
  RETURN NULL;  -- cabeçalho malformado não impede o registro
END $$;

-- ── B2. Segredo do motor de webhooks ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.webhook_motor_autorizado(p_segredo text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  -- S6 (B2): compara os resumos, não o texto, para o tempo não depender do segredo
  SELECT coalesce(length(p_segredo) >= 32 AND
    extensions.digest(convert_to(p_segredo, 'UTF8'), 'sha256') = (
      SELECT extensions.digest(convert_to(s.decrypted_secret, 'UTF8'), 'sha256')
        FROM vault.decrypted_secrets s WHERE s.name = 'webhooks_motor_segredo'), false)
$$;

-- ── B4. Trava por chave antes da contagem, nas quatro portas da API ─────────
-- As funções são grandes e já mudaram em várias migrations; em vez de copiar
-- cada uma, a trava entra na linha da contagem da definição que está no banco.
-- Só troca quando a linha existe e a trava ainda não está lá.
DO $$
DECLARE
  f regprocedure;
  def text;
  contagem constant text :=
    'SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval ''60 seconds'';';
  trava constant text :=
    'PERFORM pg_advisory_xact_lock(hashtextextended(''api_limite:'' || c.id::text, 0));  -- S6 (B4)' || chr(10) || '  ';
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.api_v1(text,text,text,text,jsonb)'::regprocedure,
    'public.api_v1_fhir(text,text,text,text,jsonb)'::regprocedure,
    'public.api_v1_financeiro(text,text,text,text,jsonb)'::regprocedure,
    'public.api_v1_leitura(text,text,text,text,jsonb)'::regprocedure]
  LOOP
    def := pg_get_functiondef(f);
    IF position('pg_advisory_xact_lock' IN def) > 0 THEN
      CONTINUE;
    END IF;
    IF position(contagem IN def) = 0 THEN
      RAISE EXCEPTION 'S6: a contagem de % mudou; conferir a trava à mão.', f;
    END IF;
    EXECUTE replace(def, contagem, trava || contagem);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, se precisar):
--   private.requisicao_ip: recriar com a versão de
--     20260926000012_fase1_consulta_impressao_servidor.sql (primeiro item do x-forwarded-for).
--   public.webhook_motor_autorizado: recriar com a versão de
--     20270201000002_webhooks_motor.sql (comparação direta).
--   Trava: o mesmo DO acima com replace(def, trava || contagem, contagem).
-- ════════════════════════════════════════════════════════════════════════════
