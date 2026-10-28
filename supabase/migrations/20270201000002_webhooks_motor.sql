-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 4 (Webhooks), etapa 4.2: motor de entrega (banco).
--
-- A Edge Function `webhooks` (chamada pelo pg_cron a cada minuto, via pg_net)
-- pega um lote de entregas (webhook_lote), assina no padrão Standard Webhooks,
-- envia e devolve o resultado (webhook_resultado). Só a service_role chama.
--
-- Agenda das novas tentativas (depois da primeira, imediata): 5 s, 5 min,
-- 30 min, 2 h, 5 h e 10 h. A tentativa que cairia depois de 24 h do evento (ou
-- do reenvio manual) não acontece: a entrega fica "falhou".
-- Destino sem nenhuma entrega com sucesso há 3 dias é desligado sozinho, e os
-- gestores das unidades recebem aviso. Eventos com mais de 90 dias saem.
--
-- O cron só chama a função quando há entrega na hora e quando o Vault tem
-- `webhooks_motor_url` e `webhooks_motor_segredo` (configuração por ambiente,
-- infra/webhooks.md). Sem isso, nada sai. A Edge Function confere o segredo
-- que recebe com o do Vault (webhook_motor_autorizado): não há segredo de
-- função para manter igual.
--
-- Rollback:
--   SELECT cron.unschedule('webhooks-motor') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhooks-motor');
--   SELECT cron.unschedule('webhooks-manutencao') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhooks-manutencao');
--   DROP FUNCTION IF EXISTS public.webhook_motor_autorizado(text), private.webhook_acordar_motor(), private.webhook_manutencao(),
--     public.webhook_resultado(uuid, integer, text), public.webhook_lote(integer),
--     private.webhook_proxima(integer, timestamptz, timestamptz), private.webhook_corpo(public.webhook_eventos);
--   (o pg_net fica: outras funções podem usar)
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Corpo da mensagem (o mesmo em todas as tentativas): {id, type, timestamp, data}.
CREATE OR REPLACE FUNCTION private.webhook_corpo(e public.webhook_eventos)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id', e.id, 'type', e.tipo,
    'timestamp', to_char(e.ocorrido_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'data', e.dados)::text
$$;

-- Quando é a próxima tentativa depois de `p_tentativas` feitas; NULL = desistir.
CREATE OR REPLACE FUNCTION private.webhook_proxima(p_tentativas integer, p_base timestamptz, p_agora timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_tentativas BETWEEN 1 AND 6
              AND p_agora + (ARRAY['5 seconds', '5 minutes', '30 minutes', '2 hours', '5 hours', '10 hours']::interval[])[p_tentativas]
                  <= p_base + interval '24 hours'
         THEN p_agora + (ARRAY['5 seconds', '5 minutes', '30 minutes', '2 hours', '5 hours', '10 hours']::interval[])[p_tentativas] END
$$;

-- Lote para o motor. Cada entrega pega fica reservada por 2 minutos (se o
-- motor cair no meio, ela volta sozinha). Entregas de destino desligado ou com
-- a chave revogada ou vencida são canceladas aqui.
CREATE OR REPLACE FUNCTION public.webhook_lote(p_limite integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  UPDATE public.webhook_entregas e SET situacao = 'cancelada',
         ultimo_erro = CASE WHEN d.desligado_em IS NOT NULL THEN 'Destino desligado.' ELSE 'Chave da API revogada ou vencida.' END
    FROM public.webhook_destinos d JOIN public.api_chaves c ON c.id = d.chave_id
   WHERE e.destino_id = d.id AND e.situacao = 'pendente' AND e.proxima_em <= clock_timestamp()
     AND (d.desligado_em IS NOT NULL OR c.revogada_em IS NOT NULL OR c.expira_em <= now());

  WITH alvo AS (
    SELECT e.id FROM public.webhook_entregas e
     WHERE e.situacao = 'pendente' AND e.proxima_em <= clock_timestamp()
     ORDER BY e.proxima_em
     LIMIT least(greatest(coalesce(p_limite, 20), 1), 100)
     FOR UPDATE SKIP LOCKED),
  pegas AS (
    UPDATE public.webhook_entregas e SET tentativas = e.tentativas + 1, ultima_em = clock_timestamp(),
           proxima_em = clock_timestamp() + interval '2 minutes'
      FROM alvo WHERE e.id = alvo.id
    RETURNING e.*)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'tentativa', p.tentativas, 'url', d.url, 'segredo', s.decrypted_secret,
           'corpo', private.webhook_corpo(ev)) ORDER BY p.proxima_em), '[]'::jsonb)
    INTO v
    FROM pegas p
    JOIN public.webhook_destinos d ON d.id = p.destino_id
    JOIN public.webhook_eventos ev ON ev.id = p.evento_id
    JOIN vault.decrypted_secrets s ON s.id = d.segredo_id;
  RETURN v;
END $$;

