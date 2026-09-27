-- Fase 4.6 — checagem de enfermagem.
--
--  * A enfermagem apraza (horários do item) e checa cada administração:
--    feito, não feito ou recusado — os dois últimos com motivo (protótipo,
--    ESTADO.md: "checagem por horário (feito, não feito, recusado com motivo)").
--    O registro é só de inserção; corrigir é checar de novo (vale o último).
--  * Herdado da fase 3: "alta após medicação" na porta exige a medicação do
--    episódio checada como feita (itens que não são "se necessário").
--  * Herdado da fase 3.7: no Phoenix, com a prescrição estruturada em uso, o
--    número de vasoativos vem dos itens vasoativos ativos já administrados
--    (checados como feito); sem prescrição estruturada, vale o número
--    marcado à mão (conceito drogas-vasoativas).

ALTER TABLE public.prescricao_itens ADD COLUMN IF NOT EXISTS horarios text[];

CREATE TABLE IF NOT EXISTS public.administracoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          uuid NOT NULL REFERENCES public.prescricao_itens(id),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  horario_previsto text,
  situacao         text NOT NULL CHECK (situacao IN ('feito', 'nao_feito', 'recusado')),
  motivo           text,
  registrado_por   uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS administracoes_item ON public.administracoes (item_id, registrado_em DESC);
DROP TRIGGER IF EXISTS trg_administracoes_so_insercao ON public.administracoes;
CREATE TRIGGER trg_administracoes_so_insercao BEFORE UPDATE OR DELETE ON public.administracoes
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.administracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS administracoes_select ON public.administracoes;
CREATE POLICY administracoes_select ON public.administracoes FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS administracoes_segundo_fator ON public.administracoes;
CREATE POLICY administracoes_segundo_fator ON public.administracoes AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.administracoes FROM anon, authenticated;
GRANT SELECT ON public.administracoes TO authenticated;

