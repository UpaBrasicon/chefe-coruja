-- Fase 5B, tarefa 3, etapa 3.3: a conta lê a dispensação e confere com a
-- administração. Decisões do RT em 16–17/10/2026 (tarefa 3 e "1a 2a 3a"):
--
--  - A fonte do medicamento na conta é a dispensação da farmácia (unidades de
--    consumo, menos o que voltou); a administração checada (vezes "feito")
--    aparece ao lado, como conferência. Sem valor (só consumo).
--  1a. Aviso só nos casos claros: dispensado e nunca administrado; administrado
--      sem nada dispensado. Sem conta de unidades × vezes.
--  2a. Diferença não trava o fechamento (a trava é da tarefa 5).
--  3a. O faturamento marca um medicamento "fora da conta" com motivo e pode
--      trazê-lo de volta, também com motivo, enquanto a conta não fecha.
--  A lista congela no fechamento, como os procedimentos.
--
-- Que medicamentos entram em cada conta: os itens das prescrições do mesmo
-- atendimento (episódio da porta e internação que saiu dele), separados pelo
-- momento da internação: antes de internado (porta e observação) vai na conta
-- da porta; depois, na conta da internação.

ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS medicamentos_congelados jsonb;

CREATE TABLE public.conta_medicamentos_fora (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id     uuid NOT NULL REFERENCES public.contas(id),
  item_id      uuid NOT NULL REFERENCES public.prescricao_itens(id),
  motivo       text NOT NULL,
  por          uuid NOT NULL REFERENCES public.perfis(id),
  em           timestamptz NOT NULL DEFAULT now(),
  voltou_em    timestamptz,
  voltou_por   uuid REFERENCES public.perfis(id),
  motivo_volta text
);
CREATE UNIQUE INDEX conta_medicamentos_fora_ativo ON public.conta_medicamentos_fora (conta_id, item_id) WHERE voltou_em IS NULL;
ALTER TABLE public.conta_medicamentos_fora ENABLE ROW LEVEL SECURITY;
CREATE POLICY conta_medicamentos_fora_leitura ON public.conta_medicamentos_fora FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contas c WHERE c.id = conta_id AND private.pode_ver_contas(c.unidade_id)));
REVOKE ALL ON public.conta_medicamentos_fora FROM anon, authenticated;
GRANT SELECT ON public.conta_medicamentos_fora TO authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_medicamentos_fora FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- janela e prescrições de cada conta
CREATE OR REPLACE FUNCTION private.conta_medicamentos(c public.contas)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ep uuid; v_ints uuid[]; v_de timestamptz; v_ate timestamptz;
BEGIN
  IF c.tipo = 'ambulatorial' THEN
    v_ep := c.episodio_id;
    SELECT array_agg(i.id), min(i.internado_em) INTO v_ints, v_ate FROM public.internacoes i WHERE i.episodio_id = v_ep;
    v_de := '-infinity';
    v_ate := coalesce(v_ate, 'infinity');
  ELSE
    SELECT i.episodio_id, i.internado_em INTO v_ep, v_de FROM public.internacoes i WHERE i.id = c.internacao_id;
    v_ints := ARRAY[c.internacao_id];
    v_de := coalesce(v_de, '-infinity');
    v_ate := 'infinity';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x ->> 'medicamento') FROM (
      SELECT jsonb_build_object(
        'item_id', it.id,
        'medicamento', m.principio_ativo || coalesce(' ' || m.apresentacao, ''),
        'unidade_consumo', coalesce(m.unidade_consumo_outra, m.unidade_consumo),
        'prescricao', concat_ws(' · ', it.dose, it.via, it.posologia),
        'dispensado', disp.dispensado, 'devolvido', disp.devolvido, 'liquido', disp.dispensado - disp.devolvido,
        'sem_farmaceutico', disp.sem_farmaceutico,
        'administrado', adm.feitas,
        'aviso', CASE
          WHEN disp.dispensado - disp.devolvido > 0 AND adm.feitas = 0 THEN 'Dispensado e nunca administrado.'
          WHEN adm.feitas > 0 AND disp.dispensado = 0 THEN 'Administrado sem nada dispensado pela farmácia.' END,
        'fora_da_conta', fora.id IS NOT NULL,
        'fora_motivo', fora.motivo,
        'fora_por', (SELECT nome_completo FROM public.perfis WHERE id = fora.por)) AS x
        FROM public.prescricao_itens it
        JOIN public.prescricoes pr ON pr.id = it.prescricao_id
        JOIN public.medicamento m ON m.id = it.medicamento_id
        CROSS JOIN LATERAL (
          SELECT coalesce(sum(d.quantidade), 0)::int AS dispensado,
                 coalesce(sum((SELECT sum(v.quantidade) FROM public.dispensacao_devolucoes v WHERE v.dispensacao_id = d.id)), 0)::int AS devolvido,
                 coalesce(bool_or(d.sem_farmaceutico), false) AS sem_farmaceutico
            FROM public.dispensacoes d WHERE d.item_id = it.id AND d.dispensada_em >= v_de AND d.dispensada_em < v_ate) disp
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS feitas FROM public.administracoes a
           WHERE a.item_id = it.id AND a.situacao = 'feito' AND a.registrado_em >= v_de AND a.registrado_em < v_ate) adm
        LEFT JOIN public.conta_medicamentos_fora fora ON fora.conta_id = c.id AND fora.item_id = it.id AND fora.voltou_em IS NULL
       WHERE it.tipo = 'medicamento' AND pr.paciente_id = c.paciente_id
         AND (pr.episodio_id = v_ep OR pr.internacao_id = ANY (coalesce(v_ints, '{}')))
         AND (disp.dispensado > 0 OR adm.feitas > 0)) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION private.conta_medicamentos(public.contas) FROM PUBLIC, anon, authenticated;

