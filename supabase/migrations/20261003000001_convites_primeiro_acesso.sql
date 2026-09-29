-- ════════════════════════════════════════════════════════════════════════════
-- Porte do PRIMEIRO ACESSO (protótipo primeiro-acesso.html).
--
-- Sem convite da unidade ou contrato da rede não há conta com vínculo:
--
-- • CONVITE (plantonista, enfermagem, farmácia, recepção, telemedicina): o
--   gestor da unidade gera um código CC-XXXXX no servidor, com unidade, papel,
--   setor e primeiro plantão opcionais. Vale 7 dias, é de uso único e pode
--   ser revogado. Quem recebe confere o código (RPC pública, com limite de
--   tentativas por origem) e cria a conta; o vínculo nasce ATIVO.
-- • CONTRATO (gestão e administração): código CT-AAAA-NNN da organização. A
--   conta nasce, a adesão fica registrada e o vínculo aguarda o administrador
--   (a tela AguardandoLiberacao já cobre esse estado).
--
-- Onde o convite é consumido: no GATILHO de auth.users, na mesma transação do
-- signUp. Motivo: com confirmação de e-mail ligada, o signUp não devolve
-- sessão, então uma RPC autenticada "logo após o signUp" não teria como ser
-- chamada. O gatilho lê o código e os dados do perfil de raw_user_meta_data,
-- aplica tudo (perfil, aceite do termo, vínculo, convite usado, e as escolhas
-- de aviso do passo 2, que a tela manda no mesmo signUp) e tira do metadado o
-- que é dado pessoal (CPF, nascimento, registro). Convite que não vale derruba
-- o signUp: não sobra conta sem vínculo.
-- A RPC autenticada aceitar_convite faz a mesma coisa para quem JÁ tem conta
-- (ex.: plantonista de uma unidade convidado para outra).
--
-- Reaplicável (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Perfil: registro profissional e nascimento ───────────────────────────
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS conselho        text,
  ADD COLUMN IF NOT EXISTS registro_numero text,
  ADD COLUMN IF NOT EXISTS registro_uf     text,
  ADD COLUMN IF NOT EXISTS data_nascimento date;

ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_conselho_valido;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_conselho_valido
  CHECK (conselho IS NULL OR conselho IN ('CRM', 'CRF', 'COREN'));

COMMENT ON COLUMN public.perfis.conselho IS
  'Conselho do registro profissional (CRM, CRF, COREN). Para CRM, crm/uf_crm espelham registro_numero/registro_uf.';

-- ── 2. Auxiliares ───────────────────────────────────────────────────────────
-- Versão vigente do termo de uso e sigilo. A tela manda a versão que mostrou;
-- versão diferente é recusada (o termo mudou enquanto a pessoa lia).
CREATE OR REPLACE FUNCTION private.termo_uso_versao()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'termo-uso-sigilo-2026-10'::text;
$$;

-- CPF com dígito verificador (só dígitos; rejeita repetidos como 111.111.111-11).
CREATE OR REPLACE FUNCTION private.convite_cpf_valido(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s int; r int; i int;
BEGIN
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(d, i, 1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d, 10, 1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(d, i, 1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d, 11, 1)::int;
END $$;

-- Quem gere os convites de uma unidade: o gestor dela, o admin da rede, o super.
CREATE OR REPLACE FUNCTION private.pode_gerir_convites(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin()
      OR EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = auth.uid() AND v.unidade_id = p_unidade
                    AND v.ativo AND v.papel = 'gestor')
      OR EXISTS (SELECT 1 FROM public.unidades u
                  WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id));
$$;
REVOKE ALL ON FUNCTION private.pode_gerir_convites(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_gerir_convites(uuid) TO authenticated;

-- ── 3. Convites ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.convites (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  text NOT NULL UNIQUE CHECK (codigo ~ '^CC-[A-Z0-9]{5}$'),
  unidade_id              uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  setor_id                uuid REFERENCES public.setores(id) ON DELETE SET NULL,
  -- gestão e administração entram por contrato, não por convite
  papel                   public.papel NOT NULL CHECK (papel NOT IN ('admin', 'gestor')),
  para_quem               text CHECK (para_quem IS NULL OR length(btrim(para_quem)) BETWEEN 2 AND 120),
  primeiro_plantao_inicio timestamptz,
  primeiro_plantao_fim    timestamptz,
  criado_por              uuid NOT NULL REFERENCES public.perfis(id),
  criado_em               timestamptz NOT NULL DEFAULT now(),
  expira_em               timestamptz NOT NULL DEFAULT now() + interval '7 days',
  usado_por               uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  usado_em                timestamptz,
  revogado_em             timestamptz,
  revogado_por            uuid REFERENCES public.perfis(id),
  -- "Pedir novo convite" de quem chegou com o código vencido
  novo_pedido_em          timestamptz,
  CHECK (expira_em > criado_em),
  CHECK (primeiro_plantao_fim IS NULL OR primeiro_plantao_inicio IS NOT NULL),
  CHECK (primeiro_plantao_fim IS NULL OR primeiro_plantao_fim > primeiro_plantao_inicio)
);

CREATE INDEX IF NOT EXISTS convites_unidade_idx ON public.convites (unidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS convites_criado_por_idx ON public.convites (criado_por);
CREATE INDEX IF NOT EXISTS convites_usado_por_idx ON public.convites (usado_por);
CREATE INDEX IF NOT EXISTS convites_setor_idx ON public.convites (setor_id);

COMMENT ON TABLE public.convites IS
  'Convite de uso único para o primeiro acesso numa unidade/papel. Escrita só por RPC (gerar_convite, revogar_convite, gatilho do signUp).';

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.convites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.convites TO authenticated;

DROP POLICY IF EXISTS convites_select ON public.convites;
CREATE POLICY convites_select ON public.convites
  FOR SELECT TO authenticated
  USING (private.pode_gerir_convites(unidade_id));

-- Situação de um convite, num lugar só.
CREATE OR REPLACE FUNCTION private.situacao_convite(p_usado_em timestamptz, p_revogado_em timestamptz, p_expira_em timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_revogado_em IS NOT NULL THEN 'revogado'
    WHEN p_usado_em IS NOT NULL THEN 'usado'
    WHEN p_expira_em <= now() THEN 'expirado'
    ELSE 'valido'
  END;
$$;

-- ── 4. Contratos da rede ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contratos_rede (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE CHECK (codigo ~ '^CT-[0-9]{4}-[0-9]{3}$'),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  papel_padrao    public.papel NOT NULL DEFAULT 'gestor' CHECK (papel_padrao IN ('admin', 'gestor')),
  -- se preenchido, só e-mail deste domínio adere (ex.: saocamilo.org.br)
  dominio_email   text CHECK (dominio_email IS NULL OR dominio_email ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  vigente_ate     date,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contratos_rede_org_idx ON public.contratos_rede (organizacao_id);

ALTER TABLE public.contratos_rede ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contratos_rede FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contratos_rede TO authenticated;

DROP POLICY IF EXISTS contratos_rede_select ON public.contratos_rede;
CREATE POLICY contratos_rede_select ON public.contratos_rede
  FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.eh_admin_da_organizacao(organizacao_id));

-- Quem cria e altera contrato é o super-admin (é o documento assinado com a rede).
DROP POLICY IF EXISTS contratos_rede_insert ON public.contratos_rede;
CREATE POLICY contratos_rede_insert ON public.contratos_rede
  FOR INSERT TO authenticated WITH CHECK (private.eh_super_admin());
DROP POLICY IF EXISTS contratos_rede_update ON public.contratos_rede;
CREATE POLICY contratos_rede_update ON public.contratos_rede
  FOR UPDATE TO authenticated USING (private.eh_super_admin()) WITH CHECK (private.eh_super_admin());

-- Adesão: a conta entrou pelo contrato e aguarda o administrador criar o vínculo.
CREATE TABLE IF NOT EXISTS public.adesoes_contrato (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id  uuid NOT NULL REFERENCES public.contratos_rede(id) ON DELETE CASCADE,
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  papel        public.papel NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS adesoes_contrato_perfil_idx ON public.adesoes_contrato (perfil_id);

ALTER TABLE public.adesoes_contrato ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.adesoes_contrato FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.adesoes_contrato TO authenticated;

DROP POLICY IF EXISTS adesoes_contrato_select ON public.adesoes_contrato;
CREATE POLICY adesoes_contrato_select ON public.adesoes_contrato
  FOR SELECT TO authenticated
  USING (perfil_id = auth.uid() OR private.eh_super_admin()
         OR EXISTS (SELECT 1 FROM public.contratos_rede c
                     WHERE c.id = contrato_id AND private.eh_admin_da_organizacao(c.organizacao_id)));

-- ── 5. Aceite do termo de uso e sigilo (só inserção) ────────────────────────
CREATE TABLE IF NOT EXISTS public.aceites_termo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  versao      text NOT NULL,
  aceito_em   timestamptz NOT NULL DEFAULT now(),
  origem      text NOT NULL CHECK (origem IN ('convite', 'contrato')),
  referencia  uuid
);
CREATE INDEX IF NOT EXISTS aceites_termo_perfil_idx ON public.aceites_termo (perfil_id, aceito_em DESC);

ALTER TABLE public.aceites_termo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aceites_termo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aceites_termo TO authenticated;

DROP POLICY IF EXISTS aceites_termo_select ON public.aceites_termo;
CREATE POLICY aceites_termo_select ON public.aceites_termo
  FOR SELECT TO authenticated
  USING (perfil_id = auth.uid() OR private.eh_super_admin());

DROP TRIGGER IF EXISTS trg_aceites_termo_so_insercao ON public.aceites_termo;
CREATE TRIGGER trg_aceites_termo_so_insercao
  BEFORE UPDATE OR DELETE ON public.aceites_termo
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();

-- ── 6. Preferências de aviso ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preferencias_aviso (
  perfil_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES public.perfis(id) ON DELETE CASCADE,
  chave          text NOT NULL CHECK (chave IN ('observacao_6h', 'leito_novo', 'prescricao_devolvida',
                                                'item_abaixo_minimo', 'troca_plantao', 'fim_turno_30min')),
  ligado         boolean NOT NULL,
  canal          text NOT NULL DEFAULT 'plataforma' CHECK (canal IN ('plataforma', 'aparelho')),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, chave),
  -- o prazo de observação acima de 6 h não desliga
  CONSTRAINT preferencias_aviso_observacao_sempre CHECK (chave <> 'observacao_6h' OR ligado)
);

COMMENT ON TABLE public.preferencias_aviso IS
  'O que vira aviso para cada pessoa. Sem linha = padrão do produto. observacao_6h não desliga.';

ALTER TABLE public.preferencias_aviso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preferencias_aviso FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.preferencias_aviso TO authenticated;

DROP POLICY IF EXISTS preferencias_aviso_select ON public.preferencias_aviso;
CREATE POLICY preferencias_aviso_select ON public.preferencias_aviso
  FOR SELECT TO authenticated USING (perfil_id = auth.uid());
DROP POLICY IF EXISTS preferencias_aviso_insert ON public.preferencias_aviso;
CREATE POLICY preferencias_aviso_insert ON public.preferencias_aviso
  FOR INSERT TO authenticated WITH CHECK (perfil_id = auth.uid());
DROP POLICY IF EXISTS preferencias_aviso_update ON public.preferencias_aviso;
CREATE POLICY preferencias_aviso_update ON public.preferencias_aviso
  FOR UPDATE TO authenticated USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());

-- ── 7. Limite de tentativas contra enumeração de códigos ────────────────────
-- Conta as conferências que NÃO acharam nada, por origem (IP do cabeçalho
-- x-forwarded-for que o PostgREST repassa). 10 erros em 15 min bloqueiam a
-- origem por 15 min. Não há tabela de auditoria de login no banco para reusar.
CREATE TABLE IF NOT EXISTS private.tentativas_primeiro_acesso (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origem  text NOT NULL,
  em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_primeiro_acesso_origem_idx
  ON private.tentativas_primeiro_acesso (origem, em DESC);
REVOKE ALL ON private.tentativas_primeiro_acesso FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.origem_requisicao()
RETURNS text LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v text;
BEGIN
  BEGIN
    v := btrim(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1));
  EXCEPTION WHEN others THEN v := NULL;
  END;
  RETURN coalesce(nullif(v, ''), 'sem-origem');
END $$;

CREATE OR REPLACE FUNCTION private.primeiro_acesso_bloqueado()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*) >= 10 FROM private.tentativas_primeiro_acesso
   WHERE origem = private.origem_requisicao() AND em > now() - interval '15 minutes';
$$;

CREATE OR REPLACE FUNCTION private.registrar_tentativa_primeiro_acesso()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM private.tentativas_primeiro_acesso WHERE em < now() - interval '1 day';
  INSERT INTO private.tentativas_primeiro_acesso (origem) VALUES (private.origem_requisicao());
END $$;

-- ── 8. Gestor: gerar, listar, revogar ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_convite(
  p_unidade                 uuid,
  p_papel                   public.papel,
  p_setor                   uuid DEFAULT NULL,
  p_para_quem               text DEFAULT NULL,
  p_primeiro_plantao_inicio timestamptz DEFAULT NULL,
  p_primeiro_plantao_fim    timestamptz DEFAULT NULL,
  p_validade_dias           int DEFAULT 7)
RETURNS TABLE (id uuid, codigo text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- sem 0/O, 1/I/L
  v_codigo text;
  v_bytes  bytea;
  v_id     uuid;
  v_expira timestamptz;
  i int;
BEGIN
  IF auth.uid() IS NULL OR NOT private.pode_gerir_convites(p_unidade) THEN
    RAISE EXCEPTION 'Só o gestor da unidade gera convite para ela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_papel IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Gestão e administração entram pelo contrato da rede, não por convite.';
  END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = p_setor AND s.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'O setor não é desta unidade.';
  END IF;
  IF p_validade_dias IS NULL OR p_validade_dias NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'A validade do convite vai de 1 a 30 dias.';
  END IF;
  IF p_primeiro_plantao_fim IS NOT NULL AND (p_primeiro_plantao_inicio IS NULL OR p_primeiro_plantao_fim <= p_primeiro_plantao_inicio) THEN
    RAISE EXCEPTION 'O fim do primeiro plantão vem depois do início.';
  END IF;

  v_expira := now() + make_interval(days => p_validade_dias);
  LOOP
    v_bytes := extensions.gen_random_bytes(5);
    v_codigo := 'CC-';
    FOR i IN 0..4 LOOP
      v_codigo := v_codigo || substr(alfabeto, (get_byte(v_bytes, i) % length(alfabeto)) + 1, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.convites (codigo, unidade_id, setor_id, papel, para_quem,
                                   primeiro_plantao_inicio, primeiro_plantao_fim, criado_por, expira_em)
      VALUES (v_codigo, p_unidade, p_setor, p_papel, nullif(btrim(p_para_quem), ''),
              p_primeiro_plantao_inicio, p_primeiro_plantao_fim, auth.uid(), v_expira)
      RETURNING convites.id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- código repetido (raro): sorteia outro
    END;
  END LOOP;

  PERFORM private.registrar_auditoria('gerar_convite', 'convites', v_id, p_unidade,
    jsonb_build_object('papel', p_papel, 'setor_id', p_setor));
  RETURN QUERY SELECT v_id, v_codigo, v_expira;
END $$;

CREATE OR REPLACE FUNCTION public.revogar_convite(p_convite uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.convites%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.convites WHERE id = p_convite FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.pode_gerir_convites(c.unidade_id) THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.usado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já usado: para tirar o acesso, revogue o vínculo da pessoa.';
  END IF;
  IF c.revogado_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.convites SET revogado_em = now(), revogado_por = auth.uid() WHERE id = p_convite;
  PERFORM private.registrar_auditoria('revogar_convite', 'convites', p_convite, c.unidade_id,
    jsonb_build_object('papel', c.papel));
END $$;

-- Lista do gestor, com nomes (o gestor não lê perfis de fora pela RLS).
CREATE OR REPLACE FUNCTION public.convites_da_unidade(p_unidade uuid)
RETURNS TABLE (
  id uuid, codigo text, papel public.papel, setor_id uuid, setor_nome text, para_quem text,
  primeiro_plantao_inicio timestamptz, primeiro_plantao_fim timestamptz,
  criado_em timestamptz, criado_por_nome text, expira_em timestamptz,
  usado_em timestamptz, usado_por_nome text, revogado_em timestamptz,
  novo_pedido_em timestamptz, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.pode_gerir_convites(p_unidade) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê os convites dela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT c.id, c.codigo, c.papel, c.setor_id, s.nome, c.para_quem,
         c.primeiro_plantao_inicio, c.primeiro_plantao_fim,
         c.criado_em, pc.nome_completo, c.expira_em,
         c.usado_em, pu.nome_completo, c.revogado_em, c.novo_pedido_em,
         private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em)
    FROM public.convites c
    LEFT JOIN public.setores s ON s.id = c.setor_id
    LEFT JOIN public.perfis pc ON pc.id = c.criado_por
    LEFT JOIN public.perfis pu ON pu.id = c.usado_por
   WHERE c.unidade_id = p_unidade
   ORDER BY c.criado_em DESC
   LIMIT 200;
END $$;

-- ── 9. Público: conferir convite / contrato, pedir novo convite ─────────────
-- Devolve SÓ o que o cartão "Convite conferido" mostra, ou o motivo. Nada de
-- e-mail, CPF ou ids.
DROP FUNCTION IF EXISTS public.conferir_convite(text);
CREATE OR REPLACE FUNCTION public.conferir_convite(p_codigo text)
RETURNS TABLE (
  situacao text, unidade text, setor text, papel public.papel,
  primeiro_plantao_inicio timestamptz, primeiro_plantao_fim timestamptz,
  convidou text, convidou_papel public.papel, expira_em timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  c public.convites%ROWTYPE;
  v_sit text;
BEGIN
  IF private.primeiro_acesso_bloqueado() THEN
    RETURN QUERY SELECT 'muitas_tentativas'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_codigo !~ '^CC-[A-Z0-9]{5}$' THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN QUERY SELECT 'nao_existe'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.convites WHERE codigo = v_codigo;
  IF NOT FOUND THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN QUERY SELECT 'nao_existe'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;

  v_sit := private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em);
  IF v_sit IN ('usado', 'revogado') THEN
    RETURN QUERY SELECT v_sit, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_sit = 'expirado' THEN
    -- o nome de quem convidou vai junto: é quem recebe o pedido de novo convite
    RETURN QUERY SELECT v_sit, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz,
      (SELECT p.nome_completo FROM public.perfis p WHERE p.id = c.criado_por), NULL::public.papel, c.expira_em;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'valido'::text, u.nome, s.nome, c.papel, c.primeiro_plantao_inicio, c.primeiro_plantao_fim,
         p.nome_completo,
         (SELECT v.papel FROM public.vinculos v
           WHERE v.perfil_id = c.criado_por AND v.unidade_id = c.unidade_id AND v.ativo
           ORDER BY (v.papel = 'gestor') DESC LIMIT 1),
         c.expira_em
    FROM public.unidades u
    LEFT JOIN public.setores s ON s.id = c.setor_id
    LEFT JOIN public.perfis p ON p.id = c.criado_por
   WHERE u.id = c.unidade_id;
END $$;

-- "Pedir novo convite": marca o convite vencido para a coordenação ver na lista.
CREATE OR REPLACE FUNCTION public.pedir_novo_convite(p_codigo text)
RETURNS TABLE (convidou text, pedido_em timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.convites%ROWTYPE;
BEGIN
  IF private.primeiro_acesso_bloqueado() THEN
    RAISE EXCEPTION 'Muitas tentativas. Espere 15 minutos.';
  END IF;
  SELECT * INTO c FROM public.convites WHERE codigo = upper(btrim(coalesce(p_codigo, ''))) FOR UPDATE;
  IF NOT FOUND OR private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em) <> 'expirado' THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RAISE EXCEPTION 'Só um convite expirado pode ser renovado.';
  END IF;
  UPDATE public.convites SET novo_pedido_em = coalesce(novo_pedido_em, now()) WHERE id = c.id
  RETURNING convites.novo_pedido_em INTO c.novo_pedido_em;
  RETURN QUERY SELECT (SELECT p.nome_completo FROM public.perfis p WHERE p.id = c.criado_por), c.novo_pedido_em;
END $$;

DROP FUNCTION IF EXISTS public.conferir_contrato(text, text);
CREATE OR REPLACE FUNCTION public.conferir_contrato(p_codigo text, p_email text)
RETURNS TABLE (situacao text, organizacao text, unidades int, papel public.papel, vigente_ate date)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  k public.contratos_rede%ROWTYPE;
BEGIN
  IF private.primeiro_acesso_bloqueado() THEN
    RETURN QUERY SELECT 'muitas_tentativas'::text, NULL::text, NULL::int, NULL::public.papel, NULL::date;
    RETURN;
  END IF;
  SELECT * INTO k FROM public.contratos_rede WHERE codigo = v_codigo;
  -- contrato inexistente, inativo, vencido ou de outro domínio: a mesma resposta
  IF NOT FOUND OR NOT k.ativo
     OR (k.vigente_ate IS NOT NULL AND k.vigente_ate < (now() AT TIME ZONE 'America/Sao_Paulo')::date)
     OR (k.dominio_email IS NOT NULL AND split_part(v_email, '@', 2) <> k.dominio_email) THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN QUERY SELECT 'nao_confere'::text, NULL::text, NULL::int, NULL::public.papel, NULL::date;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT 'valido'::text, o.nome,
         (SELECT count(*)::int FROM public.unidades u WHERE u.organizacao_id = k.organizacao_id AND u.ativo),
         k.papel_padrao, k.vigente_ate
    FROM public.organizacoes o WHERE o.id = k.organizacao_id;
END $$;

-- ── 10. Aplicação do primeiro acesso (núcleo do gatilho e da RPC) ───────────
-- p_dados: nome_completo, cpf, data_nascimento (AAAA-MM-DD), conselho,
-- registro_numero, registro_uf, termo_versao, e codigo_convite OU
-- codigo_contrato. Campos de identidade ausentes mantêm o que o perfil já tem.
CREATE OR REPLACE FUNCTION private.aplicar_primeiro_acesso(p_perfil uuid, p_email text, p_dados jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p            public.perfis%ROWTYPE;
  c            public.convites%ROWTYPE;
  k            public.contratos_rede%ROWTYPE;
  v_convite    text := upper(btrim(coalesce(p_dados ->> 'codigo_convite', '')));
  v_contrato   text := upper(btrim(coalesce(p_dados ->> 'codigo_contrato', '')));
  v_nome       text;
  v_cpf        text;
  v_nasc       date;
  v_conselho   text;
  v_registro   text;
  v_uf         text;
  v_papel      public.papel;
  v_sit        text;
  v_ufs constant text[] := ARRAY['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
                                 'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
BEGIN
  SELECT * INTO p FROM public.perfis WHERE id = p_perfil FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;

  IF coalesce(p_dados ->> 'termo_versao', '') <> private.termo_uso_versao() THEN
    RAISE EXCEPTION 'É preciso aceitar a versão vigente do termo de uso e sigilo.';
  END IF;

  -- via de chegada e papel
  IF v_convite <> '' THEN
    SELECT * INTO c FROM public.convites WHERE codigo = v_convite FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Convite não confere.'; END IF;
    v_sit := private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em);
    IF v_sit <> 'valido' THEN
      RAISE EXCEPTION 'Convite %.', CASE v_sit WHEN 'usado' THEN 'já usado' WHEN 'revogado' THEN 'revogado' ELSE 'expirado' END;
    END IF;
    v_papel := c.papel;
  ELSIF v_contrato <> '' THEN
    SELECT * INTO k FROM public.contratos_rede WHERE codigo = v_contrato FOR SHARE;
    IF NOT FOUND OR NOT k.ativo
       OR (k.vigente_ate IS NOT NULL AND k.vigente_ate < (now() AT TIME ZONE 'America/Sao_Paulo')::date)
       OR (k.dominio_email IS NOT NULL AND split_part(lower(coalesce(p_email, '')), '@', 2) <> k.dominio_email) THEN
      RAISE EXCEPTION 'Contrato não confere.';
    END IF;
    v_papel := k.papel_padrao;
  ELSE
    RAISE EXCEPTION 'Sem convite ou contrato não há acesso.';
  END IF;

  -- identidade: o que veio agora, ou o que o perfil já tinha
  v_nome     := coalesce(nullif(btrim(p_dados ->> 'nome_completo'), ''), p.nome_completo);
  v_cpf      := coalesce(nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), ''), p.cpf);
  v_nasc     := coalesce(nullif(p_dados ->> 'data_nascimento', '')::date, p.data_nascimento);
  v_conselho := coalesce(nullif(upper(btrim(p_dados ->> 'conselho')), ''), p.conselho);
  v_registro := coalesce(nullif(upper(regexp_replace(coalesce(p_dados ->> 'registro_numero', ''), '\s', '', 'g')), ''), p.registro_numero);
  v_uf       := coalesce(nullif(upper(btrim(p_dados ->> 'registro_uf')), ''), p.registro_uf);

  IF v_nome IS NULL OR length(v_nome) < 5 OR position(' ' IN v_nome) = 0 THEN
    RAISE EXCEPTION 'Informe o nome completo.';
  END IF;
  IF NOT private.convite_cpf_valido(v_cpf) THEN
    RAISE EXCEPTION 'CPF não confere.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.perfis o WHERE o.cpf = v_cpf AND o.id <> p_perfil) THEN
    RAISE EXCEPTION 'Este CPF já tem conta. Entre com ela e use o convite.';
  END IF;
  IF v_nasc IS NULL OR v_nasc > (current_date - interval '16 years') OR v_nasc < (current_date - interval '100 years') THEN
    RAISE EXCEPTION 'Data de nascimento não confere.';
  END IF;
  -- registro profissional: obrigatório para quem atua no paciente
  IF v_papel IN ('plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico') THEN
    IF v_conselho IS NULL OR v_registro IS NULL OR v_uf IS NULL THEN
      RAISE EXCEPTION 'Informe o registro profissional (conselho, número e UF).';
    END IF;
  END IF;
  IF v_conselho IS NOT NULL AND v_conselho NOT IN ('CRM', 'CRF', 'COREN') THEN
    RAISE EXCEPTION 'Conselho não reconhecido.';
  END IF;
  IF v_registro IS NOT NULL AND v_registro !~ '^[0-9A-Z.-]{2,15}$' THEN
    RAISE EXCEPTION 'Número do registro não confere.';
  END IF;
  IF v_uf IS NOT NULL AND NOT (v_uf = ANY (v_ufs)) THEN
    RAISE EXCEPTION 'UF do registro não confere.';
  END IF;

  UPDATE public.perfis SET
    nome_completo   = v_nome,
    cpf             = v_cpf,
    data_nascimento = v_nasc,
    conselho        = v_conselho,
    registro_numero = v_registro,
    registro_uf     = v_uf,
    -- médico: crm/uf_crm continuam coerentes com o registro
    crm             = CASE WHEN v_conselho = 'CRM' THEN v_registro ELSE crm END,
    uf_crm          = CASE WHEN v_conselho = 'CRM' THEN v_uf ELSE uf_crm END
  WHERE id = p_perfil;

  IF v_convite <> '' THEN
    INSERT INTO public.aceites_termo (perfil_id, versao, origem, referencia)
    VALUES (p_perfil, private.termo_uso_versao(), 'convite', c.id);

    INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
    VALUES (p_perfil, c.unidade_id, c.papel, true, c.criado_por)
    ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true, criado_por = EXCLUDED.criado_por;

    UPDATE public.convites SET usado_por = p_perfil, usado_em = now() WHERE id = c.id;

    INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
    VALUES (p_perfil, 'aceitar_convite', 'convites', c.id, c.unidade_id,
            private.payload_auditoria('convites', jsonb_build_object('papel', c.papel, 'perfil_id', p_perfil)));
    RETURN 'convite';
  END IF;

  INSERT INTO public.aceites_termo (perfil_id, versao, origem, referencia)
  VALUES (p_perfil, private.termo_uso_versao(), 'contrato', k.id);
  INSERT INTO public.adesoes_contrato (contrato_id, perfil_id, papel)
  VALUES (k.id, p_perfil, k.papel_padrao)
  ON CONFLICT (contrato_id, perfil_id) DO NOTHING;
  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (p_perfil, 'aderir_contrato', 'contratos_rede', k.id, NULL,
          private.payload_auditoria('contratos_rede', jsonb_build_object('papel', k.papel_padrao, 'perfil_id', p_perfil)));
  RETURN 'contrato';
END $$;
REVOKE ALL ON FUNCTION private.aplicar_primeiro_acesso(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 11. Preferências de aviso ───────────────────────────────────────────────
-- Núcleo: grava as chaves que vierem; observacao_6h é sempre ligada.
CREATE OR REPLACE FUNCTION private.gravar_preferencias_aviso(p_perfil uuid, p_preferencias jsonb, p_canal text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chave  text;
  v_ligado boolean;
  chaves constant text[] := ARRAY['observacao_6h', 'leito_novo', 'prescricao_devolvida',
                                  'item_abaixo_minimo', 'troca_plantao', 'fim_turno_30min'];
BEGIN
  IF coalesce(p_canal, '') NOT IN ('plataforma', 'aparelho') THEN
    RAISE EXCEPTION 'Canal de aviso não reconhecido.';
  END IF;
  IF p_preferencias IS NULL OR jsonb_typeof(p_preferencias) <> 'object' THEN
    RAISE EXCEPTION 'Preferências em formato inválido.';
  END IF;
  IF (p_preferencias ->> 'observacao_6h') = 'false' THEN
    RAISE EXCEPTION 'O aviso de observação acima de 6 horas não desliga.';
  END IF;

  FOREACH v_chave IN ARRAY chaves LOOP
    IF v_chave = 'observacao_6h' THEN
      v_ligado := true;
    ELSIF p_preferencias ? v_chave THEN
      v_ligado := (p_preferencias ->> v_chave)::boolean;
    ELSE
      CONTINUE;
    END IF;
    INSERT INTO public.preferencias_aviso (perfil_id, chave, ligado, canal, atualizado_em)
    VALUES (p_perfil, v_chave, v_ligado, p_canal, now())
    ON CONFLICT (perfil_id, chave) DO UPDATE
      SET ligado = EXCLUDED.ligado, canal = EXCLUDED.canal, atualizado_em = now();
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.gravar_preferencias_aviso(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- Só com sessão. No primeiro acesso as escolhas do passo 2 vão no próprio
-- signUp (metadado "avisos" / "canal_aviso") e o gatilho as grava.
DROP FUNCTION IF EXISTS public.salvar_preferencias_aviso(jsonb, text, uuid);
CREATE OR REPLACE FUNCTION public.salvar_preferencias_aviso(
  p_preferencias jsonb,
  p_canal        text DEFAULT 'plataforma')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para mudar os avisos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.gravar_preferencias_aviso(auth.uid(), p_preferencias, p_canal);
END $$;

-- ── 12. Gatilhos do signUp em auth.users ────────────────────────────────────
-- Dado pessoal não fica no metadado do Auth (ele vai para o token de acesso).
-- O Supabase Auth regrava raw_user_meta_data DEPOIS do INSERT (acrescenta
-- sub/email_verified), então apagar no AFTER INSERT não basta:
--   · BEFORE INSERT estaciona o metadado completo numa tabela privada e tira
--     dele as chaves pessoais;
--   · AFTER INSERT (depois de on_auth_user_created, por ordem alfabética, com
--     o perfil já criado) aplica o que estacionou e apaga o estacionamento;
--   · BEFORE UPDATE tira as chaves pessoais se alguém as recolocar.
-- Sem código de convite/contrato no metadado, nada acontece (seed e testes).
CREATE TABLE IF NOT EXISTS private.primeiro_acesso_pendente (
  user_id  uuid PRIMARY KEY,
  dados    jsonb NOT NULL,
  em       timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.primeiro_acesso_pendente FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.primeiro_acesso_chaves_pessoais()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY['cpf', 'data_nascimento', 'conselho', 'registro_numero', 'registro_uf', 'avisos', 'canal_aviso'];
$$;

CREATE OR REPLACE FUNCTION private.primeiro_acesso_estacionar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(NEW.raw_user_meta_data ->> 'codigo_convite', NEW.raw_user_meta_data ->> 'codigo_contrato', '') = '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO private.primeiro_acesso_pendente (user_id, dados)
  VALUES (NEW.id, NEW.raw_user_meta_data)
  ON CONFLICT (user_id) DO UPDATE SET dados = EXCLUDED.dados, em = now();
  NEW.raw_user_meta_data := NEW.raw_user_meta_data - private.primeiro_acesso_chaves_pessoais();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.primeiro_acesso_no_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb;
BEGIN
  DELETE FROM private.primeiro_acesso_pendente WHERE user_id = NEW.id RETURNING dados INTO v_dados;
  IF v_dados IS NULL THEN RETURN NEW; END IF;
  PERFORM private.aplicar_primeiro_acesso(NEW.id, NEW.email, v_dados);
  IF jsonb_typeof(v_dados -> 'avisos') = 'object' THEN
    PERFORM private.gravar_preferencias_aviso(NEW.id, v_dados -> 'avisos', coalesce(v_dados ->> 'canal_aviso', 'plataforma'));
  END IF;
  RETURN NEW;
END $$;

-- SECURITY DEFINER: quem atualiza auth.users é o papel do Auth
-- (supabase_auth_admin), que não tem acesso ao schema private.
CREATE OR REPLACE FUNCTION private.primeiro_acesso_limpar_metadado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.raw_user_meta_data ?| private.primeiro_acesso_chaves_pessoais() THEN
    NEW.raw_user_meta_data := NEW.raw_user_meta_data - private.primeiro_acesso_chaves_pessoais();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_primeiro_acesso_estacionar ON auth.users;
CREATE TRIGGER on_auth_user_primeiro_acesso_estacionar
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.primeiro_acesso_estacionar();

DROP TRIGGER IF EXISTS on_auth_user_created_primeiro_acesso ON auth.users;
CREATE TRIGGER on_auth_user_created_primeiro_acesso
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.primeiro_acesso_no_cadastro();

DROP TRIGGER IF EXISTS on_auth_user_primeiro_acesso_limpar ON auth.users;
CREATE TRIGGER on_auth_user_primeiro_acesso_limpar
  BEFORE UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.primeiro_acesso_limpar_metadado();

-- Quem já tem conta e recebeu convite para outra unidade/papel.
DROP FUNCTION IF EXISTS public.aceitar_convite(text, text, text, text, date, text, text, text);
CREATE OR REPLACE FUNCTION public.aceitar_convite(
  p_codigo          text,
  p_termo_versao    text,
  p_nome_completo   text DEFAULT NULL,
  p_cpf             text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_conselho        text DEFAULT NULL,
  p_registro_numero text DEFAULT NULL,
  p_registro_uf     text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF coalesce(btrim(p_codigo), '') = '' THEN
    RAISE EXCEPTION 'Convite não confere.';
  END IF;
  PERFORM private.aplicar_primeiro_acesso(
    auth.uid(),
    (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
    jsonb_strip_nulls(jsonb_build_object(
      'codigo_convite', p_codigo, 'termo_versao', p_termo_versao,
      'nome_completo', p_nome_completo, 'cpf', p_cpf, 'data_nascimento', p_data_nascimento,
      'conselho', p_conselho, 'registro_numero', p_registro_numero, 'registro_uf', p_registro_uf)));
END $$;

-- ── 13. Permissões das funções ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.gerar_convite(uuid, public.papel, uuid, text, timestamptz, timestamptz, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revogar_convite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convites_da_unidade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aceitar_convite(text, text, text, text, date, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_preferencias_aviso(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_convite(uuid, public.papel, uuid, text, timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_convite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convites_da_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_convite(text, text, text, text, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_preferencias_aviso(jsonb, text) TO authenticated;

-- Públicas de propósito (quem chega ainda não tem conta); constam da lista
-- de exceções de supabase/tests/fase0_rpcs.sql.
REVOKE ALL ON FUNCTION public.conferir_convite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pedir_novo_convite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conferir_contrato(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conferir_convite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_novo_convite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conferir_contrato(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION private.primeiro_acesso_bloqueado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.registrar_tentativa_primeiro_acesso() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.primeiro_acesso_estacionar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.primeiro_acesso_no_cadastro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.primeiro_acesso_limpar_metadado() FROM PUBLIC, anon, authenticated;
