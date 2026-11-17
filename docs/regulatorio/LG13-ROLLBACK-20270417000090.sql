-- Rollback da migration 20270417000090 (LG13: revisão por profissão).
-- Volta ao estado da 20260930000001: o médico aprova sozinho.
-- Atenção: apaga o registro das revisões (public.ferramenta_revisoes). Antes de
-- rodar na produção, exporte a tabela. Testado na homologação dentro de transação.
BEGIN;
DROP FUNCTION IF EXISTS public.revisar_versao_ferramenta(text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.fila_revisao_ferramentas(text);
DROP FUNCTION IF EXISTS private.fechar_versao_ferramenta(uuid);

-- funções como na 20260930000001
CREATE OR REPLACE FUNCTION public.nomear_responsavel_tecnico(
  p_perfil uuid, p_tipo text, p_registro text, p_uf text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da rede nomeia responsável técnico' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_registro), '') = '' THEN
    RAISE EXCEPTION 'Registro no conselho é obrigatório';
  END IF;
  UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now()
   WHERE perfil_id = p_perfil AND tipo = p_tipo AND ativo;
  INSERT INTO public.responsaveis_tecnicos (perfil_id, tipo, conselho, registro, uf, nomeado_por)
  VALUES (p_perfil, p_tipo, CASE p_tipo WHEN 'medico' THEN 'CRM' ELSE 'CRF' END,
          trim(p_registro), upper(trim(p_uf)), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('nomear_responsavel_tecnico', 'responsaveis_tecnicos', v_id, NULL,
    jsonb_build_object('perfil', p_perfil, 'tipo', p_tipo));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decidir_versao_ferramenta(
  p_ferramenta text, p_versao text, p_aprovar boolean, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rt public.responsaveis_tecnicos;
  v  public.ferramenta_versoes;
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
  IF NOT p_aprovar AND length(coalesce(trim(p_nota), '')) < 10 THEN
    RAISE EXCEPTION 'Para reprovar, descreva a correção (10 caracteres ou mais)';
  END IF;
  IF p_aprovar THEN
    UPDATE public.ferramenta_versoes SET status = 'substituida'
     WHERE ferramenta_id = p_ferramenta AND status = 'aprovada';
  END IF;
  UPDATE public.ferramenta_versoes
     SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'reprovada' END,
         decidida_por = rt.perfil_id, decidida_em = now(),
         decisao_registro = rt.conselho || ' ' || rt.registro || '/' || rt.uf,
         decisao_nota = nullif(trim(p_nota), '')
   WHERE id = v.id;
  PERFORM private.registrar_auditoria(CASE WHEN p_aprovar THEN 'aprovar_ferramenta' ELSE 'reprovar_ferramenta' END,
    'ferramenta_versoes', v.id, NULL, jsonb_build_object('ferramenta', p_ferramenta, 'versao', p_versao));
END $$;

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
   ORDER BY v.registrada_em, v.ferramenta_id;
END $$;

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


DROP FUNCTION IF EXISTS private.revisoes_pendentes(uuid, boolean);
DROP TABLE IF EXISTS public.ferramenta_revisoes;
ALTER TABLE public.ferramentas_clinicas DROP CONSTRAINT IF EXISTS ferramentas_clinicas_revisoes_check;
ALTER TABLE public.ferramentas_clinicas DROP COLUMN IF EXISTS revisoes_exigidas;

-- os CHECK antigos só voltam se não houver enfermeiro nomeado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.responsaveis_tecnicos WHERE tipo = 'enfermeiro') THEN
    RAISE NOTICE 'há enfermeiro nomeado: os CHECK de responsaveis_tecnicos ficam alargados';
  ELSE
    ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_tipo_check;
    ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_tipo_check CHECK (tipo IN ('medico', 'farmaceutico'));
    ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_conselho_check;
    ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_conselho_check CHECK (conselho IN ('CRM', 'CRF'));
    ALTER TABLE public.responsaveis_tecnicos DROP CONSTRAINT IF EXISTS responsaveis_tecnicos_check;
    ALTER TABLE public.responsaveis_tecnicos ADD CONSTRAINT responsaveis_tecnicos_check CHECK ((tipo = 'medico') = (conselho = 'CRM'));
  END IF;
END $$;
COMMIT;
