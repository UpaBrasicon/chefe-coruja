-- Ponto 15 do plantonista (docs/plantonista/PONTO-15-PARECER-TERMOS-ESCALAS.md;
-- o RT decidiu em 31/10/2026): Parecer, Termo de consentimento e Cuidados
-- paliativos em abas separadas; as escalas da enfermagem numa aba "Escalas".
--
-- 1. termos_modelos.categoria: 'consentimento' (o de antes) ou
--    'cuidados_paliativos'. A versão nova de um modelo herda a categoria da
--    anterior (gatilho); o gestor muda a categoria do modelo inteiro (todas as
--    versões) por public.definir_categoria_modelo_termo. O termo emitido
--    continua sendo termo_consentimento; a categoria vem do modelo usado.
-- 2. termos_consentimento_do_paciente devolve a categoria dos modelos e dos
--    termos (o resto igual).
-- 3. Pergunta surpresa no catálogo das avaliações (adulto): 0 = ficaria
--    surpreso, 1 = não ficaria (triagem positiva). Fonte: Downar J et al.
--    CMAJ 2017;189(13):E484-E493, PMID 28385893. É a única ferramenta
--    paliativa com o texto da fonte confirmado; PPS, PPI e PaP esperam a fonte
--    completa. registrar_avaliacao só ganha mensagens que citam a escala nova.
--
-- Expand: coluna com padrão, gatilho e função novos, valor novo no CHECK de
-- avaliacoes_escala, um caso novo no catálogo; as funções reescritas mantêm a
-- assinatura e o comportamento de antes.
-- Rollback (testado na homologação):
--   (termos_consentimento_do_paciente, private.escala_avaliacao e
--    registrar_avaliacao voltam às versões de antes)
--   (o CHECK de avaliacoes_escala volta sem 'pergunta_surpresa', se não houver nenhuma)
--   DROP FUNCTION IF EXISTS public.definir_categoria_modelo_termo(uuid, text);
--   DROP TRIGGER IF EXISTS trg_termos_modelos_categoria ON public.termos_modelos;
--   DROP FUNCTION IF EXISTS private.termos_modelos_categoria();
--   ALTER TABLE public.termos_modelos DROP COLUMN IF EXISTS categoria;

-- ── 1. categoria do modelo de termo ────────────────────────────────────────
ALTER TABLE public.termos_modelos ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'consentimento';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'termos_modelos_categoria_check') THEN
    ALTER TABLE public.termos_modelos ADD CONSTRAINT termos_modelos_categoria_check
      CHECK (categoria IN ('consentimento', 'cuidados_paliativos'));
  END IF;
END $$;
COMMENT ON COLUMN public.termos_modelos.categoria IS 'consentimento (TCLE) ou cuidados_paliativos (ponto 15 do plantonista). Vale para todas as versões do modelo.';

-- a versão nova herda a categoria das anteriores do mesmo modelo
CREATE OR REPLACE FUNCTION private.termos_modelos_categoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  SELECT m.categoria INTO NEW.categoria FROM public.termos_modelos m
   WHERE m.raiz_id = NEW.raiz_id AND m.id <> NEW.id ORDER BY m.versao DESC LIMIT 1;
  NEW.categoria := coalesce(NEW.categoria, 'consentimento');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.termos_modelos_categoria() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_termos_modelos_categoria ON public.termos_modelos;
CREATE TRIGGER trg_termos_modelos_categoria BEFORE INSERT ON public.termos_modelos
  FOR EACH ROW WHEN (NEW.raiz_id IS DISTINCT FROM NEW.id) EXECUTE FUNCTION private.termos_modelos_categoria();

