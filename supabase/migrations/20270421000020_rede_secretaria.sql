-- ════════════════════════════════════════════════════════════════════════════
-- Rede a partir da Secretaria (pedido do RT, 24/11/2026; desenho mestre-detalhe
-- aprovado no Refero): "rede é o que existe que conecta; então cada secretaria
-- tem um campo e a partir dele ramifica para hospitais, clínicas, ambulatórios,
-- UPAs, UBS etc."
--
-- O que já existia e continua igual: a organização é o cliente (tenant) e as
-- unidades pertencem a ela; rede_modulo aponta a unidade administrativa
-- "Secretaria" dos papéis de rede (Fase 4, tarefa 12). Nada disso muda.
--
-- Expand (só adiciona, idempotente):
-- 1. public.secretarias: as secretarias de cada organização (uma organização
--    pode ter mais de uma, por exemplo a municipal e a estadual). RLS: lê o
--    super admin e o administrador da organização; ninguém grava direto.
-- 2. public.unidades ganha secretaria_id (a que secretaria a unidade está
--    ligada; nula = ainda sem secretaria) e ramo_rede (em que ramo da árvore
--    ela aparece; nulo = sai do tipo, e a central de regulação da organização
--    vai para "Centrais de regulação"). O ramo não muda o tipo da unidade: o
--    menu e as telas continuam saindo do tipo. A chave estrangeira composta
--    (secretaria_id, organizacao_id) impede ligar a unidade a uma secretaria
--    de outra organização.
-- 3. RPCs do administrador (super admin ou admin da organização):
--    • admin_rede_arvore(): a árvore secretaria → ramo → unidade, com dados,
--      contatos e pessoas por papel de cada unidade (sem paciente);
--    • admin_salvar_secretaria(...): cria ou edita a secretaria (segundo
--      fator, auditoria 'secretaria_criada' / 'secretaria_editada');
--    • admin_unidade_na_rede(unidade, secretaria, ramo): liga, move ou
--      desliga a unidade e define o ramo (segundo fator, auditoria
--      'unidade_na_rede').
--
-- Teste: supabase/tests/rede_secretaria.sql
-- Rollback: docs/rede/ROLLBACK-20270421000020.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. secretarias ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.secretarias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id),
  nome            text NOT NULL CHECK (btrim(nome) <> ''),
  esfera          text NOT NULL DEFAULT 'municipal' CHECK (esfera IN ('municipal', 'estadual', 'regional')),
  municipio       text,
  uf              text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  cnpj            text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  responsavel     text,
  telefone        text,
  email           text,
  endereco        text,
  ativo           boolean NOT NULL DEFAULT true,
  criado_por      uuid REFERENCES public.perfis(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  -- alvo da chave composta de unidades (mesma organização)
  CONSTRAINT secretarias_id_organizacao_key UNIQUE (id, organizacao_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS secretarias_nome_org_uidx ON public.secretarias (organizacao_id, lower(btrim(nome)));
CREATE INDEX IF NOT EXISTS secretarias_organizacao_idx ON public.secretarias (organizacao_id);

ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secretarias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.secretarias TO authenticated;
DROP POLICY IF EXISTS secretarias_select ON public.secretarias;
CREATE POLICY secretarias_select ON public.secretarias FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.eh_admin_da_organizacao(organizacao_id));

-- ── 2. unidades: secretaria e ramo ─────────────────────────────────────────
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS secretaria_id uuid;
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS ramo_rede text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_secretaria_mesma_org_fkey') THEN
    ALTER TABLE public.unidades ADD CONSTRAINT unidades_secretaria_mesma_org_fkey
      FOREIGN KEY (secretaria_id, organizacao_id) REFERENCES public.secretarias (id, organizacao_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_ramo_rede_check') THEN
    ALTER TABLE public.unidades ADD CONSTRAINT unidades_ramo_rede_check
      CHECK (ramo_rede IS NULL OR ramo_rede IN ('hospital', 'upa', 'ubs', 'clinica', 'ambulatorio', 'central_regulacao'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS unidades_secretaria_idx ON public.unidades (secretaria_id) WHERE secretaria_id IS NOT NULL;
-- authenticated segue sem UPDATE nessas colunas (só o que a Configuração grava)

-- ── 3a. árvore ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_rede_arvore()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_super boolean := private.eh_super_admin();
BEGIN
  IF private.meu_perfil_id() IS NULL
     OR NOT (v_super OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'A rede é do administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id,
      'nome', o.nome,
      'secretarias', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'nome', s.nome, 'esfera', s.esfera, 'municipio', s.municipio, 'uf', s.uf,
          'cnpj', s.cnpj, 'responsavel', s.responsavel, 'telefone', s.telefone, 'email', s.email,
          'endereco', s.endereco, 'ativo', s.ativo, 'atualizado_em', s.atualizado_em
        ) ORDER BY s.ativo DESC, s.nome)
        FROM public.secretarias s WHERE s.organizacao_id = o.id), '[]'::jsonb),
      'unidades', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', u.id, 'nome', u.nome, 'tipo', u.tipo, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf,
          'endereco', u.endereco, 'whatsapp', u.whatsapp_numero, 'ativo', u.ativo,
          'secretaria_id', u.secretaria_id,
          'ramo_rede', u.ramo_rede,
          'ramo', coalesce(u.ramo_rede, CASE WHEN cr.unidade_id IS NOT NULL THEN 'central_regulacao' ELSE u.tipo::text END),
          'eh_central', cr.unidade_id IS NOT NULL,
          'eh_sede_rede', rm.secretaria_unidade_id IS NOT NULL,
          -- pessoas: vínculos ativos por papel e o nome de quem gere a unidade
          'pessoas', coalesce((
            SELECT jsonb_object_agg(x.papel, x.n) FROM (
              SELECT v.papel::text AS papel, count(*) AS n FROM public.vinculos v
               WHERE v.unidade_id = u.id AND v.ativo GROUP BY v.papel) x), '{}'::jsonb),
          'gestores', coalesce((
            SELECT jsonb_agg(p.nome_completo ORDER BY p.nome_completo)
              FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
             WHERE v.unidade_id = u.id AND v.ativo AND v.papel = 'gestor'), '[]'::jsonb)
        ) ORDER BY u.nome)
        FROM public.unidades u
        LEFT JOIN public.centrais_regulacao cr ON cr.unidade_id = u.id AND cr.organizacao_id = u.organizacao_id
        LEFT JOIN public.rede_modulo rm ON rm.secretaria_unidade_id = u.id
       WHERE u.organizacao_id = o.id), '[]'::jsonb)
    ) ORDER BY o.nome)
    FROM public.organizacoes o
   WHERE o.ativo AND (v_super OR o.id IN (SELECT private.orgs_admin()))
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_rede_arvore() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rede_arvore() TO authenticated;

