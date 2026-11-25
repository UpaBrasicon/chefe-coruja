-- LG13 (decisões do RT de 17/11/2026, K1–K6 = A; docs/regulatorio/LG13-REGIMENTO-COMITE.md):
-- revisão das versões de ficha por profissão.
--   * médico revisa tudo; farmacêutico, a ficha com dose; enfermeiro, as fichas
--     de enfermagem e de classificação de risco (mapa do módulo clínico, LG11);
--   * a versão só fica 'aprovada' (e só vai ao ar pelo gate do LG10) quando
--     todas as revisões exigidas estão feitas;
--   * profissão sem revisor nomeado não segura a aprovação: a falta fica
--     registrada e a versão entra na fila retroativa quando alguém for nomeado;
--   * cada revisão fica em public.ferramenta_revisoes, só de inclusão.
--
-- Expand: só acrescenta (coluna com padrão, tabela nova, CHECK alargado e
-- funções). Nada é apagado nem renomeado.
--
-- Rollback (testado na homologação, dentro de transação):
--   DROP FUNCTION IF EXISTS public.revisar_versao_ferramenta(text, text, text, boolean, text);
--   DROP FUNCTION IF EXISTS public.fila_revisao_ferramentas(text);
--   DROP FUNCTION IF EXISTS private.fechar_versao_ferramenta(uuid);
--   recriar public.decidir_versao_ferramenta, public.fila_aprovacao_ferramentas,
--     public.situacao_ferramenta e public.nomear_responsavel_tecnico como na 20260930000001;
--   DROP FUNCTION IF EXISTS private.revisoes_pendentes(uuid, boolean);
--   DROP TABLE IF EXISTS public.ferramenta_revisoes;
--   ALTER TABLE public.ferramentas_clinicas DROP CONSTRAINT IF EXISTS ferramentas_clinicas_revisoes_check,
--     DROP COLUMN IF EXISTS revisoes_exigidas;
--   os CHECK de responsaveis_tecnicos só voltam ao antigo se não houver enfermeiro nomeado.

-- ------------------------------------------------ 1. enfermeiro (COREN)
ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_tipo_check;
ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_tipo_check
  CHECK (tipo IN ('medico', 'farmaceutico', 'enfermeiro'));
ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_conselho_check;
ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_conselho_check
  CHECK (conselho IN ('CRM', 'CRF', 'COREN'));
ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_check;
ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_check
  CHECK (conselho = CASE tipo WHEN 'medico' THEN 'CRM' WHEN 'farmaceutico' THEN 'CRF' ELSE 'COREN' END);

-- ------------------------------------------ 2. revisões exigidas por ficha
ALTER TABLE public.ferramentas_clinicas
  ADD COLUMN IF NOT EXISTS revisoes_exigidas text[] NOT NULL DEFAULT ARRAY['medico']::text[];
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ferramentas_clinicas_revisoes_check') THEN
    ALTER TABLE public.ferramentas_clinicas ADD CONSTRAINT ferramentas_clinicas_revisoes_check
      CHECK (revisoes_exigidas <@ ARRAY['medico', 'farmaceutico', 'enfermeiro']::text[]
             AND 'medico' = ANY (revisoes_exigidas));
  END IF;
END $$;

-- ------------------------------------------- 3. revisões (só de inclusão)
CREATE TABLE IF NOT EXISTS public.ferramenta_revisoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id   uuid NOT NULL REFERENCES public.ferramenta_versoes(id),
  tipo        text NOT NULL CHECK (tipo IN ('medico', 'farmaceutico', 'enfermeiro')),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id),
  registro    text NOT NULL,                 -- "CRF 1234/SP" no momento da revisão
  aprovada    boolean NOT NULL,
  nota        text,
  retroativa  boolean NOT NULL DEFAULT false, -- revisão de versão que já estava no ar (K4)
  em          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ferramenta_revisoes_versao_tipo_uq ON public.ferramenta_revisoes (versao_id, tipo);
CREATE INDEX IF NOT EXISTS ferramenta_revisoes_perfil_idx ON public.ferramenta_revisoes (perfil_id);

