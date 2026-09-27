-- Fase 4.9 — farmácia operacional (protótipo, ESTADO.md 103-145 e 203).
--
--  * Validação: fila dos itens de medicamento ainda não validados; o
--    farmacêutico "confere" ou "devolve para correção" com motivo; a
--    devolução aparece no item da prescrição do médico.
--  * Disponibilidade: quantidade por medicamento na unidade, com limites
--    editáveis de crítico e de falta — o selo é a comparação, não uma coluna.
--  * Faltas: quem está de plantão sinaliza; o farmacêutico leva de
--    Registrada → Em cotação → Reposta.
--  * Compatibilidade em Y: fica para quando houver fonte declarada; a
--    validação mostra as incompatibilidades da diluição publicada.

CREATE OR REPLACE FUNCTION private.farmaceutico_da(p_unidade uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT private.tenho_papel(p_unidade, 'farmaceutico') IS TRUE $$;

-- ── validação ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.validacoes_prescricao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES public.prescricao_itens(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  situacao      text NOT NULL CHECK (situacao IN ('confere', 'devolvido')),
  motivo        text,
  farmaceutico_id uuid NOT NULL REFERENCES public.perfis(id),
  em            timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- "vale o último": horário real de cada registro, mesmo dentro de uma transação
ALTER TABLE public.administracoes ALTER COLUMN registrado_em SET DEFAULT clock_timestamp();
CREATE INDEX IF NOT EXISTS validacoes_item ON public.validacoes_prescricao (item_id, em DESC);
DROP TRIGGER IF EXISTS trg_validacoes_so_insercao ON public.validacoes_prescricao;
CREATE TRIGGER trg_validacoes_so_insercao BEFORE UPDATE OR DELETE ON public.validacoes_prescricao
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.validacoes_prescricao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS validacoes_select ON public.validacoes_prescricao;
CREATE POLICY validacoes_select ON public.validacoes_prescricao FOR SELECT TO authenticated
  USING (private.farmaceutico_da(unidade_id) OR private.papel_na_unidade(unidade_id) = 'gestor');
REVOKE INSERT, UPDATE, DELETE ON public.validacoes_prescricao FROM anon, authenticated;
GRANT SELECT ON public.validacoes_prescricao TO authenticated;

CREATE OR REPLACE FUNCTION public.fila_validacao(p_unidade uuid)
RETURNS TABLE (item_id uuid, paciente_nome text, local text, descricao text, dose text, via text, posologia text,
               se_necessario boolean, peso_kg numeric, diluicao_versao int, diluicao_texto text, diluicao_divergente boolean,
               justificativa_divergencia text, incompatibilidades text[], alta_vigilancia boolean, prescrito_por text, prescrito_em timestamptz,
               ultima_situacao text, ultimo_motivo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'A validação é do farmacêutico da unidade.'; END IF;
  RETURN QUERY
  SELECT it.id, coalesce(pa.nome_social, pa.nome),
         coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = pr.internacao_id),
                  (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
         it.descricao, it.dose, it.via, it.posologia, it.se_necessario, it.peso_kg, it.diluicao_versao, it.diluicao_texto,
         it.diluicao_divergente, it.justificativa_divergencia, d.incompatibilidades, coalesce(m.alta_vigilancia, false),
         pf.nome_completo, it.created_at, v.situacao, v.motivo
  FROM public.prescricoes pr
  JOIN public.pacientes pa ON pa.id = pr.paciente_id
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id AND it.suspenso_em IS NULL AND it.tipo = 'medicamento'
  LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
  LEFT JOIN public.diluicao d ON d.id = it.diluicao_id
  LEFT JOIN public.perfis pf ON pf.id = it.autor_id
  LEFT JOIN LATERAL (SELECT vp.situacao, vp.motivo FROM public.validacoes_prescricao vp WHERE vp.item_id = it.id ORDER BY vp.em DESC LIMIT 1) v ON true
  WHERE pr.unidade_id = p_unidade AND pr.status = 'ativa' AND coalesce(v.situacao, '') <> 'confere'
  ORDER BY (v.situacao IS NULL) DESC, it.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.validar_item(p_item uuid, p_confere boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr public.prescricoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens it ON it.prescricao_id = p.id WHERE it.id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT private.farmaceutico_da(pr.unidade_id) THEN RAISE EXCEPTION 'A validação é do farmacêutico da unidade.'; END IF;
  IF NOT p_confere AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Devolver para correção exige motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.validacoes_prescricao (item_id, unidade_id, situacao, motivo, farmaceutico_id)
  VALUES (p_item, pr.unidade_id, CASE WHEN p_confere THEN 'confere' ELSE 'devolvido' END, nullif(btrim(p_motivo), ''), private.meu_perfil_id());
END $$;

-- a prescrição vigente passa a mostrar a validação da farmácia
DROP FUNCTION IF EXISTS public.prescricao_vigente(uuid, timestamptz);
CREATE FUNCTION public.prescricao_vigente(p_paciente uuid, p_em timestamptz DEFAULT now())
RETURNS TABLE (id uuid, tipo text, descricao text, medicamento_id uuid, dose text, via text, posologia text, se_necessario boolean,
               observacao text, peso_kg numeric, diluicao_versao int, diluicao_texto text, diluicao_divergente boolean,
               justificativa_divergencia text, vasoativo boolean, autor text, criado_em timestamptz, suspenso_em timestamptz,
               validacao text, validacao_motivo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_presc uuid;
BEGIN
  IF NOT (private.paciente_no_meu_plantao(p_paciente)
          OR private.papel_na_unidade((SELECT unidade_id FROM public.pacientes WHERE pacientes.id = p_paciente)) = 'gestor'
          OR private.sou_farmaceutico()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  v_presc := private.prescricao_do_paciente(p_paciente, false);
  RETURN QUERY
  SELECT i.id, i.tipo, i.descricao, i.medicamento_id, i.dose, i.via, i.posologia, i.se_necessario, i.observacao, i.peso_kg,
         i.diluicao_versao, i.diluicao_texto, i.diluicao_divergente, i.justificativa_divergencia,
         coalesce(m.vasoativo, false), pf.nome_completo, i.created_at, i.suspenso_em, v.situacao, v.motivo
  FROM public.prescricao_itens i
  LEFT JOIN public.medicamento m ON m.id = i.medicamento_id
  LEFT JOIN public.perfis pf ON pf.id = i.autor_id
  LEFT JOIN LATERAL (SELECT vp.situacao, vp.motivo FROM public.validacoes_prescricao vp WHERE vp.item_id = i.id ORDER BY vp.em DESC LIMIT 1) v ON true
  WHERE i.prescricao_id = v_presc AND i.created_at <= p_em AND (i.suspenso_em IS NULL OR i.suspenso_em > p_em)
  ORDER BY i.ordem;
END $$;
REVOKE ALL ON FUNCTION public.prescricao_vigente(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prescricao_vigente(uuid, timestamptz) TO authenticated;

-- ── disponibilidade ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_medicamento (
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  medicamento_id uuid NOT NULL REFERENCES public.medicamento(id),
  quantidade     numeric NOT NULL CHECK (quantidade >= 0),
  limite_critico numeric CHECK (limite_critico >= 0),
  limite_falta   numeric CHECK (limite_falta >= 0),
  atualizado_por uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unidade_id, medicamento_id)
);
ALTER TABLE public.estoque_medicamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estoque_select ON public.estoque_medicamento;
CREATE POLICY estoque_select ON public.estoque_medicamento FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
REVOKE INSERT, UPDATE, DELETE ON public.estoque_medicamento FROM anon, authenticated;
GRANT SELECT ON public.estoque_medicamento TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_estoque(p_unidade uuid, p_medicamento uuid, p_quantidade numeric,
  p_limite_critico numeric DEFAULT NULL, p_limite_falta numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'Estoque é do farmacêutico da unidade.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  IF p_limite_falta IS NOT NULL AND p_limite_critico IS NOT NULL AND p_limite_falta > p_limite_critico THEN
    RAISE EXCEPTION 'O limite de falta não pode ser maior que o de crítico.';
  END IF;
  INSERT INTO public.estoque_medicamento (unidade_id, medicamento_id, quantidade, limite_critico, limite_falta, atualizado_por)
  VALUES (p_unidade, p_medicamento, p_quantidade, p_limite_critico, p_limite_falta, private.meu_perfil_id())
  ON CONFLICT (unidade_id, medicamento_id) DO UPDATE SET quantidade = EXCLUDED.quantidade,
    limite_critico = coalesce(EXCLUDED.limite_critico, estoque_medicamento.limite_critico),
    limite_falta = coalesce(EXCLUDED.limite_falta, estoque_medicamento.limite_falta),
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
END $$;

-- o selo é a comparação
CREATE OR REPLACE FUNCTION public.disponibilidade(p_unidade uuid)
RETURNS TABLE (medicamento_id uuid, principio_ativo text, apresentacao text, quantidade numeric, limite_critico numeric,
               limite_falta numeric, situacao text, atualizado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.id, m.principio_ativo, m.apresentacao, e.quantidade, e.limite_critico, e.limite_falta,
         CASE WHEN e.quantidade IS NULL THEN 'nao_informado'
              WHEN e.limite_falta IS NOT NULL AND e.quantidade <= e.limite_falta THEN 'falta'
              WHEN e.limite_critico IS NOT NULL AND e.quantidade <= e.limite_critico THEN 'critico'
              ELSE 'ok' END,
         e.atualizado_em
  FROM public.medicamento m
  LEFT JOIN public.estoque_medicamento e ON e.medicamento_id = m.id AND e.unidade_id = p_unidade
  WHERE m.ativo AND private.membro_da_unidade(p_unidade)
  ORDER BY CASE WHEN e.quantidade IS NULL THEN 3 WHEN e.limite_falta IS NOT NULL AND e.quantidade <= e.limite_falta THEN 0
                WHEN e.limite_critico IS NOT NULL AND e.quantidade <= e.limite_critico THEN 1 ELSE 2 END, m.principio_ativo
$$;

-- ── faltas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.faltas_medicamento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  medicamento_id uuid NOT NULL REFERENCES public.medicamento(id),
  situacao       text NOT NULL DEFAULT 'registrada' CHECK (situacao IN ('registrada', 'em_cotacao', 'reposta')),
  observacao     text,
  sinalizada_por uuid NOT NULL REFERENCES public.perfis(id),
  sinalizada_em  timestamptz NOT NULL DEFAULT now(),
  atualizada_por uuid REFERENCES public.perfis(id),
  atualizada_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_falta_aberta ON public.faltas_medicamento (unidade_id, medicamento_id) WHERE situacao <> 'reposta';
ALTER TABLE public.faltas_medicamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faltas_select ON public.faltas_medicamento;
CREATE POLICY faltas_select ON public.faltas_medicamento FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
REVOKE INSERT, UPDATE, DELETE ON public.faltas_medicamento FROM anon, authenticated;
GRANT SELECT ON public.faltas_medicamento TO authenticated;

CREATE OR REPLACE FUNCTION public.sinalizar_falta(p_unidade uuid, p_medicamento uuid, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.farmaceutico_da(p_unidade) OR private.na_escala_agora(p_unidade)) THEN
    RAISE EXCEPTION 'Sinaliza falta quem está de plantão na unidade ou o farmacêutico.';
  END IF;
  SELECT id INTO v_id FROM public.faltas_medicamento WHERE unidade_id = p_unidade AND medicamento_id = p_medicamento AND situacao <> 'reposta';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- já sinalizada: não duplica
  INSERT INTO public.faltas_medicamento (unidade_id, medicamento_id, observacao, sinalizada_por)
  VALUES (p_unidade, p_medicamento, nullif(btrim(p_observacao), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.avancar_falta(p_falta uuid, p_situacao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.faltas_medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO f FROM public.faltas_medicamento WHERE id = p_falta FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falta não encontrada.'; END IF;
  IF NOT private.farmaceutico_da(f.unidade_id) THEN RAISE EXCEPTION 'Acompanhar a falta é do farmacêutico.'; END IF;
  IF NOT ((f.situacao = 'registrada' AND p_situacao IN ('em_cotacao', 'reposta')) OR (f.situacao = 'em_cotacao' AND p_situacao = 'reposta')) THEN
    RAISE EXCEPTION 'A falta anda: Registrada → Em cotação → Reposta.';
  END IF;
  UPDATE public.faltas_medicamento SET situacao = p_situacao, atualizada_por = private.meu_perfil_id(), atualizada_em = now() WHERE id = f.id;
END $$;

REVOKE ALL ON FUNCTION public.fila_validacao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validar_item(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atualizar_estoque(uuid, uuid, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disponibilidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sinalizar_falta(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.avancar_falta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_validacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_item(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_estoque(uuid, uuid, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disponibilidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sinalizar_falta(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avancar_falta(uuid, text) TO authenticated;
