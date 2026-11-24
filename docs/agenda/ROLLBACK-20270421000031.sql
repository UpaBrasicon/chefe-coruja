-- ════════════════════════════════════════════════════════════════════════════
-- Volta da migration 20270421000031_agenda_email.sql (e-mail aos convidados da
-- agenda do administrador).
--
-- Rodar primeiro na homologação. Antes, tirar a Edge Function avisar-reuniao
--   npx supabase functions delete avisar-reuniao --project-ref <ref>
-- ou voltar a tela. Sem as funções do banco, a chamada da tela só mostra
-- "e-mail não enviado"; a reunião e o aviso no app continuam.
-- private.reuniao_avisar volta ao texto da 20270421000030 (só o aviso no app).
-- A fila (private.reuniao_emails) é apagada: só tem ids, evento e situação.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP FUNCTION IF EXISTS public.reuniao_emails_reservar(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reuniao_emails_concluir(bigint[], text);

-- ── aviso no app, como na 20270421000030 ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.reuniao_avisar(p_reuniao uuid, p_perfis uuid[], p_acao text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reunioes%ROWTYPE;
  v_quem text;
  v_quando text;
  v_onde text;
  v_msg text;
  v_tipo text;
  x record;
BEGIN
  IF p_perfis IS NULL OR cardinality(p_perfis) = 0 THEN RETURN; END IF;
  SELECT * INTO r FROM public.reunioes WHERE id = p_reuniao;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT coalesce(nullif(btrim(p.nome_completo), ''), 'a administração') INTO v_quem
    FROM public.perfis p WHERE p.id = r.criado_por;
  v_quando := to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ', das '
           || to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' às '
           || to_char(r.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' (horário de Brasília)';
  v_onde := CASE WHEN r.link IS NULL THEN '' ELSE '. ' || private.plataforma_reuniao(r.link) || ': ' || r.link END;
  v_msg := CASE p_acao
    WHEN 'convite'   THEN 'Convite para reunião: ' || r.titulo || ', ' || v_quando || v_onde || '. Marcada por ' || coalesce(v_quem, 'a administração') || '.'
    WHEN 'alterada'  THEN 'Reunião alterada: ' || r.titulo || ', agora ' || v_quando || v_onde || '.'
    WHEN 'cancelada' THEN 'Reunião cancelada: ' || r.titulo || ', que seria em ' || v_quando || '.'
    WHEN 'retirado'  THEN 'Você não está mais na lista da reunião ' || r.titulo || ', de ' || v_quando || '.'
  END;
  IF v_msg IS NULL THEN RETURN; END IF;
  v_tipo := 'reuniao_' || p_acao || '_' || r.id::text || '_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;
  FOR x IN
    SELECT DISTINCT v.perfil_id, v.unidade_id
      FROM public.vinculos v
      JOIN public.unidades u ON u.id = v.unidade_id
     WHERE v.perfil_id = ANY (p_perfis) AND v.ativo AND u.ativo AND u.organizacao_id = r.organizacao_id
  LOOP
    PERFORM private.avisar(x.perfil_id, x.unidade_id, NULL, v_tipo, v_msg);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.reuniao_avisar(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS private.reuniao_emails;

COMMIT;