ALTER TABLE public.ferramenta_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ferramenta_revisoes FROM anon, authenticated;
GRANT SELECT ON public.ferramenta_revisoes TO authenticated;
DROP POLICY IF EXISTS ferramenta_revisoes_select ON public.ferramenta_revisoes;
CREATE POLICY ferramenta_revisoes_select ON public.ferramenta_revisoes FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS trg_ferramenta_revisoes_so_insercao ON public.ferramenta_revisoes;
CREATE TRIGGER trg_ferramenta_revisoes_so_insercao
  BEFORE UPDATE OR DELETE ON public.ferramenta_revisoes
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();

-- as decisões do médico já tomadas viram a revisão 'medico' de cada versão
INSERT INTO public.ferramenta_revisoes (versao_id, tipo, perfil_id, registro, aprovada, nota, em)
SELECT v.id, 'medico', v.decidida_por, coalesce(v.decisao_registro, ''), v.status <> 'reprovada', v.decisao_nota, v.decidida_em
  FROM public.ferramenta_versoes v
 WHERE v.decidida_por IS NOT NULL AND v.decidida_em IS NOT NULL
ON CONFLICT (versao_id, tipo) DO NOTHING;

-- ------------------------------------------------------- 4. helpers
-- Profissões que ainda faltam aprovar a versão. Com p_so_com_revisor, só as
-- que têm revisor nomeado (as que seguram a aprovação); sem, todas (as que a
-- tela mostra como pendentes).
CREATE OR REPLACE FUNCTION private.revisoes_pendentes(p_versao uuid, p_so_com_revisor boolean)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(e.tipo ORDER BY e.tipo), ARRAY[]::text[])
    FROM public.ferramenta_versoes v
    JOIN public.ferramentas_clinicas f ON f.id = v.ferramenta_id
    CROSS JOIN LATERAL unnest(f.revisoes_exigidas) AS e(tipo)
   WHERE v.id = p_versao
     AND NOT EXISTS (SELECT 1 FROM public.ferramenta_revisoes r
                      WHERE r.versao_id = v.id AND r.tipo = e.tipo AND r.aprovada)
     AND (NOT p_so_com_revisor OR e.tipo = 'medico'
          OR EXISTS (SELECT 1 FROM public.responsaveis_tecnicos rt WHERE rt.tipo = e.tipo AND rt.ativo))
$$;