-- Resultado de uma tentativa. p_status: o HTTP do receptor (0 = sem resposta).
-- Chamada repetida para entrega que já saiu da fila não muda nada.
CREATE OR REPLACE FUNCTION public.webhook_resultado(p_entrega uuid, p_status integer, p_erro text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.webhook_entregas; v_prox timestamptz;
BEGIN
  SELECT * INTO e FROM public.webhook_entregas WHERE id = p_entrega FOR UPDATE;
  IF NOT FOUND OR e.situacao <> 'pendente' THEN
    RETURN jsonb_build_object('situacao', e.situacao);
  END IF;
  IF p_status BETWEEN 200 AND 299 THEN
    UPDATE public.webhook_entregas SET situacao = 'entregue', entregue_em = clock_timestamp(),
           ultimo_status = p_status, ultimo_erro = NULL WHERE id = e.id;
    UPDATE public.webhook_destinos SET falhando_desde = NULL WHERE id = e.destino_id AND falhando_desde IS NOT NULL;
    RETURN jsonb_build_object('situacao', 'entregue');
  END IF;
  v_prox := private.webhook_proxima(e.tentativas, coalesce(e.reenviada_em, e.criada_em), clock_timestamp());
  UPDATE public.webhook_entregas
     SET situacao = CASE WHEN v_prox IS NULL THEN 'falhou' ELSE 'pendente' END,
         proxima_em = coalesce(v_prox, proxima_em),
         ultimo_status = nullif(p_status, 0),
         ultimo_erro = left(coalesce(nullif(btrim(p_erro), ''), 'HTTP ' || p_status), 500)
   WHERE id = e.id;
  UPDATE public.webhook_destinos SET falhando_desde = clock_timestamp() WHERE id = e.destino_id AND falhando_desde IS NULL;
  RETURN jsonb_build_object('situacao', CASE WHEN v_prox IS NULL THEN 'falhou' ELSE 'pendente' END, 'proxima_em', v_prox);
END $$;

REVOKE ALL ON FUNCTION public.webhook_lote(integer), public.webhook_resultado(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_lote(integer), public.webhook_resultado(uuid, integer, text) TO service_role;
REVOKE ALL ON FUNCTION private.webhook_corpo(public.webhook_eventos), private.webhook_proxima(integer, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- Desligamento automático (3 dias sem sucesso) e limpeza (90 dias).
CREATE OR REPLACE FUNCTION private.webhook_manutencao()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.webhook_destinos;
BEGIN
  FOR d IN SELECT * FROM public.webhook_destinos
            WHERE desligado_em IS NULL AND falhando_desde <= now() - interval '3 days' FOR UPDATE LOOP
    UPDATE public.webhook_destinos SET desligado_em = now(), desligado_por = NULL, desligado_automatico = true,
           motivo_desligamento = 'Desligado sozinho: 3 dias seguidos sem nenhuma entrega com sucesso.' WHERE id = d.id;
    UPDATE public.webhook_entregas SET situacao = 'cancelada', ultimo_erro = 'Destino desligado.'
     WHERE destino_id = d.id AND situacao = 'pendente';
    PERFORM private.registrar_auditoria('webhook_destino_desligado', 'webhook_destinos', d.id, d.unidades[1],
      jsonb_build_object('nome', d.nome, 'tipo', 'automatico'));
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT DISTINCT ON (v.perfil_id, v.unidade_id) v.perfil_id, v.unidade_id, current_date, 'webhook_desligado_' || left(d.id::text, 8),
           'O webhook "' || d.nome || '" foi desligado: 3 dias seguidos sem conseguir entregar. Peça à administração para religar depois de conferir o receptor.'
      FROM public.vinculos v
     WHERE v.unidade_id = ANY (d.unidades) AND v.papel = 'gestor'
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END LOOP;

  DELETE FROM public.webhook_eventos ev
   WHERE ev.ocorrido_em < now() - interval '90 days'
     AND NOT EXISTS (SELECT 1 FROM public.webhook_entregas e WHERE e.evento_id = ev.id AND e.situacao = 'pendente');
END $$;

-- Chama a Edge Function quando há entrega na hora. O endereço e o segredo do
-- motor ficam no Vault (por ambiente); sem eles, não chama.
CREATE OR REPLACE FUNCTION private.webhook_acordar_motor()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_url text; v_segredo text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.webhook_entregas WHERE situacao = 'pendente' AND proxima_em <= clock_timestamp()) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'webhooks_motor_url';
  SELECT decrypted_secret INTO v_segredo FROM vault.decrypted_secrets WHERE name = 'webhooks_motor_segredo';
  IF v_url IS NULL OR v_segredo IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-motor-segredo', v_segredo),
    timeout_milliseconds := 2000);
END $$;

REVOKE ALL ON FUNCTION private.webhook_manutencao(), private.webhook_acordar_motor() FROM PUBLIC, anon, authenticated;

-- A Edge Function confere quem a chamou: o segredo do cabeçalho x-motor-segredo
-- precisa ser o do Vault. Sem segredo no Vault, ninguém é autorizado.
CREATE OR REPLACE FUNCTION public.webhook_motor_autorizado(p_segredo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(length(p_segredo) >= 32 AND p_segredo = (
    SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'webhooks_motor_segredo'), false)
$$;
REVOKE ALL ON FUNCTION public.webhook_motor_autorizado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_motor_autorizado(text) TO service_role;

SELECT cron.schedule('webhooks-motor', '* * * * *', 'SELECT private.webhook_acordar_motor();');
SELECT cron.schedule('webhooks-manutencao', '*/15 * * * *', 'SELECT private.webhook_manutencao();');
