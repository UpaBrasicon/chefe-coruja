-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 3 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC3 = A): os lotes de vacina da UBS.
--
-- A Ficha de Vacinação (LEDI APS 8.7.0) leva o lote (letras, números, "/", "."
-- e "-", até 30) e o fabricante pelo código RNDS. A UBS cadastra os lotes que
-- recebe; na aplicação (PR 4) a sala de vacina escolhe o lote, e o vencido não
-- aparece. Sem controle de estoque.
--
-- 1. public.vacina_lotes: unidade, imunobiológico, lote, fabricante, validade e
--    se está ativo. Lê quem é da unidade; grava só pelas funções abaixo.
-- 2. public.vacina_lotes_da_unidade(unidade): os lotes (com vencido sim ou não),
--    os imunobiológicos que a sala de vacina aplica no atendimento do dia (os
--    que têm regra no LEDI) e os fabricantes. Diz se quem lê pode cadastrar.
-- 3. public.vacina_lote_salvar e public.vacina_lote_desativar: o gestor e o
--    enfermeiro da UBS, com segundo fator e auditoria. O lote repetido
--    (imunobiológico, lote e fabricante) reativa o que estava desativado.
-- 4. private.vacina_lote_valido(lote, imunobiológico, unidade, dia): o lote é da
--    unidade, do imunobiológico, ativo e dentro da validade. A aplicação (PR 4)
--    usa.
--
-- Idempotente. Teste: supabase/tests/ubs_u15_vacina_lotes.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS private.vacina_lote_valido(uuid, integer, uuid, date),
--     public.vacina_lote_desativar(uuid), public.vacina_lote_salvar(uuid, integer, text, text, date),
--     public.vacina_lotes_da_unidade(uuid), private.vacina_lote_gestao(uuid);
--   DROP TABLE IF EXISTS public.vacina_lotes;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabela ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vacina_lotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  imunobiologico  integer NOT NULL REFERENCES terminologia.vacina_imunobiologico(codigo),
  lote            text NOT NULL CHECK (lote ~ '^[A-Za-z0-9/.-]{1,30}$'),
  fabricante      text NOT NULL REFERENCES terminologia.vacina_fabricante(codigo_rnds),
  validade        date NOT NULL,
  ativo           boolean NOT NULL DEFAULT true,
  criado_por      uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_por  uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vacina_lotes_unico
  ON public.vacina_lotes (unidade_id, imunobiologico, upper(lote), fabricante);
CREATE INDEX IF NOT EXISTS vacina_lotes_imunobiologico_idx ON public.vacina_lotes (imunobiologico);
CREATE INDEX IF NOT EXISTS vacina_lotes_fabricante_idx ON public.vacina_lotes (fabricante);
CREATE INDEX IF NOT EXISTS vacina_lotes_criado_por_idx ON public.vacina_lotes (criado_por);
CREATE INDEX IF NOT EXISTS vacina_lotes_atualizado_por_idx ON public.vacina_lotes (atualizado_por);
COMMENT ON TABLE public.vacina_lotes IS
  'U15 (VC3 = A): lotes de vacina da UBS (imunobiológico, lote e fabricante do LEDI APS, validade). Sem estoque.';
ALTER TABLE public.vacina_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vacina_lotes_le ON public.vacina_lotes;
CREATE POLICY vacina_lotes_le ON public.vacina_lotes FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
REVOKE INSERT, UPDATE, DELETE ON public.vacina_lotes FROM anon, authenticated;
REVOKE ALL ON public.vacina_lotes FROM anon;
GRANT SELECT ON public.vacina_lotes TO authenticated;

-- quem cadastra: o gestor e o enfermeiro da UBS (e o super admin)
CREATE OR REPLACE FUNCTION private.vacina_lote_gestao(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo = 'ubs')
     AND (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor') OR private.tenho_papel(p_unidade, 'enfermeiro'));
$$;
REVOKE ALL ON FUNCTION private.vacina_lote_gestao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vacina_lote_gestao(uuid) TO authenticated;

-- ── 2. leitura ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_lotes_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_hoje date := private.data_atual();
BEGIN
  IF NOT private.membro_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'pode_cadastrar', private.vacina_lote_gestao(p_unidade),
    'hoje', v_hoje,
    'lotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'imunobiologico', l.imunobiologico, 'imunobiologico_nome', i.nome, 'sigla', i.sigla,
               'lote', l.lote, 'fabricante', l.fabricante, 'fabricante_nome', f.nome, 'validade', l.validade,
               'vencido', l.validade < v_hoje, 'ativo', l.ativo)
             ORDER BY l.ativo DESC, i.nome, l.validade)
        FROM public.vacina_lotes l
        JOIN terminologia.vacina_imunobiologico i ON i.codigo = l.imunobiologico
        JOIN terminologia.vacina_fabricante f ON f.codigo_rnds = l.fabricante
       WHERE l.unidade_id = p_unidade), '[]'::jsonb),
    'imunobiologicos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('codigo', i.codigo, 'nome', i.nome, 'sigla', i.sigla) ORDER BY i.nome)
        FROM terminologia.vacina_imunobiologico i
       WHERE EXISTS (SELECT 1 FROM terminologia.vacina_regra r WHERE r.imunobiologico = i.codigo)), '[]'::jsonb),
    'fabricantes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('codigo', f.codigo_rnds, 'nome', f.nome) ORDER BY f.nome)
        FROM terminologia.vacina_fabricante f), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.vacina_lotes_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_lotes_da_unidade(uuid) TO authenticated;