CREATE OR REPLACE FUNCTION public.definir_categoria_modelo_termo(p_modelo uuid, p_categoria text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.termos_modelos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.termos_modelos WHERE id = p_modelo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(m.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado: os modelos de termo são do gestor da unidade.';
  END IF;
  IF p_categoria IS NULL OR p_categoria NOT IN ('consentimento', 'cuidados_paliativos') THEN
    RAISE EXCEPTION 'Categoria do modelo: consentimento ou cuidados paliativos.';
  END IF;
  IF m.categoria = p_categoria THEN RETURN; END IF;
  UPDATE public.termos_modelos SET categoria = p_categoria WHERE raiz_id = m.raiz_id;
  PERFORM private.registrar_auditoria('categoria_modelo_termo', 'termos_modelos', m.id, m.unidade_id,
    jsonb_build_object('titulo', m.titulo, 'categoria', p_categoria));
END $$;
REVOKE ALL ON FUNCTION public.definir_categoria_modelo_termo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_categoria_modelo_termo(uuid, text) TO authenticated;

-- ── 2. painel do termo com a categoria ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.termos_consentimento_do_paciente(p_paciente uuid, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  pc public.pacientes;
  v_perfil uuid := private.meu_perfil_id();
  v_epi uuid := p_episodio;
  v_idade int;
  v_filtra boolean := p_episodio IS NOT NULL OR p_internacao IS NOT NULL;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pc FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.pode_atuar_no_paciente(p_paciente) IS TRUE
          OR private.acesso_encerrado_vigente(p_paciente) IS TRUE
          OR private.teleinterconsulta_vigente(p_paciente) IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF private.prontuario_aberto(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Abra o prontuário do paciente para ver os termos.';
  END IF;
  IF v_epi IS NULL AND p_internacao IS NOT NULL THEN
    SELECT i.episodio_id INTO v_epi FROM public.internacoes i WHERE i.id = p_internacao AND i.paciente_id = p_paciente;
  END IF;
  IF pc.data_nascimento IS NOT NULL THEN
    v_idade := extract(year FROM age(private.data_atual(), pc.data_nascimento))::int;
  END IF;

  RETURN jsonb_build_object(
    'paciente', jsonb_build_object(
      'nome', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
      'idade_anos', v_idade,
      'menor_14', coalesce(v_idade < 14, false),
      -- quem assina o termo (decisão 2.1): representado < 16, assistido 16–17, capaz >= 18; null sem nascimento
      'faixa', CASE WHEN v_idade IS NULL THEN NULL WHEN v_idade < 16 THEN 'representado' WHEN v_idade < 18 THEN 'assistido' ELSE 'capaz' END,
      'responsavel', CASE WHEN nullif(btrim(pc.responsavel_nome), '') IS NOT NULL THEN jsonb_build_object(
        'nome', pc.responsavel_nome, 'vinculo', pc.responsavel_parentesco, 'documento', pc.responsavel_documento) END),
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = pc.unidade_id),
    'medico', (SELECT jsonb_build_object('id', f.id, 'nome', f.nome_completo, 'crm', f.crm, 'uf_crm', f.uf_crm)
                 FROM public.perfis f WHERE f.id = v_perfil),
    'pode_emitir', private.pode_atuar_no_paciente(p_paciente) IS TRUE AND private.tenho_papel(pc.unidade_id, 'plantonista'),
    'sou_gestor', private.eh_super_admin() OR private.tenho_papel(pc.unidade_id, 'gestor'),
    'declaracao_padrao', private.declaracao_padrao_termo(),
    'modelos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'procedimento', m.procedimento,
                                          'texto', m.texto, 'declaracao', m.declaracao, 'versao', m.versao,
                                          'categoria', m.categoria)
             ORDER BY lower(m.titulo))
        FROM public.termos_modelos m
       WHERE m.unidade_id = pc.unidade_id AND m.vigente AND m.ativo), '[]'::jsonb),
    'termos', coalesce((
      SELECT jsonb_agg(t ORDER BY t ->> 'emitido_em' DESC)
        FROM (
          SELECT jsonb_build_object(
                   'id', d.id, 'raiz_id', d.documento_raiz_id, 'versao', d.versao, 'numero', d.numero,
                   'estado', d.estado, 'emitido_em', coalesce(d.emitido_em, d.created_at),
                   'primeira_emissao_em', (SELECT coalesce(p.emitido_em, p.created_at) FROM public.documentos_clinicos p
                                            WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor_id', d.autor_id,
                   'autor_original_id', (SELECT p.autor_id FROM public.documentos_clinicos p
                                          WHERE p.documento_raiz_id = d.documento_raiz_id ORDER BY p.versao LIMIT 1),
                   'autor', a.nome_completo, 'crm', a.crm, 'uf_crm', a.uf_crm,
                   'motivo_retificacao', d.motivo_retificacao,
                   'conteudo', CASE WHEN d.conteudo ~ '^\s*\{' THEN (d.conteudo::jsonb -> 'termo') END,
                   -- ponto 15: a categoria do modelo usado (sem modelo, consentimento)
                   'categoria', coalesce((SELECT tm.categoria FROM public.termos_modelos tm
                                           WHERE d.conteudo ~ '^\s*\{' AND tm.id::text = (d.conteudo::jsonb #>> '{termo,modelo,id}')), 'consentimento'),
                   'cancelamento', (SELECT jsonb_build_object('motivo', c.motivo, 'em', c.cancelado_em,
                                                              'por', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = c.cancelado_por))
                                      FROM public.termos_cancelamentos c WHERE c.documento_id = d.id),
                   'versoes', (SELECT jsonb_agg(jsonb_build_object('id', v.id, 'versao', v.versao, 'numero', v.numero,
                                                'estado', v.estado, 'emitido_em', coalesce(v.emitido_em, v.created_at),
                                                'motivo_retificacao', v.motivo_retificacao,
                                                'autor', (SELECT f.nome_completo FROM public.perfis f WHERE f.id = v.autor_id))
                                               ORDER BY v.versao)
                                 FROM public.documentos_clinicos v WHERE v.documento_raiz_id = d.documento_raiz_id)) t
            FROM public.documentos_clinicos d
            LEFT JOIN public.perfis a ON a.id = d.autor_id
           WHERE d.paciente_id = p_paciente
             AND d.tipo_documento = 'termo_consentimento'
             AND d.estado IN ('ativo', 'cancelado')  -- a versão em vigor (ou a cancelada) de cada termo
             AND (NOT v_filtra
                  OR (v_epi IS NOT NULL AND d.episodio_id = v_epi)
                  OR (p_internacao IS NOT NULL AND d.internacao_id = p_internacao))
        ) s), '[]'::jsonb));
END $$;

-- ── 3. pergunta surpresa (adulto) ──────────────────────────────────────────
ALTER TABLE public.avaliacoes_escala DROP CONSTRAINT IF EXISTS avaliacoes_escala_escala_check;
ALTER TABLE public.avaliacoes_escala ADD CONSTRAINT avaliacoes_escala_escala_check
  CHECK (escala = ANY (ARRAY['nips', 'flacc', 'braden', 'morse', 'pergunta_surpresa'])) NOT VALID;
ALTER TABLE public.avaliacoes_escala VALIDATE CONSTRAINT avaliacoes_escala_escala_check;

CREATE OR REPLACE FUNCTION private.escala_avaliacao(p_escala text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_escala
    WHEN 'nips' THEN '{"publico":"pediatrico","versao":"2026-09-29.1",
      "itens":{"face":[0,1],"choro":[0,1,2],"resp":[0,1],"bracos":[0,1],"pernas":[0,1],"alerta":[0,1]},
      "faixas":[[0,"Sem dor pela NIPS (0 a 3)"],[4,"Dor (4 ou mais)"]]}'::jsonb
    WHEN 'flacc' THEN '{"publico":"pediatrico","versao":"2026-09-29.1",
      "itens":{"face":[0,1,2],"pernas":[0,1,2],"atividade":[0,1,2],"choro":[0,1,2],"consolo":[0,1,2]},
      "faixas":[[0,"Relaxado e confortável (0)"],[1,"Desconforto leve (1 a 3)"],[4,"Dor moderada (4 a 6)"],[7,"Dor intensa (7 a 10)"]]}'::jsonb
    WHEN 'braden' THEN '{"publico":"adulto","versao":"2026-09-29.1",
      "itens":{"percepcao":[1,2,3,4],"umidade":[1,2,3,4],"atividade":[1,2,3,4],"mobilidade":[1,2,3,4],"nutricao":[1,2,3,4],"friccao":[1,2,3]},
      "faixas":[[0,"Risco muito alto (9 ou menos)"],[10,"Risco alto (10 a 12)"],[13,"Risco moderado (13 a 14)"],[15,"Risco baixo (15 a 18)"],[19,"Sem risco (19 a 23)"]]}'::jsonb
    WHEN 'morse' THEN '{"publico":"adulto","versao":"2026-09-29.1",
      "itens":{"quedas":[0,25],"diagnostico":[0,15],"auxilio":[0,15,30],"terapia_ev":[0,20],"marcha":[0,10,20],"estado_mental":[0,15]},
      "faixas":[[0,"Risco baixo (0 a 24)"],[25,"Risco moderado (25 a 44)"],[45,"Risco alto (45 ou mais)"]]}'::jsonb
    WHEN 'pergunta_surpresa' THEN '{"publico":"adulto","versao":"2026-10-31.1",
      "itens":{"surpreso":[0,1]},
      "faixas":[[0,"Negativa (ficaria surpreso)"],[1,"Positiva: avaliar as necessidades de cuidado paliativo"]]}'::jsonb
  END