-- Fecha a versão quando dá: uma reprovação reprova; sem pendência, aprova
-- (e a aprovada anterior vira substituída). Devolve o status.
CREATE OR REPLACE FUNCTION private.fechar_versao_ferramenta(p_versao uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v   public.ferramenta_versoes;
  rep public.ferramenta_revisoes;
  med public.ferramenta_revisoes;
BEGIN
  SELECT * INTO v FROM public.ferramenta_versoes WHERE id = p_versao FOR UPDATE;
  IF v.status <> 'aguardando_aprovacao' THEN RETURN v.status; END IF;
  SELECT * INTO rep FROM public.ferramenta_revisoes WHERE versao_id = p_versao AND NOT aprovada ORDER BY em LIMIT 1;
  IF rep.id IS NOT NULL THEN
    UPDATE public.ferramenta_versoes
       SET status = 'reprovada', decidida_por = rep.perfil_id, decidida_em = rep.em,
           decisao_registro = rep.registro, decisao_nota = rep.nota
     WHERE id = p_versao;
    RETURN 'reprovada';
  END IF;
  IF cardinality(private.revisoes_pendentes(p_versao, true)) > 0 THEN
    RETURN 'aguardando_aprovacao';
  END IF;
  SELECT * INTO med FROM public.ferramenta_revisoes WHERE versao_id = p_versao AND tipo = 'medico';
  UPDATE public.ferramenta_versoes SET status = 'substituida'
   WHERE ferramenta_id = v.ferramenta_id AND status = 'aprovada';
  UPDATE public.ferramenta_versoes
     SET status = 'aprovada', decidida_por = med.perfil_id, decidida_em = now(),
         decisao_registro = med.registro, decisao_nota = med.nota
   WHERE id = p_versao;
  RETURN 'aprovada';
END $$;

-- ------------------------------------------------- 5. decisão do médico
CREATE OR REPLACE FUNCTION public.decidir_versao_ferramenta(
  p_ferramenta text, p_versao text, p_aprovar boolean, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rt public.responsaveis_tecnicos;
  v  public.ferramenta_versoes;
  st text;
BEGIN
  rt := private.responsavel_tecnico('medico');
  IF rt.id IS NULL THEN
    RAISE EXCEPTION 'Só o responsável técnico médico nomeado decide a camada base' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.ferramenta_versoes WHERE ferramenta_id = p_ferramenta AND versao = p_versao FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Versão não registrada: % %', p_ferramenta, p_versao; END IF;
  IF v.status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Esta versão já foi decidida (%)', v.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ferramenta_revisoes WHERE versao_id = v.id AND tipo = 'medico') THEN
    RAISE EXCEPTION 'Esta versão já foi decidida pelo médico; falta a revisão de: %',
      array_to_string(private.revisoes_pendentes(v.id, true), ', ');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ferramenta_revisoes WHERE versao_id = v.id AND perfil_id = rt.perfil_id) THEN
    RAISE EXCEPTION 'Quem já revisou esta versão em outra profissão não revisa de novo';
  END IF;
  IF NOT p_aprovar AND length(coalesce(trim(p_nota), '')) < 10 THEN
    RAISE EXCEPTION 'Para reprovar, descreva a correção (10 caracteres ou mais)';
  END IF;
  INSERT INTO public.ferramenta_revisoes (versao_id, tipo, perfil_id, registro, aprovada, nota)
  VALUES (v.id, 'medico', rt.perfil_id, rt.conselho || ' ' || rt.registro || '/' || rt.uf, p_aprovar, nullif(trim(p_nota), ''));
  st := private.fechar_versao_ferramenta(v.id);
  PERFORM private.registrar_auditoria(CASE WHEN p_aprovar THEN 'aprovar_ferramenta' ELSE 'reprovar_ferramenta' END,
    'ferramenta_versoes', v.id, NULL, jsonb_build_object('ferramenta', p_ferramenta, 'versao', p_versao, 'status', st));
END $$;

-- ------------------------------------- 6. revisão do farmacêutico e do enfermeiro
CREATE OR REPLACE FUNCTION public.revisar_versao_ferramenta(
  p_ferramenta text, p_versao text, p_tipo text, p_aprovar boolean, p_nota text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rt    public.responsaveis_tecnicos;
  v     public.ferramenta_versoes;
  retro boolean;
  st    text;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('farmaceutico', 'enfermeiro') THEN
    RAISE EXCEPTION 'Profissão de revisão inválida: %', p_tipo;
  END IF;
  rt := private.responsavel_tecnico(p_tipo);
  IF rt.id IS NULL THEN
    RAISE EXCEPTION 'Só o revisor nomeado (%) revisa esta fila', p_tipo USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.ferramenta_versoes WHERE ferramenta_id = p_ferramenta AND versao = p_versao FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Versão não registrada: % %', p_ferramenta, p_versao; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ferramentas_clinicas f
                  WHERE f.id = p_ferramenta AND p_tipo = ANY (f.revisoes_exigidas)) THEN
    RAISE EXCEPTION 'Esta ficha não pede revisão de %', p_tipo;
  END IF;
  IF v.status NOT IN ('aguardando_aprovacao', 'aprovada') THEN
    RAISE EXCEPTION 'Versão fora de vigência (%)', v.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ferramenta_revisoes WHERE versao_id = v.id AND tipo = p_tipo) THEN
    RAISE EXCEPTION 'Esta versão já foi revisada (%)', p_tipo;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ferramenta_revisoes WHERE versao_id = v.id AND perfil_id = rt.perfil_id) THEN
    RAISE EXCEPTION 'Quem já revisou esta versão em outra profissão não revisa de novo';
  END IF;
  IF NOT p_aprovar AND length(coalesce(trim(p_nota), '')) < 10 THEN
    RAISE EXCEPTION 'Para reprovar, descreva a correção (10 caracteres ou mais)';
  END IF;
  retro := v.status = 'aprovada';
  INSERT INTO public.ferramenta_revisoes (versao_id, tipo, perfil_id, registro, aprovada, nota, retroativa)
  VALUES (v.id, p_tipo, rt.perfil_id, rt.conselho || ' ' || rt.registro || '/' || rt.uf, p_aprovar,
          nullif(trim(p_nota), ''), retro);
  IF retro THEN
    -- versão já no ar (K4): a revisão fica registrada; achado vira versão nova corrigida
    st := 'aprovada';
    PERFORM private.registrar_auditoria(CASE WHEN p_aprovar THEN 'revisao_retroativa' ELSE 'achado_revisao_retroativa' END,
      'ferramenta_versoes', v.id, NULL, jsonb_build_object('ferramenta', p_ferramenta, 'versao', p_versao, 'tipo', p_tipo));
  ELSE
    st := private.fechar_versao_ferramenta(v.id);
    PERFORM private.registrar_auditoria('revisar_ferramenta', 'ferramenta_versoes', v.id, NULL,
      jsonb_build_object('ferramenta', p_ferramenta, 'versao', p_versao, 'tipo', p_tipo, 'aprovada', p_aprovar, 'status', st));
  END IF;
  RETURN st;