-- ── 3b. criar ou editar a secretaria ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_salvar_secretaria(
  p_id uuid, p_organizacao uuid, p_nome text, p_esfera text DEFAULT 'municipal',
  p_municipio text DEFAULT NULL, p_uf text DEFAULT NULL, p_cnpj text DEFAULT NULL,
  p_responsavel text DEFAULT NULL, p_telefone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_endereco text DEFAULT NULL, p_ativo boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.secretarias;
  v_org uuid;
  v_nome text := nullif(btrim(p_nome), '');
  v_esfera text := coalesce(nullif(btrim(p_esfera), ''), 'municipal');
  v_uf text := upper(nullif(btrim(p_uf), ''));
  v_cnpj text := private.so_digitos(p_cnpj);
  v_email text := lower(nullif(btrim(p_email), ''));
  v_ativo boolean := coalesce(p_ativo, true);
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_id IS NOT NULL THEN
    SELECT * INTO s FROM public.secretarias WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Secretaria não encontrada.'; END IF;
    v_org := s.organizacao_id;
  ELSE
    v_org := p_organizacao;
    IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = v_org) THEN
      RAISE EXCEPTION 'Organização não encontrada.';
    END IF;
  END IF;
  IF NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(v_org)) THEN
    RAISE EXCEPTION 'Quem cadastra a secretaria é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o nome da secretaria.'; END IF;
  IF v_esfera NOT IN ('municipal', 'estadual', 'regional') THEN RAISE EXCEPTION 'Esfera inválida.'; END IF;
  IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF com 2 letras.'; END IF;
  IF v_cnpj IS NOT NULL AND length(v_cnpj) <> 14 THEN RAISE EXCEPTION 'CNPJ com 14 dígitos.'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.secretarias
              WHERE organizacao_id = v_org AND id IS DISTINCT FROM p_id AND lower(btrim(nome)) = lower(v_nome)) THEN
    RAISE EXCEPTION 'Já existe uma secretaria com este nome na organização.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.secretarias (organizacao_id, nome, esfera, municipio, uf, cnpj, responsavel, telefone, email, endereco, ativo, criado_por)
    VALUES (v_org, v_nome, v_esfera, nullif(btrim(p_municipio), ''), v_uf, v_cnpj, nullif(btrim(p_responsavel), ''),
            nullif(btrim(p_telefone), ''), v_email, nullif(btrim(p_endereco), ''), v_ativo, private.meu_perfil_id())
    RETURNING id INTO v_id;
    PERFORM private.registrar_auditoria('secretaria_criada', 'secretarias', v_id, NULL,
      jsonb_build_object('ativo', v_ativo, 'tipo', v_esfera));
    RETURN v_id;
  END IF;

  -- desligar com unidade ativa dentro deixaria a unidade pendurada
  IF s.ativo AND NOT v_ativo AND EXISTS (SELECT 1 FROM public.unidades WHERE secretaria_id = s.id AND ativo) THEN
    RAISE EXCEPTION 'Mova as unidades ativas para outra secretaria antes de desativar esta.';
  END IF;
  UPDATE public.secretarias
     SET nome = v_nome, esfera = v_esfera, municipio = nullif(btrim(p_municipio), ''), uf = v_uf, cnpj = v_cnpj,
         responsavel = nullif(btrim(p_responsavel), ''), telefone = nullif(btrim(p_telefone), ''), email = v_email,
         endereco = nullif(btrim(p_endereco), ''), ativo = v_ativo, atualizado_em = now()
   WHERE id = s.id;
  PERFORM private.registrar_auditoria('secretaria_editada', 'secretarias', s.id, NULL,
    jsonb_build_object('ativo', v_ativo, 'tipo', v_esfera, 'anterior', s.ativo));
  RETURN s.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_salvar_secretaria(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_salvar_secretaria(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) TO authenticated;

-- ── 3c. ligar, mover ou desligar a unidade; ramo da árvore ─────────────────
CREATE OR REPLACE FUNCTION public.admin_unidade_na_rede(p_unidade uuid, p_secretaria uuid, p_ramo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades;
  v_ramo text := nullif(btrim(p_ramo), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND OR NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(u.organizacao_id)) THEN
    RAISE EXCEPTION 'Quem organiza a rede é o administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_secretaria IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.secretarias WHERE id = p_secretaria AND organizacao_id = u.organizacao_id AND ativo) THEN
    RAISE EXCEPTION 'Escolha uma secretaria ativa da mesma organização.';
  END IF;
  IF v_ramo IS NOT NULL AND v_ramo NOT IN ('hospital', 'upa', 'ubs', 'clinica', 'ambulatorio', 'central_regulacao') THEN
    RAISE EXCEPTION 'Ramo inválido.';
  END IF;
  IF p_secretaria IS NOT DISTINCT FROM u.secretaria_id AND v_ramo IS NOT DISTINCT FROM u.ramo_rede THEN RETURN; END IF;

  UPDATE public.unidades SET secretaria_id = p_secretaria, ramo_rede = v_ramo, updated_at = now() WHERE id = u.id;
  PERFORM private.registrar_auditoria('unidade_na_rede', 'unidades', u.id, u.id,
    jsonb_build_object('anterior', u.secretaria_id, 'status', p_secretaria, 'tipo', v_ramo));
END $$;
REVOKE ALL ON FUNCTION public.admin_unidade_na_rede(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unidade_na_rede(uuid, uuid, text) TO authenticated;