$$;

CREATE OR REPLACE FUNCTION public.registrar_avaliacao(p_paciente uuid, p_escala text, p_respostas jsonb, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d jsonb := private.escala_avaliacao(p_escala); pa public.pacientes; k text; v jsonb;
  v_total int := 0; v_interp text; f jsonb; v_ped boolean; v_ep uuid; v_int uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF d IS NULL THEN RAISE EXCEPTION 'Escala desconhecida: use NIPS, FLACC, Braden, Morse ou a pergunta surpresa.'; END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  v_ped := CASE WHEN pa.data_nascimento IS NULL THEN NULL
                ELSE age(private.data_atual(), pa.data_nascimento) < interval '14 years' END;
  IF d ->> 'publico' = 'pediatrico' AND v_ped IS NOT TRUE THEN
    RAISE EXCEPTION 'NIPS e FLACC são escalas da pediatria (até 13 anos, 11 meses e 29 dias, com a data de nascimento no cadastro).';
  END IF;
  IF d ->> 'publico' = 'adulto' AND v_ped IS TRUE THEN
    RAISE EXCEPTION '%', CASE WHEN p_escala = 'pergunta_surpresa'
      THEN 'A pergunta surpresa é do adulto: na criança não se usa (nada se converte do adulto).'
      ELSE 'Braden e Morse são escalas do adulto: na criança não se usam (nada se converte do adulto).' END;
  END IF;
  -- a pergunta surpresa só vale com a idade conhecida (a fonte é de adultos)
  IF p_escala = 'pergunta_surpresa' AND v_ped IS NULL THEN
    RAISE EXCEPTION 'A pergunta surpresa é do adulto: registre a data de nascimento no cadastro.';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda todas as perguntas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'itens' ? k) THEN RAISE EXCEPTION 'Pergunta que não é da escala: %.', k; END IF;
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(d -> 'itens') LOOP
    IF NOT (p_respostas ? k) THEN RAISE EXCEPTION 'Responda todas as perguntas (falta %).', k; END IF;
    IF jsonb_typeof(p_respostas -> k) <> 'number' OR NOT (v @> jsonb_build_array(p_respostas -> k)) THEN
      RAISE EXCEPTION 'Resposta fora das opções em %.', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_interp := f ->> 1; END IF;
  END LOOP;
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, false) a;
  INSERT INTO public.avaliacoes_escala (unidade_id, paciente_id, episodio_id, internacao_id, escala, versao, respostas, total, interpretacao, registrado_por)
  VALUES (pa.unidade_id, p_paciente, v_ep, v_int, p_escala, d ->> 'versao', p_respostas, v_total, v_interp, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