END $$;

-- Fila de cada revisor: primeiro as versões novas; depois as já no ar (K4),
-- com a pediatria na frente.
CREATE OR REPLACE FUNCTION public.fila_revisao_ferramentas(p_tipo text)
RETURNS TABLE (ferramenta_id text, titulo text, versao text, publico text, fontes jsonb, registrada_em timestamptz,
               retroativa boolean, medico_aprovou boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('farmaceutico', 'enfermeiro') THEN
    RAISE EXCEPTION 'Profissão de revisão inválida: %', p_tipo;
  END IF;
  IF (private.responsavel_tecnico(p_tipo)).id IS NULL AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Fila do revisor (%)', p_tipo USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT v.ferramenta_id, f.titulo, v.versao, v.publico, v.fontes, v.registrada_em,
         v.status = 'aprovada',
         EXISTS (SELECT 1 FROM public.ferramenta_revisoes r WHERE r.versao_id = v.id AND r.tipo = 'medico' AND r.aprovada)
    FROM public.ferramenta_versoes v
    JOIN public.ferramentas_clinicas f ON f.id = v.ferramenta_id
   WHERE p_tipo = ANY (f.revisoes_exigidas)
     AND v.status IN ('aguardando_aprovacao', 'aprovada')
     AND NOT EXISTS (SELECT 1 FROM public.ferramenta_revisoes r WHERE r.versao_id = v.id AND r.tipo = p_tipo)
   ORDER BY v.status = 'aprovada',
            CASE v.publico WHEN 'pediatrico' THEN 0 WHEN 'ambos' THEN 1 ELSE 2 END,
            v.ferramenta_id, v.registrada_em;
END $$;

-- a fila do médico não mostra o que ele já decidiu (esperando outra profissão)
CREATE OR REPLACE FUNCTION public.fila_aprovacao_ferramentas()
RETURNS TABLE (ferramenta_id text, titulo text, versao text, publico text, fontes jsonb, registrada_em timestamptz,
               vigente_versao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.responsavel_tecnico('medico')).id IS NULL AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Fila do responsável técnico' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT v.ferramenta_id, f.titulo, v.versao, v.publico, v.fontes, v.registrada_em,
         (SELECT a.versao FROM public.ferramenta_versoes a WHERE a.ferramenta_id = v.ferramenta_id AND a.status = 'aprovada')
    FROM public.ferramenta_versoes v JOIN public.ferramentas_clinicas f ON f.id = v.ferramenta_id
   WHERE v.status = 'aguardando_aprovacao'
     AND NOT EXISTS (SELECT 1 FROM public.ferramenta_revisoes r WHERE r.versao_id = v.id AND r.tipo = 'medico')
   ORDER BY v.registrada_em, v.ferramenta_id;
END $$;

-- ------------------------------------------- 7. situação que a tela mostra
-- Acrescenta as revisões exigidas e as que faltam (todas, mesmo sem revisor
-- nomeado: a tela avisa "falta a revisão do farmacêutico").
CREATE OR REPLACE FUNCTION public.situacao_ferramenta(p_ferramenta text, p_versao text, p_unidade uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'registrada', v.id IS NOT NULL,
    'status', coalesce(v.status, 'nao_registrada'),
    'decidida_por', p.nome_completo,
    'decisao_registro', v.decisao_registro,
    'decidida_em', v.decidida_em,
    'decisao_nota', v.decisao_nota,
    'revisoes_exigidas', (SELECT to_jsonb(f.revisoes_exigidas) FROM public.ferramentas_clinicas f WHERE f.id = p_ferramenta),
    'revisoes_pendentes', CASE WHEN v.id IS NULL THEN NULL ELSE to_jsonb(private.revisoes_pendentes(v.id, false)) END,
    'unidade', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
      'oculta', u.oculta, 'nota_local', u.nota_local, 'definida_em', u.vigente_desde,
      'definida_por', (SELECT pp.nome_completo FROM public.perfis pp WHERE pp.id = u.definida_por)) END)
  FROM (SELECT 1) x
  LEFT JOIN public.ferramenta_versoes v ON v.ferramenta_id = p_ferramenta AND v.versao = p_versao
  LEFT JOIN public.perfis p ON p.id = v.decidida_por
  LEFT JOIN public.ferramenta_unidade u ON u.ferramenta_id = p_ferramenta AND u.unidade_id = p_unidade
        AND u.vigente_ate IS NULL
        AND EXISTS (SELECT 1 FROM public.vinculos vv WHERE vv.perfil_id = private.meu_perfil_id()
                     AND vv.unidade_id = p_unidade AND vv.ativo)
