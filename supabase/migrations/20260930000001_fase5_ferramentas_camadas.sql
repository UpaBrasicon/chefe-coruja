-- Fase 5.2 — ferramentas clínicas: camada base versionada com aprovação
-- nominal do responsável técnico, e camada da unidade que sobrepõe sem apagar.
--
-- A regra de cada ferramenta vive no código (src/clinico, com teste); aqui
-- fica o registro de cada VERSÃO dela e quem a aprovou (ADR 0004 e 0007).
-- Enquanto ninguém aprovar, a tela avisa "aguardando aprovação".

-- ---------------------------------------------------------------- catálogo
CREATE TABLE IF NOT EXISTS public.ferramentas_clinicas (
  id         text PRIMARY KEY,               -- o id da ficha (src/clinico)
  titulo     text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferramenta_versoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id    text NOT NULL REFERENCES public.ferramentas_clinicas(id),
  versao           text NOT NULL,
  publico          text NOT NULL CHECK (publico IN ('adulto', 'pediatrico', 'ambos')),
  fontes           jsonb NOT NULL,
  registrada_em    timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL DEFAULT 'aguardando_aprovacao'
                   CHECK (status IN ('aguardando_aprovacao', 'aprovada', 'reprovada', 'substituida')),
  decidida_por     uuid REFERENCES public.perfis(id),
  decidida_em      timestamptz,
  decisao_registro text,                      -- "CRM 12345/SP" no momento da decisão
  decisao_nota     text,
  UNIQUE (ferramenta_id, versao)
);

-- ------------------------------------------------ responsáveis técnicos
-- Nomeação é da administração da rede; o registro no conselho fica guardado
-- como foi informado, para aparecer junto de cada aprovação.
CREATE TABLE IF NOT EXISTS public.responsaveis_tecnicos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id),
  tipo         text NOT NULL CHECK (tipo IN ('medico', 'farmaceutico')),
  conselho     text NOT NULL CHECK (conselho IN ('CRM', 'CRF')),
  registro     text NOT NULL,
  uf           text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  ativo        boolean NOT NULL DEFAULT true,
  nomeado_por  uuid REFERENCES public.perfis(id),
  nomeado_em   timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  CHECK ((tipo = 'medico') = (conselho = 'CRM'))
);
CREATE UNIQUE INDEX IF NOT EXISTS responsaveis_tecnicos_ativo_uq
  ON public.responsaveis_tecnicos (perfil_id, tipo) WHERE ativo;

