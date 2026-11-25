-- ════════════════════════════════════════════════════════════════════════════
-- Aba Exames do leito no modelo do RT (25/11/2026), EXM2: combos de exames.
--
-- Combo é conteúdo clínico: o app não traz combo pronto (sem fonte citada, não
-- entra). Quem monta é o gestor da unidade, no mesmo lugar onde já marca os
-- exames frequentes (Gestão > Exames da unidade): um nome e a lista de exames,
-- todos da lista da unidade (public.exames_unidade vigente). No pedido do
-- leito, um clique põe os exames do combo na cesta; nada é pedido sem o
-- médico ver a cesta. Sem combo cadastrado, a linha de combos não aparece.
--
-- 1. public.exames_combos: um combo por linha, com versão como a lista da
--    unidade (mudar = fechar a linha vigente e abrir outra; retirar = fechar
--    com motivo). RLS ligada e nenhum acesso direto: leitura e escrita só pelas
--    funções abaixo, como em public.exames_unidade.
-- 2. public.combos_exames_unidade(unidade): os combos vigentes, com o nome
--    curto de cada exame (o exame que saiu da lista da unidade some do combo).
--    Quem tem vínculo com a unidade lê; `pode_definir` diz se é o gestor.
-- 3. public.definir_combo_exames(unidade, nome, procedimentos, combo, ordem) e
--    public.retirar_combo_exames(combo, motivo): só o gestor da unidade (ou o
--    administrador geral), com auditoria.
--
-- Inventário LGPD: a tabela entra na operação "exames"
-- (docs/regulatorio/inventario/operacoes.json). Não guarda dado de paciente;
-- guarda quem definiu (perfil).
--
-- Expand: tabela nova e funções novas. Idempotente.
-- Rollback: no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exames_combos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  nome            text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 60),
  procedimentos   text[] NOT NULL CHECK (cardinality(procedimentos) BETWEEN 1 AND 30),
  ordem           int NOT NULL DEFAULT 0,
  definido_por    uuid NOT NULL REFERENCES public.perfis(id),
  definido_em     timestamptz NOT NULL DEFAULT now(),
  vigente_ate     timestamptz,
  retirado_por    uuid REFERENCES public.perfis(id),
  motivo_retirada text
);
COMMENT ON TABLE public.exames_combos IS
  'Combos de exames montados pelo gestor da unidade (EXM2, 25/11/2026). O app não traz combo pronto.';
CREATE INDEX IF NOT EXISTS exames_combos_unidade_vigente ON public.exames_combos (unidade_id) WHERE vigente_ate IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS exames_combos_nome_vigente ON public.exames_combos (unidade_id, lower(btrim(nome))) WHERE vigente_ate IS NULL;

ALTER TABLE public.exames_combos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exames_combos FROM anon, authenticated;
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.exames_combos;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.exames_combos FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

CREATE OR REPLACE FUNCTION public.combos_exames_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = p_unidade AND v.perfil_id = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora dos seus vínculos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'combos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'ordem', c.ordem, 'definido_em', c.definido_em,
               'definido_por', (SELECT nome_completo FROM public.perfis WHERE id = c.definido_por),
               'itens', coalesce((
                 SELECT jsonb_agg(jsonb_build_object('procedimento', eu.procedimento, 'nome_curto', eu.nome_curto) ORDER BY x.n)
                   FROM unnest(c.procedimentos) WITH ORDINALITY x(proc, n)
                   JOIN public.exames_unidade eu ON eu.unidade_id = c.unidade_id AND eu.procedimento = x.proc AND eu.vigente_ate IS NULL), '[]'::jsonb))
             ORDER BY c.ordem, c.nome)
        FROM public.exames_combos c
       WHERE c.unidade_id = p_unidade AND c.vigente_ate IS NULL), '[]'::jsonb),
    'pode_definir', private.eh_super_admin() OR private.gestor_da_unidade(p_unidade));
END $$;
REVOKE ALL ON FUNCTION public.combos_exames_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.combos_exames_unidade(uuid) TO authenticated;

