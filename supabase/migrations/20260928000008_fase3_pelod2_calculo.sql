-- Fase 3.7 (continuação) — cálculo do PELOD-2.
--
-- Fonte: Leteurtre S, Duhamel A, Salleron J, Grandbastien B, Lacroix J,
-- Leclerc F. PELOD-2: an update of the PEdiatric logistic organ dysfunction
-- score. Crit Care Med. 2013;41(7):1761-1773. Tabela 6 ("Scoring the
-- Pediatric Logistic Organ Dysfunction-2 Score"), p. 1769 — PDF enviado pelo
-- usuário em 27/09/2026, lido pela imagem da página (o OCR do arquivo erra
-- símbolos). Transcrição em produto/docs/pesquisa/escores-sepse-disfuncao-pediatrica.md.
--
-- Regras da fonte (notas a–d da Tabela 6), mantidas:
--  * variável não medida é considerada normal (0 ponto);
--  * medida mais de uma vez em 24 h → vale o PIOR valor (Glasgow: o menor);
--  * PaO2 só arterial; P/F é normal na cardiopatia cianogênica; ventilação
--    por máscara não é invasiva; Glasgow só em doença aguda do SNC conhecida
--    ou suspeita; pupila não reativa > 3 mm, não após dilatação iatrogênica
--    (a tela escreve essas condições: o sistema não sabe verificá-las);
--  * logit(mortalidade) = −6,61 + 0,47 × PELOD-2; P = 1/(1 + exp(−logit)).
-- Decisões do usuário (27/09/2026): valores comparados exatos, sem arredondar
-- (fora da faixa de cima → faixa de baixo); creatinina do laboratório em
-- mg/dL convertida para µmol/L pelo fator químico 88,4 só para comparar com
-- os cortes da tabela, que ficam em µmol/L. Leucócitos e plaquetas: o banco
-- guarda /mm³; ×10⁹/L = mil por mm³ (mesma grandeza, só a notação).
-- A PAM medida tem preferência; sem ela, PAM = 1/3 PAS + 2/3 PAD da mesma
-- aferição (identificada na tela como calculada).

CREATE OR REPLACE FUNCTION private.pior_valor(p_paciente uuid, p_nome text, p_maior boolean)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_maior THEN max(o.valor_num) ELSE min(o.valor_num) END
  FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = p_nome AND c.unidade_id IS NULL
  WHERE o.paciente_id = p_paciente AND o.aferido_em > now() - interval '24 hours' AND o.valor_num IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION private.calcular_pelod2(p_paciente uuid, p_meses int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g int := CASE WHEN p_meses < 1 THEN 0 WHEN p_meses < 12 THEN 1 WHEN p_meses < 24 THEN 2
                WHEN p_meses < 60 THEN 3 WHEN p_meses < 144 THEN 4 ELSE 5 END;
  itens jsonb := '[]'::jsonb; faltando text[] := '{}'; total int := 0; pt int;
  gcs numeric := private.pior_valor(p_paciente, 'glasgow', false);
  lact numeric := private.pior_valor(p_paciente, 'lactato', true);
  pam numeric := private.pior_valor(p_paciente, 'pressao-arterial-media', false);
  cr_mg numeric := private.pior_valor(p_paciente, 'creatinina', true);
  pco2 numeric := private.pior_valor(p_paciente, 'pco2', true);
  leuco numeric := private.pior_valor(p_paciente, 'leucocitos', false);
  plaq numeric := private.pior_valor(p_paciente, 'plaquetas', false);
  pupilas_fixas boolean; pupilas_medidas boolean; vmi boolean; suporte_medido boolean;
  pam_calc boolean := false; pf numeric; cr_umol numeric; logit numeric;
  janela timestamptz := now() - interval '24 hours';
BEGIN
  SELECT bool_or(op.valor = 'fixas'), count(*) > 0 INTO pupilas_fixas, pupilas_medidas
  FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'pupilas' AND c.unidade_id IS NULL
  JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
  WHERE o.paciente_id = p_paciente AND o.aferido_em > janela;
  SELECT bool_or(op.valor = 'vmi'), count(*) > 0 INTO vmi, suporte_medido
  FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'suporte-respiratorio' AND c.unidade_id IS NULL
  JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
  WHERE o.paciente_id = p_paciente AND o.aferido_em > janela;
  IF pam IS NULL THEN   -- sem PAM medida: a pior PAM calculada de PAS e PAD da mesma aferição
    SELECT min(s.valor_num / 3 + 2 * d.valor_num / 3) INTO pam
    FROM public.observacao s
    JOIN public.conceito cs ON cs.id = s.conceito_id AND cs.nome = 'pressao-arterial-sistolica' AND cs.unidade_id IS NULL
    JOIN public.observacao d ON d.paciente_id = s.paciente_id AND d.aferido_em = s.aferido_em
    JOIN public.conceito cd ON cd.id = d.conceito_id AND cd.nome = 'pressao-arterial-diastolica' AND cd.unidade_id IS NULL
    WHERE s.paciente_id = p_paciente AND s.aferido_em > janela;
    pam_calc := pam IS NOT NULL;
  END IF;
  -- pior P/F: cada PaO2 com a FiO2 registrada por último até aquela hora
  SELECT min(o.valor_num / (f.valor_num / 100)) INTO pf
  FROM public.observacao o
  JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'po2' AND c.unidade_id IS NULL
  CROSS JOIN LATERAL (
    SELECT fo.valor_num FROM public.observacao fo
    JOIN public.conceito fc ON fc.id = fo.conceito_id AND fc.nome = 'fio2' AND fc.unidade_id IS NULL
    WHERE fo.paciente_id = o.paciente_id AND fo.aferido_em <= o.aferido_em AND fo.aferido_em > janela AND fo.valor_num > 0
    ORDER BY fo.aferido_em DESC LIMIT 1) f
  WHERE o.paciente_id = p_paciente AND o.aferido_em > janela;
  cr_umol := cr_mg * 88.4;

  -- Neurológico
  IF gcs IS NULL THEN faltando := faltando || 'Glasgow'::text; END IF;
  pt := CASE WHEN gcs IS NULL OR gcs >= 11 THEN 0 WHEN gcs >= 5 THEN 1 ELSE 4 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Neurológico', 'rotulo', 'Glasgow (menor)', 'valor', gcs, 'pontos', pt);
  IF NOT coalesce(pupilas_medidas, false) THEN faltando := faltando || 'Pupilas'::text; END IF;
  pt := CASE WHEN pupilas_fixas THEN 5 ELSE 0 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Neurológico', 'rotulo', 'Reação pupilar',
    'valor', CASE WHEN pupilas_fixas THEN 'ambas fixas' WHEN pupilas_medidas THEN 'reativas' END, 'pontos', pt);
  -- Cardiovascular
  IF lact IS NULL THEN faltando := faltando || 'Lactato'::text; END IF;
  pt := CASE WHEN lact IS NULL OR lact < 5 THEN 0 WHEN lact < 11 THEN 1 ELSE 4 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Cardiovascular', 'rotulo', 'Lactato (maior, mmol/L)', 'valor', lact, 'pontos', pt);
  IF pam IS NULL THEN faltando := faltando || 'PAM (ou PAS e PAD)'::text; END IF;
  pt := CASE WHEN pam IS NULL OR pam >= (ARRAY[46, 55, 60, 62, 65, 67])[g + 1] THEN 0
             WHEN pam >= (ARRAY[31, 39, 44, 46, 49, 52])[g + 1] THEN 2
             WHEN pam >= (ARRAY[17, 25, 31, 32, 36, 38])[g + 1] THEN 3
             ELSE 6 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Cardiovascular',
    'rotulo', CASE WHEN pam_calc THEN 'PAM calculada (menor, mmHg)' ELSE 'PAM (menor, mmHg)' END, 'valor', round(pam, 1), 'pontos', pt);
  -- Renal
  IF cr_mg IS NULL THEN faltando := faltando || 'Creatinina'::text; END IF;
  pt := CASE WHEN cr_umol IS NOT NULL AND cr_umol >= (ARRAY[70, 23, 35, 51, 59, 93])[g + 1] THEN 2 ELSE 0 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Renal', 'rotulo', 'Creatinina (maior)',
    'valor', CASE WHEN cr_mg IS NOT NULL THEN cr_mg || ' mg/dL = ' || round(cr_umol) || ' µmol/L (×88,4)' END, 'pontos', pt);
  -- Respiratório
  IF pf IS NULL THEN faltando := faltando || 'PaO₂/FiO₂ (PaO₂ arterial e FiO₂)'::text; END IF;
  pt := CASE WHEN pf IS NOT NULL AND pf <= 60 THEN 2 ELSE 0 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Respiratório', 'rotulo', 'PaO₂/FiO₂ (menor)', 'valor', round(pf), 'pontos', pt);
  IF pco2 IS NULL THEN faltando := faltando || 'PaCO₂'::text; END IF;
  pt := CASE WHEN pco2 IS NULL OR pco2 < 59 THEN 0 WHEN pco2 < 95 THEN 1 ELSE 3 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Respiratório', 'rotulo', 'PaCO₂ (maior, mmHg)', 'valor', pco2, 'pontos', pt);
  IF NOT coalesce(suporte_medido, false) THEN faltando := faltando || 'Suporte respiratório'::text; END IF;
  pt := CASE WHEN vmi THEN 3 ELSE 0 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Respiratório', 'rotulo', 'Ventilação invasiva',
    'valor', CASE WHEN vmi THEN 'sim' WHEN suporte_medido THEN 'não' END, 'pontos', pt);
  -- Hematológico (×10⁹/L = mil por mm³)
  IF leuco IS NULL THEN faltando := faltando || 'Leucócitos'::text; END IF;
  pt := CASE WHEN leuco IS NOT NULL AND leuco / 1000 <= 2 THEN 2 ELSE 0 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Hematológico', 'rotulo', 'Leucócitos (menor, /mm³)', 'valor', leuco, 'pontos', pt);
  IF plaq IS NULL THEN faltando := faltando || 'Plaquetas'::text; END IF;
  pt := CASE WHEN plaq IS NULL OR plaq / 1000 >= 142 THEN 0 WHEN plaq / 1000 >= 77 THEN 1 ELSE 2 END;
  total := total + pt;
  itens := itens || jsonb_build_object('grupo', 'Hematológico', 'rotulo', 'Plaquetas (menor, /mm³)', 'valor', plaq, 'pontos', pt);

  logit := -6.61 + 0.47 * total;
  RETURN jsonb_build_object(
    'referencia_carregada', true,
    'total', total,
    'itens', itens,
    'faltando', to_jsonb(faltando),
    'completo', cardinality(faltando) = 0,
    'mortalidade_prevista', round(1 / (1 + exp(-logit)), 4),
    'fonte', 'PELOD-2: Leteurtre et al., Crit Care Med 2013;41(7):1761-1773, Tabela 6. Logit(mortalidade) = −6,61 + 0,47 × PELOD-2 (coorte de UTI pediátrica).',
    'notas', 'Pior valor de cada variável nas últimas 24 h; não medida = normal. PaO₂ só arterial; P/F é considerada normal na cardiopatia cianogênica; Glasgow só em doença aguda do SNC conhecida ou suspeita (se sedado, o estimado antes da sedação); pupila não reativa > 3 mm, não após dilatação iatrogênica. Creatinina convertida de mg/dL para µmol/L (×88,4) só para comparar. Validado em UTI pediátrica; o uso na enfermaria por PEWS alto é processo da unidade.');
