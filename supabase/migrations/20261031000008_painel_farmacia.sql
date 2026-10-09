-- Fase 2, tarefa 9 do BACKLOG.md — painel da farmácia para críticos e faltas.
--
-- Consolida as faltas abertas da unidade com prioridade:
--   1. medicamento de alta vigilância (dupla checagem, tarefa 1);
--   2. impacto: quantos pacientes têm o medicamento em item vigente agora e em
--      quais setores;
--   3. a falta mais antiga primeiro.
-- A farmácia dá RETORNO na falta (substituto, previsão, conduta): texto só por
-- inserção, com autor e hora, que o plantão vê ao escolher o medicamento na
-- prescrição. O painel junta, na tela, o estoque crítico, a validação
-- pendente de alta vigilância e a 2ª conferência pendente, que já têm as suas
-- RPCs.
-- Só aditiva.
--
-- ROLLBACK: DROP FUNCTION public.faltas_priorizadas, public.registrar_retorno_falta,
--   public.falta_do_medicamento; DROP TABLE public.retornos_falta.

CREATE TABLE IF NOT EXISTS public.retornos_falta (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  falta_id   uuid NOT NULL REFERENCES public.faltas_medicamento(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  texto      text NOT NULL CHECK (length(btrim(texto)) >= 5),
  por        uuid NOT NULL REFERENCES public.perfis(id),
  em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retornos_falta_falta ON public.retornos_falta (falta_id, em DESC);
ALTER TABLE public.retornos_falta ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.retornos_falta FROM authenticated, anon;
DROP POLICY IF EXISTS retornos_falta_select ON public.retornos_falta;
CREATE POLICY retornos_falta_select ON public.retornos_falta FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
CREATE OR REPLACE FUNCTION private.retorno_falta_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Retorno da farmácia é só de inserção: escreva um novo.'; END $$;
DROP TRIGGER IF EXISTS retornos_falta_so_insercao ON public.retornos_falta;
CREATE TRIGGER retornos_falta_so_insercao BEFORE UPDATE OR DELETE ON public.retornos_falta
  FOR EACH ROW EXECUTE FUNCTION private.retorno_falta_so_insercao();

CREATE OR REPLACE FUNCTION public.registrar_retorno_falta(p_falta uuid, p_texto text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.faltas_medicamento; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO f FROM public.faltas_medicamento WHERE id = p_falta;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Falta não encontrada.'; END IF;
  IF NOT private.farmaceutico_da(f.unidade_id) THEN
    RAISE EXCEPTION 'O retorno da falta é do farmacêutico da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o retorno (substituto, previsão ou conduta).'; END IF;
  INSERT INTO public.retornos_falta (falta_id, unidade_id, texto, por) VALUES (f.id, f.unidade_id, btrim(p_texto), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('retorno_falta', 'faltas_medicamento', f.id, f.unidade_id, jsonb_build_object('situacao', f.situacao));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_retorno_falta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_retorno_falta(uuid, text) TO authenticated;

-- faltas abertas com prioridade e impacto (farmacêutico ou gestor)
CREATE OR REPLACE FUNCTION public.faltas_priorizadas(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.farmaceutico_da(p_unidade) OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: painel da farmácia.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'alta_vigilancia')::boolean DESC, (x ->> 'pacientes')::int DESC, x ->> 'sinalizada_em')
      FROM (
        SELECT jsonb_build_object(
                 'id', f.id, 'medicamento_id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao,
                 'situacao', f.situacao, 'observacao', f.observacao, 'sinalizada_em', f.sinalizada_em, 'sinalizada_por', ps.nome_completo,
                 'alta_vigilancia', private.exige_dupla_checagem(p_unidade, m.id),
                 'pacientes', (SELECT count(DISTINCT pr.paciente_id) FROM public.prescricao_itens it
                                 JOIN public.prescricoes pr ON pr.id = it.prescricao_id
                                WHERE it.medicamento_id = m.id AND it.suspenso_em IS NULL AND pr.status = 'ativa' AND pr.unidade_id = p_unidade),
                 'setores', coalesce((SELECT jsonb_agg(DISTINCT s.nome) FROM public.prescricao_itens it
                                        JOIN public.prescricoes pr ON pr.id = it.prescricao_id
                                        JOIN public.pacientes pa ON pa.id = pr.paciente_id
                                        LEFT JOIN public.internacoes i ON i.id = pr.internacao_id
                                        JOIN public.setores s ON s.id = coalesce(i.setor_atual_id, pa.setor_id)
                                       WHERE it.medicamento_id = m.id AND it.suspenso_em IS NULL AND pr.status = 'ativa' AND pr.unidade_id = p_unidade), '[]'::jsonb),
                 'retorno', (SELECT jsonb_build_object('texto', r.texto, 'por', pr2.nome_completo, 'em', r.em)
                               FROM public.retornos_falta r LEFT JOIN public.perfis pr2 ON pr2.id = r.por
                              WHERE r.falta_id = f.id ORDER BY r.em DESC LIMIT 1)) x
          FROM public.faltas_medicamento f
          JOIN public.medicamento m ON m.id = f.medicamento_id
          LEFT JOIN public.perfis ps ON ps.id = f.sinalizada_por
         WHERE f.unidade_id = p_unidade AND f.situacao <> 'reposta') q), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.faltas_priorizadas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faltas_priorizadas(uuid) TO authenticated;

-- para a prescrição: o medicamento escolhido está em falta? e o retorno da farmácia
CREATE OR REPLACE FUNCTION public.falta_do_medicamento(p_unidade uuid, p_medicamento uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT jsonb_build_object('situacao', f.situacao, 'sinalizada_em', f.sinalizada_em,
            'retorno', (SELECT jsonb_build_object('texto', r.texto, 'por', p.nome_completo, 'em', r.em)
                          FROM public.retornos_falta r LEFT JOIN public.perfis p ON p.id = r.por
                         WHERE r.falta_id = f.id ORDER BY r.em DESC LIMIT 1))
            FROM public.faltas_medicamento f
           WHERE f.unidade_id = p_unidade AND f.medicamento_id = p_medicamento AND f.situacao <> 'reposta'
           LIMIT 1)
   WHERE private.segundo_fator_ok() AND private.membro_da_unidade(p_unidade);
$$;
REVOKE ALL ON FUNCTION public.falta_do_medicamento(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.falta_do_medicamento(uuid, uuid) TO authenticated;
