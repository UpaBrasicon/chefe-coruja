-- ════════════════════════════════════════════════════════════════════════════
-- O NIR também atualiza a evolução do pedido de regulação (decisão do RT de
-- 25/11/2026, "para facilitar processos").
--
-- • É a atualização do pedido (regulacao_evolucoes, a "Evolução (versão N)"
--   que a central lê e que reinicia o prazo de evolução), não a evolução
--   médica do prontuário. O autor é o login; a linha grava o papel de quem
--   atualizou (regulacao_evolucoes.autor_papel: medico, gestor ou nir) e a
--   tela mostra "atualizada pelo NIR, <nome>".
-- • Extensão mínima de permissão: public.regulacao_atualizar_evolucao aceita,
--   além de quem já podia (private.regulacao_origem_pode: solicitante que não
--   é o NIR, médico assistente, gestor da origem), o NIR da unidade de origem
--   (private.sou_nir). private.regulacao_origem_pode NÃO muda (ela também
--   decide cancelar e corrigir o devolvido, que seguem fora do NIR).
-- • Ao salvar, as pendências da unidade com motivo "evolução" ainda abertas
--   naquele pedido (20270425000030) ficam resolvidas, com o autor e a hora.
-- • public.regulacao_detalhe: 'pode_evoluir' inclui o NIR da origem e cada
--   evolução traz 'papel'. Corpo igual ao da 20261115000001 fora isso.
--
-- Só adiciona (expand: coluna nova opcional). Idempotente. Rollback no fim.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_evolucoes ADD COLUMN IF NOT EXISTS autor_papel text;
ALTER TABLE public.regulacao_evolucoes DROP CONSTRAINT IF EXISTS regulacao_evolucoes_autor_papel_check;
ALTER TABLE public.regulacao_evolucoes ADD CONSTRAINT regulacao_evolucoes_autor_papel_check
  CHECK (autor_papel IS NULL OR autor_papel IN ('medico', 'gestor', 'nir'));

-- Papel de quem atualiza a evolução do pedido (NULL = não pode).
CREATE OR REPLACE FUNCTION private.regulacao_papel_evolucao(s public.regulacao_solicitacoes)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN (s.solicitante_id = private.meu_perfil_id() AND s.solicitante_papel <> 'nir')
      OR (s.medico_assistente_id IS NOT NULL AND s.medico_assistente_id = private.meu_perfil_id()) THEN
      CASE WHEN private.tenho_papel(s.unidade_origem_id, 'plantonista') OR NOT private.tenho_papel(s.unidade_origem_id, 'gestor')
           THEN 'medico' ELSE 'gestor' END
    WHEN private.tenho_papel(s.unidade_origem_id, 'gestor') THEN 'gestor'
    WHEN private.sou_nir(s.unidade_origem_id) THEN 'nir'
  END
$$;
REVOKE ALL ON FUNCTION private.regulacao_papel_evolucao(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_atualizar_evolucao(p_id uuid, p_texto text, p_sinais_vitais text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_id uuid; v_papel text; v_resolvidas integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  v_papel := CASE WHEN private.regulacao_origem_pode(s) OR private.sou_nir(s.unidade_origem_id)
                  THEN private.regulacao_papel_evolucao(s) END;
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Atualizam a evolução o solicitante, o médico assistente, o gestor e o NIR da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') THEN
    RAISE EXCEPTION 'Só se atualiza a evolução com o pedido esperando decisão.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a evolução (mínimo de 10 letras).'; END IF;
  INSERT INTO public.regulacao_evolucoes (solicitacao_id, texto, sinais_vitais, autor_id, autor_papel)
  VALUES (s.id, btrim(p_texto), nullif(btrim(coalesce(p_sinais_vitais, '')), ''), private.meu_perfil_id(), v_papel)
  RETURNING id INTO v_id;
  PERFORM private.regulacao_evento(s.id, 'evolucao_atualizada',
    jsonb_build_object('texto', btrim(p_texto), 'sinais_vitais', nullif(btrim(coalesce(p_sinais_vitais, '')), ''), 'papel', v_papel));
  -- as pendências de evolução abertas deste pedido ficam resolvidas (autor e hora)
  UPDATE public.regulacao_pendencias_unidade
     SET status = 'resolvida', resolvida_em = clock_timestamp(), resolvida_por = private.meu_perfil_id(),
         resolucao = 'Evolução do pedido atualizada'
   WHERE solicitacao_id = s.id AND motivo = 'evolucao' AND status <> 'resolvida';
  GET DIAGNOSTICS v_resolvidas = ROW_COUNT;
  IF v_resolvidas > 0 THEN
    PERFORM private.regulacao_evento(s.id, 'pendencia_unidade_resolvida',
      jsonb_build_object('titulo', 'Pendências de evolução', 'quantidade', v_resolvidas, 'nota', 'Evolução do pedido atualizada'));
  END IF;
  IF s.assumida_por IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (s.assumida_por, s.central_id, current_date, 'reg_evolucao_' || s.numero,
            'Regulação nº ' || s.numero || ': a origem atualizou a evolução do paciente.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
  IF s.status = 'aguardando_destino' THEN
    PERFORM private.regulacao_avisar_destino(s, 'reg_evolucao', 'Regulação nº ' || s.numero || ': a origem atualizou a evolução do paciente.');
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_atualizar_evolucao(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_atualizar_evolucao(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_detalhe(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  RETURN private.regulacao_json(s) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.por), 'em', e.em, 'detalhes', e.detalhes)
        ORDER BY e.em) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id), '[]'::jsonb),
    'tempos', coalesce((SELECT jsonb_agg(jsonb_build_object('status', x.status, 'segundos', x.seg, 'vezes', x.vezes, 'atual', x.atual)
        ORDER BY x.primeiro) FROM (
          SELECT t.status, min(t.inicio) AS primeiro, count(*) AS vezes, bool_or(t.fim IS NULL) AS atual,
                 sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio))::bigint AS seg
            FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id GROUP BY t.status) x), '[]'::jsonb),
    'evolucoes', coalesce((SELECT jsonb_agg(jsonb_build_object('texto', e.texto, 'sinais_vitais', e.sinais_vitais, 'em', e.em,
        'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.autor_id), 'papel', e.autor_papel) ORDER BY e.em DESC)
        FROM public.regulacao_evolucoes e WHERE e.solicitacao_id = s.id), '[]'::jsonb),
    'pode_evoluir', (private.regulacao_origem_pode(s) OR private.sou_nir(s.unidade_origem_id))
                    AND s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino'));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Rollback (testado na homologação antes da produção): recriar
-- public.regulacao_atualizar_evolucao e public.regulacao_detalhe com o corpo
-- da 20261115000001_aceite_destino.sql (linhas 686–738; conferir antes com
-- pg_get_functiondef na homologação se outra migration mexeu nelas) e
--   DROP FUNCTION IF EXISTS private.regulacao_papel_evolucao(public.regulacao_solicitacoes);
-- A coluna regulacao_evolucoes.autor_papel fica (expand; a tabela é só
-- inserção e guarda quem atualizou). Para tirar de vez, só numa janela:
--   ALTER TABLE public.regulacao_evolucoes DROP CONSTRAINT IF EXISTS regulacao_evolucoes_autor_papel_check;
--   ALTER TABLE public.regulacao_evolucoes DROP COLUMN IF EXISTS autor_papel;
-- ════════════════════════════════════════════════════════════════════════════