END $$;

-- acuidade: o PELOD-2 passa a vir calculado
CREATE OR REPLACE FUNCTION public.acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_nasc date; v_meses int; r jsonb; g jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  r := private.calcular_acuidade(p_paciente);
  IF r ->> 'escala' = 'PEWS' THEN
    v_meses := (extract(year FROM age(current_date, v_nasc)) * 12 + extract(month FROM age(current_date, v_nasc)))::int;
    g := private.gatilho_infeccao(p_paciente);
    IF g IS NOT NULL THEN r := r || jsonb_build_object('phoenix', private.calcular_phoenix(p_paciente, v_meses, g)); END IF;
    r := r || jsonb_build_object('pelod2', private.calcular_pelod2(p_paciente, v_meses)
      || jsonb_build_object('indicado', (r ->> 'banda')::int = 2 OR EXISTS (
           SELECT 1 FROM public.pendencias pe WHERE pe.paciente_id = p_paciente AND pe.chave LIKE 'pelod2:%'
             AND pe.criada_em > now() - interval '24 hours')));
  END IF;
  RETURN r;
END $$;

-- A pendência do dia se resolve sozinha quando o PELOD-2 do dia fica completo.
CREATE OR REPLACE FUNCTION private.observacao_dispara_pelod2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_nasc date; v_meses int; p jsonb;
BEGIN
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = NEW.paciente_id;
  IF v_nasc IS NULL OR v_nasc <= current_date - interval '14 years' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.conceito c WHERE c.id = NEW.conceito_id AND c.categoria = 'sinal_vital') THEN
    PERFORM private.pelod2_do_dia(NEW.paciente_id);
  END IF;
  IF EXISTS (SELECT 1 FROM public.pendencias WHERE paciente_id = NEW.paciente_id AND chave LIKE 'pelod2:%' AND situacao = 'aberta') THEN
    v_meses := (extract(year FROM age(current_date, v_nasc)) * 12 + extract(month FROM age(current_date, v_nasc)))::int;
    p := private.calcular_pelod2(NEW.paciente_id, v_meses);
    IF (p ->> 'completo')::boolean THEN
      UPDATE public.pendencias
         SET situacao = 'concluida', resolvida_em = now(), resolvida_por = NULL,
             motivo_resolucao = 'PELOD-2 do dia completo: ' || (p ->> 'total') || ' pontos'
       WHERE paciente_id = NEW.paciente_id AND chave LIKE 'pelod2:%' AND situacao = 'aberta';
    END IF;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.calcular_pelod2(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pior_valor(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

INSERT INTO public.hermes_almanaque (pergunta, palavras, resposta) VALUES
('Como funciona o rastreio de sepse na pediatria?', 'sepse phoenix pelod pelod-2 choque séptico infecção criança pediatria suspeita',
 'Toda criança (antes dos 14 anos) tem PEWS. Com CID de infecção no episódio, ou com "suspeita de infecção" marcada pelo médico, o leito calcula o Phoenix Sepsis Score (JAMA 2024): 2 pontos ou mais indicam critérios de sepse; com ponto cardiovascular, de choque séptico. O painel mostra o alerta na linha do paciente. PEWS em banda alta abre a pendência diária "PELOD-2 do dia"; o PELOD-2 (Leteurtre 2013) é calculado com o pior valor de 24 h e a pendência se fecha sozinha quando as 10 variáveis do dia estão registradas. Diagnóstico e conduta são da equipe.')
ON CONFLICT (pergunta) DO UPDATE SET palavras = EXCLUDED.palavras, resposta = EXCLUDED.resposta, atualizado_em = now();
