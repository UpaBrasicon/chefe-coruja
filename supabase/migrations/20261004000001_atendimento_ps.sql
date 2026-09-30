-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend · janela do atendimento do Pronto-Socorro (protótipo,
-- valsAtendPS / pendAtd / altaErro).
--
-- O que entra:
--   1. Rascunho contínuo do SOAP no servidor (um por médico e episódio). É
--      rascunho, não registro: registrar o SOAP ou o desfecho o apaga.
--   2. Pedido de exame rápido no atendimento (sem imprimir): cada exame vira
--      linha em exames_pedidos, como o pedido impresso já fazia. "Resultado
--      chegou" continua em resolver_exame.
--   3. Reavaliação: "aguardar reavaliação" (hora prevista + pendência de
--      exame ou medicação) deixa o episódio EM REAVALIAÇÃO na fila
--      (episodios.reavaliar_em); o texto da reavaliação (≥ 10 letras) é
--      registro só de inserção e tira o episódio desse estado.
--   4. painel_atendimento_ps: prescrição do PS com a última checagem,
--      exames, reavaliações, pendências, o rascunho e a LINHA DO ATENDIMENTO
--      (triagem, início, prescrito, administrado, exame, resultado,
--      reavaliação) montada do banco, com o nome de quem fez.
--   5. registrar_desfecho confere também, no servidor, as regras do
--      protótipo que faltavam:
--        • hipótese diagnóstica (Avaliação do SOAP) — todo desfecho, menos evasão;
--        • diagnóstico de alta (CID) nas altas, transferência e óbito — o
--          informado ou, sem ele, o CID do último SOAP;
--        • procedimento SIGTAP opcional (10 dígitos);
--        • data/hora da alta: nunca no futuro; mais de 30 min antes de agora
--          é ALTA RETROATIVA e pede justificativa (≥ 10 letras);
--        • óbito: setor (padrão: o da porta), CID do óbito e nº da
--          Declaração de Óbito com 6 a 12 dígitos.
--      As já existentes continuam (SOAP, relato ≥ 15 em evasão, alta a pedido
--      e óbito; destino; hora do óbito; exames com resultado e medicação
--      administrada pelos gatilhos da fase 4).
--   6. Receita padrão: as preferências de prescrição ganham um nome de
--      conjunto (receita_padrao) — "salvar como padrão" grava os itens da
--      receita de alta como favoritos com esse nome.
--
-- Nada aqui sugere dose ou conduta. Autor de tudo = login. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. estado "em reavaliação" ──────────────────────────────────────────────
ALTER TABLE public.episodios ADD COLUMN IF NOT EXISTS reavaliar_em timestamptz;
COMMENT ON COLUMN public.episodios.reavaliar_em IS
  'Atendimento do PS em reavaliação: hora prevista. NULL = não aguarda reavaliação. Muda só por aguardar_reavaliacao / registrar_reavaliacao / desfecho.';

-- ── 2. reavaliações (registro clínico, só inserção) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.atendimento_reavaliacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episodio_id   uuid NOT NULL REFERENCES public.episodios(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo          text NOT NULL CHECK (tipo IN ('aguardar', 'reavaliacao')),
  reavaliar_em  timestamptz,
  pendencia     text,
  texto         text,
  autor_id      uuid NOT NULL REFERENCES public.perfis(id),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo <> 'aguardar' OR (reavaliar_em IS NOT NULL AND length(btrim(coalesce(pendencia, ''))) > 0)),
  CHECK (tipo <> 'reavaliacao' OR length(btrim(coalesce(texto, ''))) >= 10)
);
CREATE INDEX IF NOT EXISTS atendimento_reavaliacoes_episodio ON public.atendimento_reavaliacoes (episodio_id, criado_em);
DROP TRIGGER IF EXISTS trg_atendimento_reavaliacoes_so_insercao ON public.atendimento_reavaliacoes;
CREATE TRIGGER trg_atendimento_reavaliacoes_so_insercao BEFORE UPDATE ON public.atendimento_reavaliacoes
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
-- guarda de 20 anos (fase 8): registro clínico não sai por DELETE
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.atendimento_reavaliacoes;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.atendimento_reavaliacoes
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