-- ------------------------------------------------- camada da unidade
-- Cada mudança é uma linha nova; a anterior sai de vigência (não é apagada).
CREATE TABLE IF NOT EXISTS public.ferramenta_unidade (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  ferramenta_id  text NOT NULL REFERENCES public.ferramentas_clinicas(id),
  oculta         boolean NOT NULL DEFAULT false,
  nota_local     text,
  vigente_desde  timestamptz NOT NULL DEFAULT clock_timestamp(),
  vigente_ate    timestamptz,
  definida_por   uuid NOT NULL REFERENCES public.perfis(id),
  motivo         text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ferramenta_unidade_vigente_uq
  ON public.ferramenta_unidade (unidade_id, ferramenta_id) WHERE vigente_ate IS NULL;

-- escrita só pelas funções abaixo
ALTER TABLE public.ferramentas_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferramenta_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferramenta_unidade ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.ferramentas_clinicas, public.ferramenta_versoes,
  public.responsaveis_tecnicos, public.ferramenta_unidade FROM anon, authenticated;
GRANT SELECT ON public.ferramentas_clinicas, public.ferramenta_versoes TO authenticated;
DROP POLICY IF EXISTS ferramentas_clinicas_select ON public.ferramentas_clinicas;
CREATE POLICY ferramentas_clinicas_select ON public.ferramentas_clinicas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ferramenta_versoes_select ON public.ferramenta_versoes;
CREATE POLICY ferramenta_versoes_select ON public.ferramenta_versoes FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_ferramenta_unidade_sem_delete ON public.ferramenta_unidade;
CREATE TRIGGER trg_ferramenta_unidade_sem_delete BEFORE DELETE ON public.ferramenta_unidade
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

-- ------------------------------------------------------------ helpers
CREATE OR REPLACE FUNCTION private.responsavel_tecnico(p_tipo text)
RETURNS public.responsaveis_tecnicos
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.* FROM public.responsaveis_tecnicos r
   WHERE r.perfil_id = private.meu_perfil_id() AND r.tipo = p_tipo AND r.ativo
   LIMIT 1
$$;

-- ------------------------------------------------------------ nomeação
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

CREATE OR REPLACE FUNCTION public.encerrar_responsavel_tecnico(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da rede encerra responsável técnico' USING ERRCODE = '42501';
  END IF;
  UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now() WHERE id = p_id AND ativo;
  PERFORM private.registrar_auditoria('encerrar_responsavel_tecnico', 'responsaveis_tecnicos', p_id, NULL, NULL);
END $$;

-- quem sou eu como responsável técnico (para a tela mostrar a fila)
CREATE OR REPLACE FUNCTION public.meu_papel_tecnico()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', r.tipo, 'conselho', r.conselho, 'registro', r.registro, 'uf', r.uf)), '[]'::jsonb)
    FROM public.responsaveis_tecnicos r
   WHERE r.perfil_id = private.meu_perfil_id() AND r.ativo
$$;

-- --------------------------------------------------- aprovação da base
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

-- --------------------------------------------------- camada da unidade
CREATE OR REPLACE FUNCTION public.definir_ferramenta_unidade(
  p_unidade uuid, p_ferramenta text, p_oculta boolean, p_nota text, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN
    RAISE EXCEPTION 'Só o gestor da unidade define a camada da unidade' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(trim(p_motivo), '')) < 10 THEN
    RAISE EXCEPTION 'Motivo obrigatório (10 caracteres ou mais)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ferramentas_clinicas WHERE id = p_ferramenta) THEN
    RAISE EXCEPTION 'Ferramenta desconhecida: %', p_ferramenta;
  END IF;
  UPDATE public.ferramenta_unidade SET vigente_ate = clock_timestamp()
   WHERE unidade_id = p_unidade AND ferramenta_id = p_ferramenta AND vigente_ate IS NULL;
  INSERT INTO public.ferramenta_unidade (unidade_id, ferramenta_id, oculta, nota_local, definida_por, motivo)
  VALUES (p_unidade, p_ferramenta, coalesce(p_oculta, false), nullif(trim(p_nota), ''), private.meu_perfil_id(), trim(p_motivo))
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('camada_unidade_ferramenta', 'ferramenta_unidade', v_id, p_unidade,
    jsonb_build_object('ferramenta', p_ferramenta, 'oculta', p_oculta));
  RETURN v_id;
END $$;

-- ------------------------------------------ situação que a tela mostra
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

-- camada da unidade inteira (tela do gestor)
CREATE OR REPLACE FUNCTION public.ferramentas_da_unidade(p_unidade uuid)
RETURNS TABLE (ferramenta_id text, titulo text, versao_aprovada text, pendentes int,
               oculta boolean, nota_local text, definida_em timestamptz, definida_por text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN
    RAISE EXCEPTION 'Tela do gestor da unidade' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.id, f.titulo,
         (SELECT a.versao FROM public.ferramenta_versoes a WHERE a.ferramenta_id = f.id AND a.status = 'aprovada'),
         (SELECT count(*)::int FROM public.ferramenta_versoes a WHERE a.ferramenta_id = f.id AND a.status = 'aguardando_aprovacao'),
         coalesce(u.oculta, false), u.nota_local, u.vigente_desde, p.nome_completo
    FROM public.ferramentas_clinicas f
    LEFT JOIN public.ferramenta_unidade u ON u.ferramenta_id = f.id AND u.unidade_id = p_unidade AND u.vigente_ate IS NULL
    LEFT JOIN public.perfis p ON p.id = u.definida_por
   ORDER BY f.titulo;
END $$;

-- ------------------------------------------------ registro de versões
-- Chamado pelas migrations geradas de src/clinico (npm run fichas:sql).
CREATE OR REPLACE FUNCTION private.registrar_versao_ferramenta(
  p_id text, p_titulo text, p_versao text, p_publico text, p_fontes jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.ferramentas_clinicas (id, titulo) VALUES (p_id, p_titulo)
  ON CONFLICT (id) DO UPDATE SET titulo = excluded.titulo;
  INSERT INTO public.ferramenta_versoes (ferramenta_id, versao, publico, fontes)
  VALUES (p_id, p_versao, p_publico, p_fontes)
  ON CONFLICT (ferramenta_id, versao) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION private.registrar_versao_ferramenta(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nomear_responsavel_tecnico(uuid, text, text, text),
  public.encerrar_responsavel_tecnico(uuid), public.meu_papel_tecnico(),
  public.decidir_versao_ferramenta(text, text, boolean, text), public.fila_aprovacao_ferramentas(),
  public.definir_ferramenta_unidade(uuid, text, boolean, text, text),
  public.situacao_ferramenta(text, text, uuid), public.ferramentas_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nomear_responsavel_tecnico(uuid, text, text, text),
  public.encerrar_responsavel_tecnico(uuid), public.meu_papel_tecnico(),
  public.decidir_versao_ferramenta(text, text, boolean, text), public.fila_aprovacao_ferramentas(),
  public.definir_ferramenta_unidade(uuid, text, boolean, text, text),
  public.situacao_ferramenta(text, text, uuid), public.ferramentas_da_unidade(uuid) TO authenticated;