CREATE OR REPLACE FUNCTION private.sou_enfermagem(p_unidade uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE OR private.tenho_papel(p_unidade, 'tecnico_enfermagem') IS TRUE
$$;

-- aprazar: o enfermeiro define os horários ("08:00", "14:00"…)
CREATE OR REPLACE FUNCTION public.aprazar(p_item uuid, p_horarios text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; h text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF private.tenho_papel(pr.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'O aprazamento é do enfermeiro de plantão no setor do paciente.';
  END IF;
  FOREACH h IN ARRAY coalesce(p_horarios, '{}') LOOP
    IF h !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido: % (use HH:MM).', h; END IF;
  END LOOP;
  UPDATE public.prescricao_itens SET horarios = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_horarios) x) WHERE id = it.id;
END $$;

CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item suspenso: não se checa.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'A checagem é da enfermagem de plantão no setor do paciente.';
  END IF;
  IF p_situacao NOT IN ('feito', 'nao_feito', 'recusado') THEN RAISE EXCEPTION 'Situação desconhecida.'; END IF;
  IF p_situacao <> 'feito' AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Diga o motivo (não feito ou recusado).';
  END IF;
  IF p_horario IS NOT NULL AND p_horario !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido (use HH:MM).'; END IF;
  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- a fila da enfermagem: itens ativos dos pacientes do meu plantão
CREATE OR REPLACE FUNCTION public.fila_checagem()
RETURNS TABLE (paciente_id uuid, paciente_nome text, local text, item_id uuid, tipo text, descricao text, dose text, via text,
               posologia text, se_necessario boolean, horarios text[], diluicao_texto text, vasoativo boolean,
               ultima_situacao text, ultima_em timestamptz, ultima_por text, ultima_horario text, prescrito_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pa.id, coalesce(pa.nome_social, pa.nome),
         coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
                    WHERE i.id = pr.internacao_id), (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
         it.id, it.tipo, it.descricao, it.dose, it.via, it.posologia, it.se_necessario, it.horarios, it.diluicao_texto,
         coalesce(m.vasoativo, false), ad.situacao, ad.registrado_em, pf.nome_completo, ad.horario_previsto, it.created_at
  FROM public.prescricoes pr
  JOIN public.pacientes pa ON pa.id = pr.paciente_id
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id AND it.suspenso_em IS NULL
  LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
  LEFT JOIN LATERAL (SELECT a.* FROM public.administracoes a WHERE a.item_id = it.id ORDER BY a.registrado_em DESC LIMIT 1) ad ON true
  LEFT JOIN public.perfis pf ON pf.id = ad.registrado_por
  WHERE pr.status = 'ativa' AND private.segundo_fator_ok()
    AND private.sou_enfermagem(pr.unidade_id) AND private.paciente_no_meu_plantao(pa.id)
  ORDER BY 2, it.ordem
$$;

REVOKE ALL ON FUNCTION public.aprazar(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checar(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fila_checagem() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprazar(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checar(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fila_checagem() TO authenticated;

-- ── "alta após medicação" exige a medicação administrada ────────────────────
CREATE OR REPLACE FUNCTION private.medicacao_sem_checagem(p_episodio uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(it.descricao ORDER BY it.ordem), '{}')
  FROM public.prescricoes pr
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
  WHERE pr.episodio_id = p_episodio AND pr.internacao_id IS NULL
    AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL AND NOT it.se_necessario
    AND NOT EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito')
$$;

CREATE OR REPLACE FUNCTION private.desfecho_confere_medicacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE falta text[];
BEGIN
  IF NEW.desfecho = 'alta_apos_medicacao' AND OLD.desfecho IS DISTINCT FROM NEW.desfecho THEN
    IF NOT EXISTS (SELECT 1 FROM public.prescricoes pr JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
                    WHERE pr.episodio_id = NEW.id AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL) THEN
      RAISE EXCEPTION 'Alta após medicação: não há medicação prescrita neste atendimento.';
    END IF;
    falta := private.medicacao_sem_checagem(NEW.id);
    IF cardinality(falta) > 0 THEN
      RAISE EXCEPTION 'Alta após medicação: falta a enfermagem checar como administrado: %.', array_to_string(falta, ', ');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_desfecho_confere_medicacao ON public.episodios;
CREATE TRIGGER trg_desfecho_confere_medicacao BEFORE UPDATE OF desfecho ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.desfecho_confere_medicacao();

-- vasoativos em uso segundo a prescrição (null = prescrição estruturada fora de uso)
CREATE OR REPLACE FUNCTION private.vasoativos_prescritos(p_paciente uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(it.id) = 0 THEN NULL
              ELSE count(DISTINCT it.medicamento_id) FILTER (WHERE m.vasoativo
                     AND EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = it.id AND a.situacao = 'feito'))::int END
  FROM public.prescricoes pr
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id AND it.suspenso_em IS NULL AND it.tipo = 'medicamento'
  LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
  WHERE pr.paciente_id = p_paciente AND pr.status = 'ativa'
$$;

-- ── Phoenix: vasoativos da prescrição checada (cópia da 3.7 com esse bloco) ──
CREATE OR REPLACE FUNCTION private.calcular_phoenix(p_paciente uuid, p_meses int, p_gatilho jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v jsonb := private.ultimos_valores(p_paciente, ARRAY['po2', 'fio2', 'saturacao-o2', 'suporte-respiratorio',
    'drogas-vasoativas', 'lactato', 'pressao-arterial-media', 'pressao-arterial-sistolica', 'pressao-arterial-diastolica',
    'plaquetas', 'inr', 'd-dimero', 'fibrinogenio', 'glasgow', 'pupilas']);
  itens jsonb := '[]'::jsonb;
  faltando text[] := '{}';
  num numeric; pf numeric; sf numeric; pam numeric; pam_origem text;
  suporte text := v -> 'suporte-respiratorio' ->> 'c';
  fio2 numeric := (v -> 'fio2' ->> 'n')::numeric;
  resp int := 0; cv int := 0; coag int := 0; neuro int := 0; pt int;
  g int; lim_baixo numeric; lim_alto numeric; vaso_presc int;
BEGIN
  -- Respiratório (0-3)
  IF (v -> 'po2' ->> 'n') IS NOT NULL AND fio2 > 0 THEN pf := (v -> 'po2' ->> 'n')::numeric / (fio2 / 100); END IF;
  IF (v -> 'saturacao-o2' ->> 'n')::numeric <= 97 AND fio2 > 0 THEN sf := (v -> 'saturacao-o2' ->> 'n')::numeric / (fio2 / 100); END IF;
  IF suporte IS NULL THEN
    faltando := faltando || 'Suporte respiratório'::text;
  ELSIF suporte = 'vmi' THEN
    resp := CASE WHEN pf < 100 OR sf < 148 THEN 3
                 WHEN pf <= 200 OR sf <= 220 THEN 2
                 WHEN pf < 400 OR sf < 292 THEN 1 ELSE 0 END;
  ELSIF suporte <> 'nenhum' THEN
    resp := CASE WHEN pf < 400 OR sf < 292 THEN 1 ELSE 0 END;
  END IF;
  IF suporte IS NOT NULL AND suporte <> 'nenhum' AND pf IS NULL AND sf IS NULL THEN
    faltando := faltando || 'PaO₂/FiO₂ ou SpO₂/FiO₂ (FiO₂ e PaO₂, ou SpO₂ ≤ 97%)'::text;
  END IF;
  itens := itens || jsonb_build_object('sistema', 'Respiratório', 'pontos', resp, 'maximo', 3,
    'detalhe', concat_ws(' · ', v -> 'suporte-respiratorio' ->> 'r',
      CASE WHEN pf IS NOT NULL THEN 'P/F ' || round(pf) END, CASE WHEN sf IS NOT NULL THEN 'S/F ' || round(sf) END));

  -- Cardiovascular (0-6): vasoativos, lactato, PAM por idade
  -- com a prescrição estruturada em uso, vale a prescrição checada (4.6)
  vaso_presc := private.vasoativos_prescritos(p_paciente);
  IF vaso_presc IS NOT NULL THEN
    num := vaso_presc;
    cv := cv + CASE WHEN num >= 2 THEN 2 WHEN num >= 1 THEN 1 ELSE 0 END;
  ELSIF (v -> 'drogas-vasoativas' ->> 'n') IS NULL THEN faltando := faltando || 'Drogas vasoativas (número)'::text;
  ELSE
    num := (v -> 'drogas-vasoativas' ->> 'n')::numeric;
    cv := cv + CASE WHEN num >= 2 THEN 2 WHEN num >= 1 THEN 1 ELSE 0 END;
  END IF;
  IF (v -> 'lactato' ->> 'n') IS NULL THEN faltando := faltando || 'Lactato'::text;
  ELSE
    num := (v -> 'lactato' ->> 'n')::numeric;
    cv := cv + CASE WHEN num >= 11 THEN 2 WHEN num >= 5 THEN 1 ELSE 0 END;
  END IF;
  IF (v -> 'pressao-arterial-media' ->> 'n') IS NOT NULL THEN
    pam := (v -> 'pressao-arterial-media' ->> 'n')::numeric; pam_origem := 'PAM medida';
  ELSIF (v -> 'pressao-arterial-sistolica' ->> 'n') IS NOT NULL AND (v -> 'pressao-arterial-diastolica' ->> 'n') IS NOT NULL THEN
    pam := (v -> 'pressao-arterial-sistolica' ->> 'n')::numeric / 3 + 2 * (v -> 'pressao-arterial-diastolica' ->> 'n')::numeric / 3;
    pam_origem := 'PAM calculada';
  END IF;
  IF pam IS NULL THEN faltando := faltando || 'PAM (ou PAS e PAD)'::text;
  ELSE
    g := CASE WHEN p_meses < 1 THEN 0 WHEN p_meses < 12 THEN 1 WHEN p_meses < 24 THEN 2
              WHEN p_meses < 60 THEN 3 WHEN p_meses < 144 THEN 4 ELSE 5 END;
    lim_baixo := (ARRAY[17, 25, 31, 32, 36, 38])[g + 1];
    lim_alto := (ARRAY[30, 38, 43, 44, 48, 51])[g + 1];
    cv := cv + CASE WHEN pam < lim_baixo THEN 2 WHEN pam <= lim_alto THEN 1 ELSE 0 END;
  END IF;
  itens := itens || jsonb_build_object('sistema', 'Cardiovascular', 'pontos', cv, 'maximo', 6,
    'detalhe', concat_ws(' · ',
      CASE WHEN vaso_presc IS NOT NULL THEN vaso_presc || ' vasoativa(s) na prescrição checada'
           WHEN (v -> 'drogas-vasoativas' ->> 'n') IS NOT NULL THEN (v -> 'drogas-vasoativas' ->> 'n') || ' vasoativa(s)' END,
      CASE WHEN (v -> 'lactato' ->> 'n') IS NOT NULL THEN 'lactato ' || (v -> 'lactato' ->> 'n') END,
      CASE WHEN pam IS NOT NULL THEN pam_origem || ' ' || round(pam, 1) END));

  -- Coagulação (0-2): 1 ponto cada, máximo 2
  pt := 0;
  IF (v -> 'plaquetas' ->> 'n') IS NULL THEN faltando := faltando || 'Plaquetas'::text;
  ELSIF (v -> 'plaquetas' ->> 'n')::numeric < 100000 THEN pt := pt + 1; END IF;   -- 100 × 10³/μL = 100.000/mm³
  IF (v -> 'inr' ->> 'n') IS NULL THEN faltando := faltando || 'INR'::text;
  ELSIF (v -> 'inr' ->> 'n')::numeric > 1.3 THEN pt := pt + 1; END IF;
  IF (v -> 'd-dimero' ->> 'n') IS NULL THEN faltando := faltando || 'D-dímero (mg/L FEU)'::text;
  ELSIF (v -> 'd-dimero' ->> 'n')::numeric > 2 THEN pt := pt + 1; END IF;
  IF (v -> 'fibrinogenio' ->> 'n') IS NULL THEN faltando := faltando || 'Fibrinogênio'::text;
  ELSIF (v -> 'fibrinogenio' ->> 'n')::numeric < 100 THEN pt := pt + 1; END IF;
  coag := least(pt, 2);
  itens := itens || jsonb_build_object('sistema', 'Coagulação', 'pontos', coag, 'maximo', 2,
    'detalhe', concat_ws(' · ',
      CASE WHEN (v -> 'plaquetas' ->> 'n') IS NOT NULL THEN 'plaquetas ' || (v -> 'plaquetas' ->> 'n') END,
      CASE WHEN (v -> 'inr' ->> 'n') IS NOT NULL THEN 'INR ' || (v -> 'inr' ->> 'n') END,
      CASE WHEN (v -> 'd-dimero' ->> 'n') IS NOT NULL THEN 'D-dímero ' || (v -> 'd-dimero' ->> 'n') END,
      CASE WHEN (v -> 'fibrinogenio' ->> 'n') IS NOT NULL THEN 'fibrinogênio ' || (v -> 'fibrinogenio' ->> 'n') END));

  -- Neurológico (0-2): pupilas fixas bilateralmente = 2; Glasgow ≤ 10 = 1
  IF (v -> 'glasgow' ->> 'n') IS NULL THEN faltando := faltando || 'Glasgow'::text; END IF;
  IF (v -> 'pupilas' ->> 'c') IS NULL THEN faltando := faltando || 'Pupilas'::text; END IF;
  neuro := CASE WHEN v -> 'pupilas' ->> 'c' = 'fixas' THEN 2
                WHEN (v -> 'glasgow' ->> 'n')::numeric <= 10 THEN 1 ELSE 0 END;
  itens := itens || jsonb_build_object('sistema', 'Neurológico', 'pontos', neuro, 'maximo', 2,
    'detalhe', concat_ws(' · ',
      CASE WHEN (v -> 'glasgow' ->> 'n') IS NOT NULL THEN 'Glasgow ' || (v -> 'glasgow' ->> 'n') END,
      v -> 'pupilas' ->> 'r'));

  RETURN jsonb_build_object(
    'total', resp + cv + coag + neuro,
    'cardiovascular', cv,
    'sepse', resp + cv + coag + neuro >= 2,
    'choque', resp + cv + coag + neuro >= 2 AND cv >= 1,
    'itens', itens,
    'faltando', to_jsonb(faltando),
    'parcial', cardinality(faltando) > 0,
    'gatilho', p_gatilho,
    'fonte', 'Phoenix Sepsis Score: Schlapbach et al., JAMA 2024;331(8):665-674 (Table); Sanchez-Pinto et al., JAMA 2024;331(8):675-686. Sepse = infecção suspeita ou confirmada com escore ≥ 2; choque séptico = sepse com ≥ 1 ponto cardiovascular.',
    'notas', 'Último valor de cada variável nas últimas 24 h; variável não medida não soma ponto. Não se aplica à internação do nascimento nem a idade pós-concepcional < 37 semanas. Diagnóstico e conduta são da equipe.');
END $$;

REVOKE ALL ON FUNCTION private.medicacao_sem_checagem(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.vasoativos_prescritos(uuid) FROM PUBLIC, anon, authenticated;