-- p_combo NULL: combo novo; senão, muda o combo (a versão anterior fica fechada)
CREATE OR REPLACE FUNCTION public.definir_combo_exames(p_unidade uuid, p_nome text, p_procedimentos text[],
  p_combo uuid DEFAULT NULL, p_ordem int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_procs text[];
  v_fora text;
  v_antigo public.exames_combos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os combos de exames são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_nome) < 2 OR length(v_nome) > 60 THEN RAISE EXCEPTION 'Nome do combo entre 2 e 60 letras.'; END IF;
  -- sem repetir e na ordem em que vieram
  SELECT array_agg(p ORDER BY n) INTO v_procs
    FROM (SELECT DISTINCT ON (p) p, n
            FROM unnest(coalesce(p_procedimentos, '{}')) WITH ORDINALITY x(bruto, n)
            CROSS JOIN LATERAL (SELECT nullif(regexp_replace(coalesce(x.bruto, ''), '\D', '', 'g'), '') AS p) y
           WHERE p IS NOT NULL ORDER BY p, n) z;
  IF coalesce(cardinality(v_procs), 0) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame para o combo.'; END IF;
  IF cardinality(v_procs) > 30 THEN RAISE EXCEPTION 'No máximo 30 exames por combo.'; END IF;
  SELECT string_agg(p, ', ') INTO v_fora FROM unnest(v_procs) p
   WHERE NOT EXISTS (SELECT 1 FROM public.exames_unidade eu WHERE eu.unidade_id = p_unidade AND eu.procedimento = p AND eu.vigente_ate IS NULL);
  IF v_fora IS NOT NULL THEN RAISE EXCEPTION 'Exame fora da lista da unidade: %.', v_fora; END IF;
  IF p_combo IS NOT NULL THEN
    SELECT * INTO v_antigo FROM public.exames_combos WHERE id = p_combo AND unidade_id = p_unidade AND vigente_ate IS NULL FOR UPDATE;
    IF v_antigo.id IS NULL THEN RAISE EXCEPTION 'Combo não encontrado.'; END IF;
    UPDATE public.exames_combos SET vigente_ate = now(), retirado_por = v_eu, motivo_retirada = 'alterado' WHERE id = v_antigo.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.exames_combos WHERE unidade_id = p_unidade AND vigente_ate IS NULL AND lower(btrim(nome)) = lower(v_nome)) THEN
    RAISE EXCEPTION 'Já há um combo com o nome %.', v_nome;
  END IF;
  INSERT INTO public.exames_combos (unidade_id, nome, procedimentos, ordem, definido_por)
  VALUES (p_unidade, v_nome, v_procs, coalesce(p_ordem, 0), v_eu);
  PERFORM private.registrar_auditoria(CASE WHEN v_antigo.id IS NULL THEN 'exame_combo_incluido' ELSE 'exame_combo_alterado' END,
    'exames_combos', p_unidade, p_unidade,
    jsonb_build_object('nome', v_nome, 'procedimentos', to_jsonb(v_procs),
                       'antes', CASE WHEN v_antigo.id IS NOT NULL THEN jsonb_build_object('nome', v_antigo.nome, 'procedimentos', to_jsonb(v_antigo.procedimentos)) END));
  RETURN public.combos_exames_unidade(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.definir_combo_exames(uuid, text, text[], uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_combo_exames(uuid, text, text[], uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_combo_exames(p_combo uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), ''); c public.exames_combos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.exames_combos WHERE id = p_combo AND vigente_ate IS NULL FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Combo não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: os combos de exames são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que o combo sai (mínimo de 10 letras).'; END IF;
  UPDATE public.exames_combos SET vigente_ate = now(), retirado_por = v_eu, motivo_retirada = v_motivo WHERE id = c.id;
  PERFORM private.registrar_auditoria('exame_combo_retirado', 'exames_combos', c.unidade_id, c.unidade_id,
    jsonb_build_object('nome', c.nome, 'motivo', v_motivo));
  RETURN public.combos_exames_unidade(c.unidade_id);
END $$;
REVOKE ALL ON FUNCTION public.retirar_combo_exames(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_combo_exames(uuid, text) TO authenticated;

-- ── Rollback (na ordem) ─────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.retirar_combo_exames(uuid, text);
-- DROP FUNCTION IF EXISTS public.definir_combo_exames(uuid, text, text[], uuid, int);
-- DROP FUNCTION IF EXISTS public.combos_exames_unidade(uuid);
-- DROP TABLE IF EXISTS public.exames_combos;   (a guarda sem delete não impede o DROP TABLE)
-- e tirar "public.exames_combos" de docs/regulatorio/inventario/operacoes.json.
