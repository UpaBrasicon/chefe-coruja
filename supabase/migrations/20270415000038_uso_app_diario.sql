-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1, item 14 (P2): uso do app medido no próprio banco, sem PostHog.
-- Decisões do RT em 23/11/2026 (PH1 a PH3 = A, docs/frontend/POSTHOG-DIAGNOSTICO.md).
--
-- • public.uso_app_diario: uma linha por dia, unidade, papel, evento e detalhe,
--   com a contagem. Não guarda pessoa nem paciente: é só o total do dia.
-- • Eventos (PH3 = A): troca de aba na Central Clínica ('central_aba', detalhe
--   = a aba), abertura de calculadora ou escore ('ferramenta', detalhe = chave
--   do registro) e abertura do censo ('censo'). A entrada no app não é gravada
--   aqui: é lida dos registros de acesso do LG9 (auth.sessions), que o app não
--   consegue pular.
-- • public.registrar_uso_app: +1 no dia. O papel vem da tela, mas o servidor
--   confere que a pessoa tem esse vínculo ativo na unidade; sem vínculo, nada
--   é gravado (o super admin sem vínculo também não conta). Nunca devolve erro
--   para a tela: um evento perdido não pode atrapalhar o trabalho.
-- • public.uso_app_painel: só o super admin lê, pelo painel "Uso do app".
--   Devolve os eventos do período, as entradas por dia (sessões abertas e
--   pessoas distintas, sem dizer quem) e o total de cada ferramenta desde o
--   início (a soma de ferramenta_uso, sem a pessoa).
--
-- Expand: cria uma tabela e duas funções. Idempotente.
-- Volta: supabase/snippets/uso_app_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.uso_app_diario (
  dia        date NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  papel      public.papel NOT NULL,
  evento     text NOT NULL CHECK (evento IN ('central_aba', 'ferramenta', 'censo')),
  detalhe    text NOT NULL DEFAULT '' CHECK (detalhe ~ '^([a-z0-9-]{1,80}(/[a-z0-9-]{1,120})?)?$'),
  total      integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (dia, unidade_id, papel, evento, detalhe)
);

COMMENT ON TABLE public.uso_app_diario IS
  'Uso do app por dia, unidade, papel e evento, sem pessoa e sem paciente (Fase 1, item 14). Escrita por registrar_uso_app; leitura só do super admin por uso_app_painel.';

CREATE INDEX IF NOT EXISTS uso_app_diario_unidade_dia ON public.uso_app_diario (unidade_id, dia);

ALTER TABLE public.uso_app_diario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uso_app_diario FROM PUBLIC, anon, authenticated;

-- ── a tela conta um evento ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_uso_app(p_unidade uuid, p_papel text, p_evento text, p_detalhe text DEFAULT '')
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_detalhe text := coalesce(p_detalhe, '');
BEGIN
  IF v_eu IS NULL OR p_unidade IS NULL OR p_papel IS NULL THEN RETURN; END IF;
  IF p_evento IS NULL OR p_evento NOT IN ('central_aba', 'ferramenta', 'censo') THEN RETURN; END IF;
  IF v_detalhe !~ '^([a-z0-9-]{1,80}(/[a-z0-9-]{1,120})?)?$' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo AND v.papel::text = p_papel) THEN
    RETURN;
  END IF;
  INSERT INTO public.uso_app_diario AS u (dia, unidade_id, papel, evento, detalhe, total)
  VALUES (private.data_atual(), p_unidade, p_papel::public.papel, p_evento, v_detalhe, 1)
  ON CONFLICT (dia, unidade_id, papel, evento, detalhe) DO UPDATE SET total = u.total + 1;
END $$;

-- ── painel "Uso do app" do super admin ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.uso_app_painel(p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dias integer := least(greatest(coalesce(p_dias, 30), 1), 180);
  v_desde date := private.data_atual() - (v_dias - 1);
BEGIN
  IF private.eh_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o uso do app é do administrador geral.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'desde', v_desde,
    'eventos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', u.dia, 'unidade_id', u.unidade_id, 'unidade', un.nome,
               'papel', u.papel, 'evento', u.evento, 'detalhe', u.detalhe, 'total', u.total)
             ORDER BY u.dia DESC, un.nome, u.papel, u.evento, u.detalhe)
        FROM public.uso_app_diario u
        JOIN public.unidades un ON un.id = u.unidade_id
       WHERE u.dia >= v_desde), '[]'::jsonb),
    'entradas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', e.dia, 'entradas', e.entradas, 'pessoas', e.pessoas) ORDER BY e.dia DESC)
        FROM (SELECT (r.em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
                     count(*) AS entradas, count(DISTINCT r.usuario_id) AS pessoas
                FROM private.registros_acesso_aplicacao r
               WHERE r.acao = 'entrada'
                 AND (r.em AT TIME ZONE 'America/Sao_Paulo')::date >= v_desde
               GROUP BY 1) e), '[]'::jsonb),
    'ferramentas_desde_inicio', coalesce((
      SELECT jsonb_agg(jsonb_build_object('chave', f.chave, 'usos', f.usos) ORDER BY f.usos DESC, f.chave)
        FROM (SELECT fu.chave, sum(fu.usos)::bigint AS usos
                FROM public.ferramenta_uso fu
               WHERE fu.usos > 0
               GROUP BY fu.chave) f), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.registrar_uso_app(uuid, text, text, text), public.uso_app_painel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_uso_app(uuid, text, text, text), public.uso_app_painel(integer) TO authenticated;