-- ── 3. cadastro ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_lote_salvar(p_unidade uuid, p_imunobiologico integer, p_lote text,
  p_fabricante text, p_validade date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lote text := upper(btrim(coalesce(p_lote, '')));
  v_fab text := btrim(coalesce(p_fabricante, ''));
  v_id uuid;
  v_ativo boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.vacina_lote_gestao(p_unidade) THEN
    RAISE EXCEPTION 'Só o gestor e o enfermeiro da UBS cadastram lotes de vacina.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = p_imunobiologico) THEN
    RAISE EXCEPTION 'Imunobiológico fora da lista da sala de vacina (LEDI APS).';
  END IF;
  IF v_lote !~ '^[A-Z0-9/.-]{1,30}$' THEN
    RAISE EXCEPTION 'Lote: até 30 letras, números, "/", "." ou "-".';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_fabricante WHERE codigo_rnds = v_fab) THEN
    RAISE EXCEPTION 'Fabricante fora da lista da RNDS.';
  END IF;
  IF p_validade IS NULL OR p_validade < private.data_atual() THEN
    RAISE EXCEPTION 'Informe a validade do lote (não pode ter passado).';
  END IF;

  SELECT id, ativo INTO v_id, v_ativo FROM public.vacina_lotes
   WHERE unidade_id = p_unidade AND imunobiologico = p_imunobiologico AND upper(lote) = v_lote AND fabricante = v_fab;
  IF v_id IS NOT NULL AND v_ativo THEN
    RAISE EXCEPTION 'Este lote já está cadastrado.';
  END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.vacina_lotes SET ativo = true, validade = p_validade, atualizado_por = private.meu_perfil_id(), atualizado_em = now()
     WHERE id = v_id;
  ELSE
    INSERT INTO public.vacina_lotes (unidade_id, imunobiologico, lote, fabricante, validade, criado_por, atualizado_por)
    VALUES (p_unidade, p_imunobiologico, v_lote, v_fab, p_validade, private.meu_perfil_id(), private.meu_perfil_id())
    RETURNING id INTO v_id;
  END IF;
  PERFORM private.registrar_auditoria('vacina_lote_salvo', 'vacina_lotes', v_id, p_unidade,
    jsonb_build_object('imunobiologico', p_imunobiologico, 'lote', v_lote, 'fabricante', v_fab, 'validade', p_validade));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.vacina_lote_salvar(uuid, integer, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_lote_salvar(uuid, integer, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.vacina_lote_desativar(p_lote uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.vacina_lotes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO l FROM public.vacina_lotes WHERE id = p_lote;
  IF NOT FOUND OR NOT private.vacina_lote_gestao(l.unidade_id) THEN
    RAISE EXCEPTION 'Só o gestor e o enfermeiro da UBS desativam lotes de vacina.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.vacina_lotes SET ativo = false, atualizado_por = private.meu_perfil_id(), atualizado_em = now() WHERE id = p_lote;
  PERFORM private.registrar_auditoria('vacina_lote_desativado', 'vacina_lotes', p_lote, l.unidade_id,
    jsonb_build_object('lote', l.lote));
END $$;
REVOKE ALL ON FUNCTION public.vacina_lote_desativar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_lote_desativar(uuid) TO authenticated;

-- ── 4. lote válido na aplicação ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.vacina_lote_valido(p_lote uuid, p_imunobiologico integer, p_unidade uuid, p_dia date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vacina_lotes l
                  WHERE l.id = p_lote AND l.unidade_id = p_unidade AND l.imunobiologico = p_imunobiologico
                    AND l.ativo AND l.validade >= p_dia);
$$;
REVOKE ALL ON FUNCTION private.vacina_lote_valido(uuid, integer, uuid, date) FROM PUBLIC, anon, authenticated;