-- congela no fechamento junto com os procedimentos (trecho da função da tarefa 2)
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('public.mudar_etapa_conta(uuid, text, text)'::regprocedure), E'\r', '');
  antigo := '         congelada_em = CASE WHEN p_para = ''fechada'' THEN now() WHEN p_para = ''aberta'' THEN NULL ELSE congelada_em END';
  novo := '         medicamentos_congelados = CASE WHEN p_para = ''fechada'' THEN private.conta_medicamentos(c) WHEN p_para = ''aberta'' THEN NULL ELSE medicamentos_congelados END,' || E'\n' || antigo;
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'mudar_etapa_conta mudou: trecho do congelamento não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- detalhe com os medicamentos (substitui a versão da tarefa 2, acrescentando-os)
CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_itens jsonb; v_meds jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_itens := coalesce(c.itens_congelados, private.conta_itens(c));
  v_meds := coalesce(c.medicamentos_congelados, private.conta_medicamentos(c));
  RETURN private.conta_json(c) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', ev.evento, 'de', ev.de, 'para', ev.para, 'motivo', ev.motivo,
                               'por', (SELECT nome_completo FROM public.perfis WHERE id = ev.por), 'em', ev.em) ORDER BY ev.em)
                          FROM public.conta_eventos ev WHERE ev.conta_id = c.id), '[]'::jsonb),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento'),
    'pode_reabrir', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id),
    'itens', v_itens,
    'congelada_em', c.congelada_em,
    'total_referencia', (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(v_itens) x),
    'itens_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_itens) x WHERE jsonb_array_length(coalesce(x -> 'criticas', '[]'::jsonb)) > 0),
    'medicamentos', v_meds,
    'medicamentos_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_meds) x WHERE x ->> 'aviso' IS NOT NULL AND NOT (x ->> 'fora_da_conta')::boolean));
END $$;

-- 3a. fora da conta / de volta, com motivo
CREATE OR REPLACE FUNCTION public.medicamento_fora_da_conta(p_conta uuid, p_item uuid, p_fora boolean, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o ajuste da conta é do faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('aberta', 'em_conferencia') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de ajustar.'; END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(private.conta_medicamentos(c)) x WHERE (x ->> 'item_id')::uuid = p_item) THEN
    RAISE EXCEPTION 'Este medicamento não é desta conta.';
  END IF;
  IF p_fora THEN
    IF EXISTS (SELECT 1 FROM public.conta_medicamentos_fora WHERE conta_id = c.id AND item_id = p_item AND voltou_em IS NULL) THEN
      RAISE EXCEPTION 'Este medicamento já está fora da conta.';
    END IF;
    INSERT INTO public.conta_medicamentos_fora (conta_id, item_id, motivo, por) VALUES (c.id, p_item, v_motivo, v_eu);
  ELSE
    UPDATE public.conta_medicamentos_fora SET voltou_em = now(), voltou_por = v_eu, motivo_volta = v_motivo
     WHERE conta_id = c.id AND item_id = p_item AND voltou_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Este medicamento não está fora da conta.'; END IF;
  END IF;
  INSERT INTO public.conta_eventos (conta_id, evento, de, motivo, por)
  VALUES (c.id, CASE WHEN p_fora THEN 'medicamento_fora' ELSE 'medicamento_volta' END,
          (SELECT m.principio_ativo FROM public.prescricao_itens it JOIN public.medicamento m ON m.id = it.medicamento_id WHERE it.id = p_item),
          v_motivo, v_eu);
  PERFORM private.registrar_auditoria(CASE WHEN p_fora THEN 'conta_medicamento_fora' ELSE 'conta_medicamento_volta' END, 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'item', p_item, 'motivo', v_motivo));
  RETURN public.conta_detalhe(c.id);
END $$;
REVOKE ALL ON FUNCTION public.medicamento_fora_da_conta(uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicamento_fora_da_conta(uuid, uuid, boolean, text) TO authenticated;