ALTER TABLE public.atendimento_reavaliacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_reavaliacoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.atendimento_reavaliacoes FROM authenticated;
GRANT SELECT ON public.atendimento_reavaliacoes TO authenticated;
DROP POLICY IF EXISTS atendimento_reavaliacoes_select ON public.atendimento_reavaliacoes;
CREATE POLICY atendimento_reavaliacoes_select ON public.atendimento_reavaliacoes FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = episodio_id
             AND e.setor_id IN (SELECT private.setores_na_escala_agora()))
);
DROP POLICY IF EXISTS atendimento_reavaliacoes_prontuario_aberto ON public.atendimento_reavaliacoes;
CREATE POLICY atendimento_reavaliacoes_prontuario_aberto ON public.atendimento_reavaliacoes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.prontuario_aberto(paciente_id));
DROP POLICY IF EXISTS atendimento_reavaliacoes_segundo_fator ON public.atendimento_reavaliacoes;
CREATE POLICY atendimento_reavaliacoes_segundo_fator ON public.atendimento_reavaliacoes AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── 3. rascunho do SOAP (não é registro: apaga-se ao registrar) ─────────────
CREATE TABLE IF NOT EXISTS public.atendimento_rascunhos (
  episodio_id    uuid NOT NULL REFERENCES public.episodios(id),
  autor_id       uuid NOT NULL REFERENCES public.perfis(id),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  conteudo       jsonb NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (episodio_id, autor_id)
);
COMMENT ON TABLE public.atendimento_rascunhos IS
  'Rascunho contínuo do SOAP do PS, um por médico e episódio. Não é registro clínico (fica fora da guarda): registrar o SOAP ou o desfecho o apaga.';
ALTER TABLE public.atendimento_rascunhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_rascunhos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.atendimento_rascunhos FROM authenticated;
GRANT SELECT ON public.atendimento_rascunhos TO authenticated;
DROP POLICY IF EXISTS atendimento_rascunhos_select ON public.atendimento_rascunhos;
CREATE POLICY atendimento_rascunhos_select ON public.atendimento_rascunhos FOR SELECT TO authenticated
  USING (autor_id = private.meu_perfil_id());