$$;

-- ------------------------------------------------ 8. nomeação com COREN
CREATE OR REPLACE FUNCTION public.nomear_responsavel_tecnico(
  p_perfil uuid, p_tipo text, p_registro text, p_uf text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da rede nomeia responsável técnico' USING ERRCODE = '42501';
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('medico', 'farmaceutico', 'enfermeiro') THEN
    RAISE EXCEPTION 'Tipo de responsável inválido: %', p_tipo;
  END IF;
  IF coalesce(trim(p_registro), '') = '' THEN
    RAISE EXCEPTION 'Registro no conselho é obrigatório';
  END IF;
  UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now()
   WHERE perfil_id = p_perfil AND tipo = p_tipo AND ativo;
  INSERT INTO public.responsaveis_tecnicos (perfil_id, tipo, conselho, registro, uf, nomeado_por)
  VALUES (p_perfil, p_tipo, CASE p_tipo WHEN 'medico' THEN 'CRM' WHEN 'farmaceutico' THEN 'CRF' ELSE 'COREN' END,
          trim(p_registro), upper(trim(p_uf)), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('nomear_responsavel_tecnico', 'responsaveis_tecnicos', v_id, NULL,
    jsonb_build_object('perfil', p_perfil, 'tipo', p_tipo));
  RETURN v_id;
END $$;

-- ----------------------------------------------------------- 9. grants
REVOKE ALL ON FUNCTION private.revisoes_pendentes(uuid, boolean), private.fechar_versao_ferramenta(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revisar_versao_ferramenta(text, text, text, boolean, text),
  public.fila_revisao_ferramentas(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_versao_ferramenta(text, text, text, boolean, text),
  public.fila_revisao_ferramentas(text) TO authenticated;

-- ------------------------------------- 10. revisões exigidas, pelo mapa
-- Gerado por: node --experimental-strip-types scripts/modulo-clinico.mjs --sql
UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ARRAY['medico']::text[]
 WHERE id = ANY (ARRAY['4at-delirium', '4t-hit', 'abcd2', 'acesso-venoso', 'adulto-acessos-calibres', 'aims65', 'alvarado', 'bisap', 'cam-icu', 'canadian-ct-head', 'cha2ds2-va', 'child-pugh', 'civd-isth', 'ckd-epi-2021', 'cockcroft-gault', 'crb-65', 'curb-65', 'curva-crescimento-oms', 'fast-ed', 'four', 'genebra-revisado', 'glasgow', 'glasgow-blatchford', 'grace', 'has-bled', 'heart', 'iss', 'killip', 'light', 'mapa-cid-ferramentas', 'mcisaac-centor', 'meld-3', 'news2', 'nota-hcfmusp-cap10-sedacao', 'nota-hcfmusp-cap100-afogamento', 'nota-hcfmusp-cap102-hipotermia', 'nota-hcfmusp-cap104-paliativos-sintomas', 'nota-hcfmusp-cap105-acessos', 'nota-hcfmusp-cap107-marca-passo', 'nota-hcfmusp-cap108-toracocentese', 'nota-hcfmusp-cap11-anafilaxia', 'nota-hcfmusp-cap12-dor-toracica', 'nota-hcfmusp-cap13-14-sca', 'nota-hcfmusp-cap15-bradiarritmias', 'nota-hcfmusp-cap16-sincope', 'nota-hcfmusp-cap17-fa', 'nota-hcfmusp-cap18-taquiarritmias', 'nota-hcfmusp-cap19-emergencia-hipertensiva', 'nota-hcfmusp-cap2-pcr', 'nota-hcfmusp-cap20-sindrome-aortica', 'nota-hcfmusp-cap21-ic-aguda', 'nota-hcfmusp-cap22-pericardite-miocardite', 'nota-hcfmusp-cap23-endocardite', 'nota-hcfmusp-cap24-oclusao-arterial', 'nota-hcfmusp-cap25-tvp', 'nota-hcfmusp-cap27-irpa', 'nota-hcfmusp-cap29-hemorragia-alveolar', 'nota-hcfmusp-cap3-via-aerea', 'nota-hcfmusp-cap30-asma', 'nota-hcfmusp-cap31-dpoc', 'nota-hcfmusp-cap32-tep', 'nota-hcfmusp-cap33-pac', 'nota-hcfmusp-cap34-pneumotorax', 'nota-hcfmusp-cap35-aspiracao', 'nota-hcfmusp-cap36-derrame-pleural', 'nota-hcfmusp-cap37-vm', 'nota-hcfmusp-cap38-avc', 'nota-hcfmusp-cap39-hic', 'nota-hcfmusp-cap4-7-sepse', 'nota-hcfmusp-cap40-hsa', 'nota-hcfmusp-cap41-cefaleia', 'nota-hcfmusp-cap42-vertigem', 'nota-hcfmusp-cap43-neuroinfeccao', 'nota-hcfmusp-cap44-paralisias-flacidas', 'nota-hcfmusp-cap45-primeira-crise', 'nota-hcfmusp-cap47-trauma', 'nota-hcfmusp-cap48-pre-hospitalar', 'nota-hcfmusp-cap49-dor-abdominal', 'nota-hcfmusp-cap5-rebaixamento', 'nota-hcfmusp-cap50-hda', 'nota-hcfmusp-cap51-hdb', 'nota-hcfmusp-cap53-nauseas-vomitos', 'nota-hcfmusp-cap54-diverticulite', 'nota-hcfmusp-cap55-ascite', 'nota-hcfmusp-cap56-ictericia-colangite', 'nota-hcfmusp-cap57-58-pbe-shr', 'nota-hcfmusp-cap59-encefalopatia', 'nota-hcfmusp-cap6-pos-pcr', 'nota-hcfmusp-cap60-hepatites-graves', 'nota-hcfmusp-cap61-lra', 'nota-hcfmusp-cap62-colica-nefretica', 'nota-hcfmusp-cap63-rabdomiolise', 'nota-hcfmusp-cap64-cad-ehh', 'nota-hcfmusp-cap65-hipoglicemia', 'nota-hcfmusp-cap66-sodio', 'nota-hcfmusp-cap67-hiperpotassemia', 'nota-hcfmusp-cap68-calcio', 'nota-hcfmusp-cap70-tireotoxica', 'nota-hcfmusp-cap71-mixedema', 'nota-hcfmusp-cap72-adrenal', 'nota-hcfmusp-cap74-monoartrite', 'nota-hcfmusp-cap75-reumatologicas', 'nota-hcfmusp-cap76-agitacao', 'nota-hcfmusp-cap78-abstinencia', 'nota-hcfmusp-cap79-hemostasia', 'nota-hcfmusp-cap8-delirium', 'nota-hcfmusp-cap80-falciforme', 'nota-hcfmusp-cap81-neutropenia', 'nota-hcfmusp-cap82-transfusao', 'nota-hcfmusp-cap83-plaquetopenia', 'nota-hcfmusp-cap84-lise-tumoral', 'nota-hcfmusp-cap85-oftalmologia', 'nota-hcfmusp-cap86-otorrino', 'nota-hcfmusp-cap87-covid', 'nota-hcfmusp-cap88-hiv', 'nota-hcfmusp-cap89-itu', 'nota-hcfmusp-cap9-dor', 'nota-hcfmusp-cap90-influenza', 'nota-hcfmusp-cap91-dengue', 'nota-hcfmusp-cap92-chikungunya', 'nota-hcfmusp-cap95-febre-amarela', 'nota-hcfmusp-cap96-dermatoses', 'nota-hcfmusp-cap97-99-intoxicacoes', 'ottawa-joelho', 'ottawa-tornozelo-pe', 'paliativo-pergunta-surpresa', 'ped-pews-icr', 'ped-phoenix', 'ped-pram', 'ped-sinais-vitais-icr', 'ped-twist', 'psi-port', 'race', 'ranson', 'rass', 'rockall', 'sepse-adulto', 'sgarbossa-modificado', 'sincope-canadense', 'sofa-2', 'spesi', 'timi-iamcsst', 'twist', 'wells-tep', 'wells-tvp', 'years']::text[])
   AND revisoes_exigidas IS DISTINCT FROM ARRAY['medico']::text[];
UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ARRAY['medico', 'enfermeiro']::text[]
 WHERE id = ANY (ARRAY['avaliacao-braden', 'avaliacao-morse', 'dini-pediatrico', 'enfermagem-sae', 'fugulin-12-areas', 'triagem-anexos-sinais-vitais', 'triagem-dor-flacc', 'triagem-dor-nips', 'triagem-dor-numerica', 'triagem-gestacao-naegele']::text[])
   AND revisoes_exigidas IS DISTINCT FROM ARRAY['medico', 'enfermeiro']::text[];
UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ARRAY['medico', 'farmaceutico']::text[]
 WHERE id = ANY (ARRAY['adulto-abc-score', 'adulto-abstinencia-alcoolica', 'adulto-add-rs', 'adulto-agitacao', 'adulto-anafilaxia', 'adulto-animais-peconhentos', 'adulto-anticoagulacao-plena', 'adulto-ascite-pbe-hepatorrenal', 'adulto-asma-exacerbacao', 'adulto-ats-idsa-pac', 'adulto-bars', 'adulto-bicarbonato', 'adulto-bps', 'adulto-bradicardia', 'adulto-burch-wartofsky', 'adulto-cad-ehh-avaliacao', 'adulto-cad-ehh-tratamento', 'adulto-cairo-bishop', 'adulto-cefaleia', 'adulto-colica-renal', 'adulto-crise-tireotoxica', 'adulto-criterios-vm-sgb', 'adulto-dermatoses-graves', 'adulto-dispneia-abordagem', 'adulto-dor-analgesia', 'adulto-dpoc-exacerbacao', 'adulto-duke-modificado', 'adulto-egos', 'adulto-emergencia-hipertensiva', 'adulto-encefalopatia-hepatites-graves', 'adulto-escala-numerica-dor', 'adulto-escore-ich', 'adulto-escore-mixedema', 'adulto-estado-de-mal-epileptico', 'adulto-estado-mixedematoso', 'adulto-falciforme', 'adulto-fibrilacao-atrial', 'adulto-fibrinoliticos', 'adulto-fisher-hsa', 'adulto-gasometria', 'adulto-gbs-incapacidade', 'adulto-guillain-barre', 'adulto-hemorragia-digestiva', 'adulto-heparina-nao-fracionada', 'adulto-hepatite-b-pos-exposicao', 'adulto-hestia', 'adulto-hints-plus', 'adulto-hipercalcemia', 'adulto-hipernatremia', 'adulto-hipoglicemia', 'adulto-hiponatremia', 'adulto-hipotermia', 'adulto-hsa', 'adulto-hunt-hess', 'adulto-ic-aguda', 'adulto-infusoes', 'adulto-insuficiencia-adrenal', 'adulto-intermacao', 'adulto-intoxicacoes-antidotos', 'adulto-isr', 'adulto-itu', 'adulto-lesao-renal-aguda', 'adulto-lise-tumoral', 'adulto-maddrey', 'adulto-marca-passo-provisorio', 'adulto-mascc', 'adulto-mcmahon-rabdomiolise', 'adulto-meningite', 'adulto-mgap', 'adulto-neutropenia-febril', 'adulto-nexus', 'adulto-nihss', 'adulto-oakland', 'adulto-ottawa-hsa', 'adulto-oxigenacao-irpa', 'adulto-pac-antibiotico', 'adulto-painad', 'adulto-pcr', 'adulto-pep-hiv', 'adulto-perc', 'adulto-pesi', 'adulto-pos-pcr', 'adulto-profilaxia-tev', 'adulto-profilaxia-ulcera-estresse', 'adulto-qtc', 'adulto-queimadura', 'adulto-rabdomiolise', 'adulto-raiva-pos-exposicao', 'adulto-rankin-modificada', 'adulto-regiscar', 'adulto-regra-canadense-coluna', 'adulto-reposicao-calcio', 'adulto-reposicao-fosforo', 'adulto-reposicao-magnesio', 'adulto-reposicao-potassio', 'adulto-ressuscitacao-volemica', 'adulto-reversao-anticoagulacao', 'adulto-sca-inicial', 'adulto-scorten-uti', 'adulto-sedacao-procedimento', 'adulto-sincope-san-francisco', 'adulto-sindrome-aortica', 'adulto-sindrome-toracica-aguda', 'adulto-sintomas-paliativos', 'adulto-smart-cop', 'adulto-szpilman', 'adulto-taquiarritmias', 'adulto-tetano-profilaxia', 'adulto-timi-nstemi', 'adulto-transfusao-hemocomponentes', 'adulto-trauma-inicial', 'adulto-triage-rts', 'adulto-trombolise-avc', 'adulto-vm-ajuste-inicial', 'adulto-vm-cinco-passos', 'adulto-vm-desmame', 'adulto-vm-mecanica', 'adulto-vm-obstruido-grave', 'adulto-vm-sdra', 'adulto-vni-cinco-passos', 'adulto-wfns', 'dengue-classificacao', 'hiperpotassemia', 'ped-acidobase', 'ped-anafilaxia-icr', 'ped-artrite-osteomielite', 'ped-asma-icr', 'ped-bolus', 'ped-bronquiolite', 'ped-cad-ehh', 'ped-choque-icr', 'ped-choque-toxico-partes-moles', 'ped-coma-hic', 'ped-crise-epileptica-icr', 'ped-crise-hipertensiva', 'ped-dengue', 'ped-diarreia-desidratacao', 'ped-eletrolitos', 'ped-emergencias-oncologicas', 'ped-escorpiao-aranhas', 'ped-falciforme', 'ped-febre-imunodeprimido', 'ped-febre-sem-sinais', 'ped-fita-broselow', 'ped-fluidoterapia-manutencao', 'ped-glasgow-icr', 'ped-glomerulopatias-shu', 'ped-hda-hepatica', 'ped-hemostasia-trombose', 'ped-hemoterapia', 'ped-hipoglicemia', 'ped-ictericia-neonatal', 'ped-infeccao-urinaria', 'ped-infusoes', 'ped-injuria-renal', 'ped-insuficiencia-adrenal', 'ped-insuficiencia-cardiaca', 'ped-intoxicacoes', 'ped-kawasaki', 'ped-meningite', 'ped-pecarn-abdome', 'ped-pecarn-coluna-cervical', 'ped-pecarn-maior2-icr', 'ped-pecarn-menor2-icr', 'ped-pneumonia', 'ped-pops-icr', 'ped-queimadura', 'ped-rcp-icr', 'ped-reanimacao-neonatal', 'ped-sedacao-procedimento', 'ped-sodio', 'ped-tce-icr', 'ped-ten-4-facesp', 'ped-tetano-raiva', 'ped-tfg-schwartz', 'ped-via-aerea', 'ped-vias-aereas-superiores']::text[])
   AND revisoes_exigidas IS DISTINCT FROM ARRAY['medico', 'farmaceutico']::text[];