DROP POLICY IF EXISTS atendimento_rascunhos_segundo_fator ON public.atendimento_rascunhos;
CREATE POLICY atendimento_rascunhos_segundo_fator ON public.atendimento_rascunhos AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- guarda comum das escritas do atendimento: médico da porta, atendimento aberto
CREATE OR REPLACE FUNCTION private.atendimento_aberto_na_porta(p_episodio uuid)
RETURNS public.episodios
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Abra o atendimento antes de registrar.';
  END IF;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION private.atendimento_aberto_na_porta(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.salvar_rascunho_atendimento(p_episodio uuid, p_conteudo jsonb)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_vazio boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  e := private.atendimento_aberto_na_porta(p_episodio);
  IF p_conteudo IS NOT NULL AND jsonb_typeof(p_conteudo) <> 'object' THEN RAISE EXCEPTION 'Rascunho inválido.'; END IF;
  IF length(coalesce(p_conteudo, '{}'::jsonb)::text) > 20000 THEN RAISE EXCEPTION 'Rascunho grande demais.'; END IF;
  SELECT NOT EXISTS (SELECT 1 FROM jsonb_each_text(coalesce(p_conteudo, '{}'::jsonb)) x WHERE btrim(coalesce(x.value, '')) <> '')
    INTO v_vazio;
  IF v_vazio THEN
    DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id AND autor_id = private.meu_perfil_id();
    RETURN NULL;
  END IF;
  INSERT INTO public.atendimento_rascunhos (episodio_id, autor_id, unidade_id, conteudo, atualizado_em)
  VALUES (e.id, private.meu_perfil_id(), e.unidade_id, p_conteudo, now())
  ON CONFLICT (episodio_id, autor_id) DO UPDATE SET conteudo = excluded.conteudo, atualizado_em = now();
  RETURN now();
END $$;
REVOKE ALL ON FUNCTION public.salvar_rascunho_atendimento(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_rascunho_atendimento(uuid, jsonb) TO authenticated;

-- registrar o SOAP apaga o rascunho de quem registrou (cópia da fase 2 + isso)
CREATE OR REPLACE FUNCTION public.registrar_soap(
  p_episodio uuid, p_subjetivo text, p_objetivo text, p_avaliacao text, p_plano text, p_cid text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.episodios; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Abra o atendimento antes de registrar.';
  END IF;
  INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, objetivo, avaliacao, cid, plano, autor_id)
  VALUES (e.id, e.unidade_id, e.paciente_id, nullif(btrim(p_subjetivo), ''), nullif(btrim(p_objetivo), ''),
          nullif(btrim(p_avaliacao), ''), nullif(upper(btrim(p_cid)), ''), nullif(btrim(p_plano), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id AND autor_id = private.meu_perfil_id();
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_soap(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_soap(uuid, text, text, text, text, text) TO authenticated;

-- ── 4. pedido de exame rápido (sem imprimir) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.pedir_exames_atendimento(p_episodio uuid, p_exames text[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  x text;
  n int := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  e := private.atendimento_aberto_na_porta(p_episodio);
  IF coalesce(cardinality(p_exames), 0) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame.'; END IF;
  FOREACH x IN ARRAY p_exames LOOP
    x := btrim(coalesce(x, ''));
    CONTINUE WHEN length(x) < 2;
    IF length(x) > 200 THEN RAISE EXCEPTION 'Nome de exame longo demais.'; END IF;
    -- o mesmo exame ainda sem resultado neste atendimento não entra de novo
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos
                           WHERE episodio_id = e.id AND situacao = 'pedido' AND lower(exame) = lower(x));
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, pedido_por)
    VALUES (e.unidade_id, e.paciente_id, e.id, x, private.meu_perfil_id());
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.pedir_exames_atendimento(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_exames_atendimento(uuid, text[]) TO authenticated;

-- ── 5. pendências do atendimento (o que se aguarda para reavaliar) ──────────
CREATE OR REPLACE FUNCTION private.pendencias_atendimento(p_episodio uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT array_remove(ARRAY[
    (SELECT 'exame: ' || string_agg(exame, ', ' ORDER BY pedido_em)
       FROM public.exames_pedidos WHERE episodio_id = p_episodio AND situacao = 'pedido'),
    (SELECT CASE WHEN cardinality(m) > 0 THEN 'medicação: ' || array_to_string(m, ', ') END
       FROM (SELECT private.medicacao_sem_checagem(p_episodio) AS m) s)
  ], NULL)
$$;
REVOKE ALL ON FUNCTION private.pendencias_atendimento(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aguardar_reavaliacao(p_episodio uuid, p_reavaliar_em timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  pend text[];
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  e := private.atendimento_aberto_na_porta(p_episodio);
  pend := private.pendencias_atendimento(e.id);
  IF cardinality(pend) = 0 THEN
    RAISE EXCEPTION 'Nada pendente para reavaliar. Peça exame ou prescreva medicação antes.';
  END IF;
  IF p_reavaliar_em IS NULL THEN RAISE EXCEPTION 'Informe a hora prevista da reavaliação.'; END IF;
  IF p_reavaliar_em < now() - interval '5 minutes' OR p_reavaliar_em > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'Hora da reavaliação fora do plantão (entre agora e as próximas 24 horas).';
  END IF;
  INSERT INTO public.atendimento_reavaliacoes (episodio_id, unidade_id, paciente_id, tipo, reavaliar_em, pendencia, autor_id)
  VALUES (e.id, e.unidade_id, e.paciente_id, 'aguardar', p_reavaliar_em, array_to_string(pend, ' · '), private.meu_perfil_id());
  UPDATE public.episodios SET reavaliar_em = p_reavaliar_em, updated_at = now() WHERE id = e.id;
  PERFORM private.registrar_auditoria('aguardar_reavaliacao', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', 'em_reavaliacao'));
END $$;
REVOKE ALL ON FUNCTION public.aguardar_reavaliacao(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aguardar_reavaliacao(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_reavaliacao(p_episodio uuid, p_texto text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  e := private.atendimento_aberto_na_porta(p_episodio);
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva a reavaliação (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.atendimento_reavaliacoes (episodio_id, unidade_id, paciente_id, tipo, texto, autor_id)
  VALUES (e.id, e.unidade_id, e.paciente_id, 'reavaliacao', btrim(p_texto), private.meu_perfil_id())
  RETURNING id INTO v_id;
  UPDATE public.episodios SET reavaliar_em = NULL, updated_at = now() WHERE id = e.id AND reavaliar_em IS NOT NULL;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_reavaliacao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_reavaliacao(uuid, text) TO authenticated;

-- ── 6. painel do atendimento (leitura) ──────────────────────────────────────
-- Mesmo acesso do SOAP: plantão na porta (ou gestor), segundo fator e
-- prontuário aberto. A prescrição do PS é lida por aqui porque a política
-- de prescricoes só mostra ao médico que prescreveu.
CREATE OR REPLACE FUNCTION public.painel_atendimento_ps(p_episodio uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_presc jsonb; v_exames jsonb; v_reav jsonb; v_linha jsonb; v_rasc jsonb;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (private.eh_super_admin()
             OR private.papel_na_unidade(e.unidade_id) = 'gestor'
             OR e.setor_id IN (SELECT private.setores_na_escala_agora()))
     OR NOT private.prontuario_aberto(e.paciente_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', it.id, 'tipo', it.tipo, 'descricao', it.descricao, 'dose', it.dose, 'via', it.via,
           'posologia', it.posologia, 'se_necessario', it.se_necessario, 'diluicao_texto', it.diluicao_texto,
           'criado_em', it.created_at, 'autor', pa.nome_completo,
           'suspenso_em', it.suspenso_em, 'motivo_suspensao', it.motivo_suspensao,
           'checagem', CASE WHEN ad.id IS NOT NULL THEN jsonb_build_object(
             'situacao', ad.situacao, 'em', ad.registrado_em, 'por', pc.nome_completo, 'motivo', ad.motivo) END)
         ORDER BY it.ordem), '[]'::jsonb)
    INTO v_presc
    FROM public.prescricoes pr
    JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
    LEFT JOIN public.perfis pa ON pa.id = it.autor_id
    LEFT JOIN LATERAL (SELECT a.* FROM public.administracoes a WHERE a.item_id = it.id
                        ORDER BY a.registrado_em DESC LIMIT 1) ad ON true
    LEFT JOIN public.perfis pc ON pc.id = ad.registrado_por
   WHERE pr.episodio_id = e.id AND pr.internacao_id IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'exame', x.exame, 'situacao', x.situacao, 'pedido_em', x.pedido_em,
           'resolvido_em', x.resolvido_em, 'resultado', x.resultado, 'motivo_cancelamento', x.motivo_cancelamento,
           'impresso', x.documento_id IS NOT NULL, 'pedido_por', pp.nome_completo)
         ORDER BY x.pedido_em), '[]'::jsonb)
    INTO v_exames
    FROM public.exames_pedidos x LEFT JOIN public.perfis pp ON pp.id = x.pedido_por
   WHERE x.episodio_id = e.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'tipo', r.tipo, 'reavaliar_em', r.reavaliar_em, 'pendencia', r.pendencia,
           'texto', r.texto, 'criado_em', r.criado_em, 'autor', pf.nome_completo)
         ORDER BY r.criado_em), '[]'::jsonb)
    INTO v_reav
    FROM public.atendimento_reavaliacoes r LEFT JOIN public.perfis pf ON pf.id = r.autor_id
   WHERE r.episodio_id = e.id;

  SELECT conteudo INTO v_rasc FROM public.atendimento_rascunhos
   WHERE episodio_id = e.id AND autor_id = private.meu_perfil_id();

  -- linha do atendimento
  SELECT coalesce(jsonb_agg(jsonb_build_object('em', l.em, 'titulo', l.titulo, 'texto', l.texto) ORDER BY l.em, l.ordem), '[]'::jsonb)
    INTO v_linha
    FROM (
      SELECT c.criado_em AS em, 1 AS ordem,
             CASE WHEN c.reclassificacao THEN 'Reclassificação · ' ELSE 'Triagem · ' END || initcap(c.cor) AS titulo,
             concat_ws(' · ', pf.nome_completo,
               CASE WHEN c.reclassificacao THEN c.motivo ELSE concat_ws(' · ', c.fluxograma_nome, c.discriminador) END) AS texto
        FROM public.classificacoes_risco c LEFT JOIN public.perfis pf ON pf.id = c.autor_id
       WHERE c.episodio_id = e.id
      UNION ALL
      SELECT e.atendimento_iniciado_em, 2, 'Início do atendimento',
             (SELECT nome_completo FROM public.perfis WHERE id = e.atendimento_medico_id)
       WHERE e.atendimento_iniciado_em IS NOT NULL
      UNION ALL
      SELECT it.created_at, 3, 'Prescrito',
             concat_ws(' · ', it.descricao, it.dose, it.via, CASE WHEN it.se_necessario THEN 'se necessário' ELSE it.posologia END, pa.nome_completo)
        FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        LEFT JOIN public.perfis pa ON pa.id = it.autor_id
       WHERE pr.episodio_id = e.id AND pr.internacao_id IS NULL
      UNION ALL
      SELECT a.registrado_em, 4,
             CASE a.situacao WHEN 'feito' THEN 'Administrado' WHEN 'recusado' THEN 'Recusado' ELSE 'Não administrado' END,
             concat_ws(' · ', it.descricao, a.motivo, pc.nome_completo)
        FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
        JOIN public.administracoes a ON a.item_id = it.id
        LEFT JOIN public.perfis pc ON pc.id = a.registrado_por
       WHERE pr.episodio_id = e.id AND pr.internacao_id IS NULL
      UNION ALL
      SELECT it.suspenso_em, 4, 'Suspenso', concat_ws(' · ', it.descricao, it.motivo_suspensao)
        FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
       WHERE pr.episodio_id = e.id AND pr.internacao_id IS NULL AND it.suspenso_em IS NOT NULL
      UNION ALL
      SELECT x.pedido_em, 5, 'Exame pedido', concat_ws(' · ', x.exame, pp.nome_completo)
        FROM public.exames_pedidos x LEFT JOIN public.perfis pp ON pp.id = x.pedido_por
       WHERE x.episodio_id = e.id
      UNION ALL
      SELECT x.resolvido_em, 6,
             CASE WHEN x.situacao = 'resultado' THEN 'Resultado disponível' ELSE 'Exame cancelado' END,
             concat_ws(' · ', x.exame, CASE WHEN x.situacao = 'resultado' THEN x.resultado ELSE x.motivo_cancelamento END, pr2.nome_completo)
        FROM public.exames_pedidos x LEFT JOIN public.perfis pr2 ON pr2.id = x.resolvido_por
       WHERE x.episodio_id = e.id AND x.situacao <> 'pedido'
      UNION ALL
      SELECT s.criado_em, 7, 'Registro do atendimento',
             concat_ws(' · ', s.avaliacao, CASE WHEN s.cid IS NOT NULL THEN 'CID ' || s.cid END, pf.nome_completo)
        FROM public.atendimento_registros s LEFT JOIN public.perfis pf ON pf.id = s.autor_id
       WHERE s.episodio_id = e.id
      UNION ALL
      SELECT r.criado_em, 8,
             CASE WHEN r.tipo = 'aguardar'
                  THEN 'Aguardando reavaliação às ' || to_char(r.reavaliar_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
                  ELSE 'Reavaliação' END,
             concat_ws(' · ', CASE WHEN r.tipo = 'aguardar' THEN r.pendencia ELSE r.texto END, pf.nome_completo)
        FROM public.atendimento_reavaliacoes r LEFT JOIN public.perfis pf ON pf.id = r.autor_id
       WHERE r.episodio_id = e.id
    ) l
   WHERE l.em IS NOT NULL;

  RETURN jsonb_build_object(
    'reavaliar_em', e.reavaliar_em,
    'pendencias', to_jsonb(private.pendencias_atendimento(e.id)),
    'prescricao', v_presc,
    'exames', v_exames,
    'reavaliacoes', v_reav,
    'rascunho', v_rasc,
    'linha', v_linha,
    'medico', (SELECT nome_completo FROM public.perfis WHERE id = e.atendimento_medico_id),
    'setor', (SELECT nome FROM public.setores WHERE id = e.setor_id));
END $$;
REVOKE ALL ON FUNCTION public.painel_atendimento_ps(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_atendimento_ps(uuid) TO authenticated;

-- ── 7. desfecho com as regras do protótipo ──────────────────────────────────
-- Cópia da fase 3 (box / leito) com as regras novas no meio. Detalhes aceitos:
--   destino, hora_obito, numero_do, setor_id, leito_id (já existiam);
--   alta_em, justificativa_retroativa, cid_alta, procedimento,
--   observacoes_alta, setor_obito, cid_obito (novos).
CREATE OR REPLACE FUNCTION public.registrar_desfecho(
  p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.episodios;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_etapa text;
  v_setor uuid;
  v_leito uuid;
  v_internacao uuid;
  v_alta_em timestamptz;
  v_cid text;
  v_proc text;
  v_do text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'O episódio não está em atendimento.'; END IF;
  IF p_desfecho NOT IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito', 'observacao', 'internacao') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;

  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros WHERE episodio_id = e.id) THEN
    RAISE EXCEPTION 'Registre o atendimento (SOAP) antes do desfecho.';
  END IF;
  -- hipótese diagnóstica (protótipo: "Informe a hipótese diagnóstica na aba Atendimento")
  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros
                                             WHERE episodio_id = e.id AND length(btrim(coalesce(avaliacao, ''))) > 0) THEN
    RAISE EXCEPTION 'Informe a hipótese diagnóstica (Avaliação) no registro do atendimento.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(btrim(coalesce(p_relato, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_desfecho = 'obito' THEN
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF (d ->> 'hora_obito')::timestamptz > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN RAISE EXCEPTION 'Informe o número da Declaração de Óbito.'; END IF;
  END IF;

  -- dados da alta (protótipo altaErro, manual 3.17)
  IF nullif(btrim(d ->> 'alta_em'), '') IS NOT NULL THEN
    BEGIN
      v_alta_em := (d ->> 'alta_em')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data e hora da alta inválidas.';
    END;
    IF v_alta_em > now() + interval '1 minute' THEN RAISE EXCEPTION 'Data e hora da alta no futuro.'; END IF;
    IF v_alta_em < e.chegada_em THEN RAISE EXCEPTION 'Data e hora da alta antes da chegada do paciente.'; END IF;
    IF v_alta_em < now() - interval '30 minutes'
       AND length(btrim(coalesce(d ->> 'justificativa_retroativa', ''))) < 10 THEN
      RAISE EXCEPTION 'Alta retroativa: justifique (mínimo de 10 letras).';
    END IF;
    d := d || jsonb_build_object('alta_em', v_alta_em, 'retroativa', v_alta_em < now() - interval '30 minutes');
  END IF;
  IF p_desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito') THEN
    v_cid := coalesce(nullif(btrim(d ->> 'cid_alta'), ''),
                      (SELECT s.cid FROM public.atendimento_registros s
                        WHERE s.episodio_id = e.id AND s.cid IS NOT NULL ORDER BY s.criado_em DESC LIMIT 1));
    IF v_cid IS NULL THEN RAISE EXCEPTION 'Informe o diagnóstico de alta (CID).'; END IF;
    IF private.cid_normalizado(v_cid) IS NULL THEN RAISE EXCEPTION 'Diagnóstico de alta: CID em formato inválido (ex.: J45.9).'; END IF;
    d := d || jsonb_build_object('cid_alta', private.cid_normalizado(v_cid));
  END IF;
  v_proc := nullif(regexp_replace(coalesce(d ->> 'procedimento', ''), '\D', '', 'g'), '');
  IF v_proc IS NOT NULL THEN
    IF v_proc !~ '^\d{10}$' THEN RAISE EXCEPTION 'Procedimento SIGTAP: código de 10 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento SIGTAP não encontrado na tabela vigente.';
    END IF;
    d := d || jsonb_build_object('procedimento', v_proc);
  END IF;
  IF p_desfecho = 'obito' THEN
    d := d || jsonb_build_object('setor_obito', coalesce(nullif(btrim(d ->> 'setor_obito'), ''),
                                                        (SELECT nome FROM public.setores WHERE id = e.setor_id)));
    IF private.cid_normalizado(d ->> 'cid_obito') IS NULL THEN RAISE EXCEPTION 'Óbito: informe o CID do óbito.'; END IF;
    v_do := regexp_replace(coalesce(d ->> 'numero_do', ''), '\D', '', 'g');
    IF v_do !~ '^\d{6,12}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos.'; END IF;
    d := d || jsonb_build_object('cid_obito', private.cid_normalizado(d ->> 'cid_obito'), 'numero_do', v_do);
  END IF;

  IF p_desfecho = 'observacao' THEN
    SELECT b.setor_id, b.leito_id INTO v_setor, v_leito FROM private.box_livre(e.unidade_id, e.publico) b;
    IF v_setor IS NULL THEN RAISE EXCEPTION 'A unidade não tem setor de Observação cadastrado.'; END IF;
    v_internacao := private.internar_do_episodio(e, 'em_observacao', v_setor, v_leito);
    INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id)
    VALUES (e.unidade_id, e.paciente_id, v_internacao, 'observacao',
            'Observação: definir conduta (alta ou internação) em até 6 horas.', now() + interval '6 hours',
            private.meu_perfil_id());
    d := d || jsonb_build_object('internacao_id', v_internacao, 'box', v_leito);
  ELSIF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = e.unidade_id
                                        AND ativo AND tipo IN ('internacao', 'uti', 'isolamento')) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status = 'livre') THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    v_internacao := private.internar_do_episodio(e, 'internado', v_setor, v_leito);
    d := d || jsonb_build_object('internacao_id', v_internacao);
  END IF;

  v_etapa := CASE p_desfecho WHEN 'observacao' THEN 'observacao' WHEN 'internacao' THEN 'internacao' ELSE 'encerrado' END;
  UPDATE public.episodios
     SET etapa = v_etapa,
         desfecho = p_desfecho,
         desfecho_motivo = nullif(btrim(p_relato), ''),
         desfecho_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END,
         desfecho_em = now(), desfecho_por = private.meu_perfil_id(),
         encerrado_em = CASE WHEN v_etapa = 'encerrado' THEN now() END,
         encerrado_por = CASE WHEN v_etapa = 'encerrado' THEN private.meu_perfil_id() END,
         reavaliar_em = NULL,
         updated_at = now()
   WHERE id = e.id;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $$;
REVOKE ALL ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) TO authenticated;

-- ── 8. receita padrão = conjunto nomeado de preferências de prescrição ──────
ALTER TABLE public.preferencias_prescricao ADD COLUMN IF NOT EXISTS receita_padrao text;
ALTER TABLE public.preferencias_prescricao DROP CONSTRAINT IF EXISTS preferencias_prescricao_receita_padrao_check;
ALTER TABLE public.preferencias_prescricao ADD CONSTRAINT preferencias_prescricao_receita_padrao_check
  CHECK (receita_padrao IS NULL OR length(btrim(receita_padrao)) BETWEEN 2 AND 60);
COMMENT ON COLUMN public.preferencias_prescricao.receita_padrao IS
  'Nome da receita padrão (conjunto) a que o favorito pertence; NULL = favorito avulso. A receita de alta do PS aplica o conjunto inteiro.';
-- o mesmo medicamento com a mesma posologia pode estar em conjuntos diferentes
DROP INDEX IF EXISTS public.preferencias_prescricao_sem_repetir;
CREATE UNIQUE INDEX IF NOT EXISTS preferencias_prescricao_sem_repetir
  ON public.preferencias_prescricao (perfil_id, medicamento_id, lower(btrim(posologia)), coalesce(lower(btrim(receita_padrao)), ''));
