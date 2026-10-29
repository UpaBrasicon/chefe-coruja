-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 5 (RNDS), etapa 5.4a: credenciais, cofre de certificados,
-- bloqueio por CBO, aviso de vencimento e as funções do painel
-- (decisões do RT de 28/10/2026, "todas a").
--
-- Credencial (rnds_credenciais): como o DATASUS, um certificado A1, um
--   identificador do solicitante e um ambiente cobrem a unidade principal e as
--   filhas da mesma UF. rnds_config_unidade.credencial_id liga cada unidade.
--   Ambiente e identificador da configuração antiga ficam como reserva (expand).
-- Cofre: o navegador cifra o .pfx e a senha com a chave pública do serviço no
--   VPS (RSA-OAEP-256 + AES-256-GCM). O banco guarda só o cifrado; a chave
--   privada existe só no VPS. O serviço publica a chave pública
--   (rnds_chaves_publicas) e devolve titular, documento e validade.
-- Bloqueio (rnds_bloqueios): a recusa ERR906/ERR879 bloqueia o profissional
--   (CNS) na unidade (ERR906: em todas as unidades da credencial). Os documentos
--   seguintes dele ficam retidos até o gestor desbloquear.
-- Avisos (sino, notificacoes_plantonista, tipos "rnds_…"): certificado a 30,
--   15, 7 e 1 dia do vencimento; vencido, recusado ou ilegível; profissional
--   bloqueado; credencial recusada pela RNDS. Certificado vencido pausa o envio.
-- Quem mexe: gestor das unidades (com 2FA e auditoria); passar a credencial
--   para a produção, só o super admin.
--
-- Rollback:
--   SELECT cron.unschedule('rnds-avisos-certificado');
--   DROP FUNCTION IF EXISTS public.rnds_chave_publica(), public.rnds_painel(uuid), public.rnds_itens(uuid, text, integer),
--     public.rnds_reenviar(uuid), public.rnds_salvar_config(uuid, text, boolean), public.rnds_retomar(uuid),
--     public.rnds_salvar_credencial(uuid, text, uuid, text, uuid[]), public.rnds_definir_ambiente(uuid, text),
--     public.rnds_enviar_certificado(uuid, jsonb), public.rnds_desbloquear(uuid),
--     public.rnds_registrar_chave_publica(text, jsonb), public.rnds_certificado_da_unidade(uuid),
--     public.rnds_registrar_certificado(uuid, text, text, text, timestamptz, text, text),
--     private.rnds_avisos_certificado(), private.rnds_avisar(uuid[], text, text),
--     private.rnds_unidades_da_credencial(uuid), private.rnds_pausar_credencial(uuid, text);
--   Reaplicar public.rnds_dados_documento e public.rnds_registrar_resultado: rodar de novo o arquivo
--   20270205000001_rnds_envio_banco.sql inteiro (é idempotente).
--   DROP TABLE IF EXISTS public.rnds_bloqueios, public.rnds_chaves_publicas;
--   ALTER TABLE public.rnds_config_unidade DROP COLUMN IF EXISTS credencial_id;
--   DROP TABLE IF EXISTS public.rnds_credenciais;
--   (a configuração antiga, com ambiente e identificador, continua valendo)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rnds_credenciais (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                      text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 80),
  unidade_principal_id      uuid NOT NULL REFERENCES public.unidades(id),
  ambiente                  text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  identificador_solicitante text CHECK (identificador_solicitante ~ '^[0-9A-Za-z]+$'),
  -- cofre: {versao, chave_id, chave, iv, dados}, tudo em base64; ninguém além do VPS abre
  certificado_cifrado       jsonb,
  certificado_enviado_em    timestamptz,
  certificado_enviado_por   uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- o que o serviço leu do certificado
  certificado_situacao      text NOT NULL DEFAULT 'sem_certificado'
                            CHECK (certificado_situacao IN ('sem_certificado', 'aguardando', 'valido', 'senha_incorreta',
                                                            'invalido', 'vencido', 'chave_trocada')),
  certificado_titular       text,
  certificado_documento     text,
  certificado_valido_ate    timestamptz,
  certificado_impressao     text,
  certificado_lido_em       timestamptz,
  certificado_erro          text,
  criada_em                 timestamptz NOT NULL DEFAULT now(),
  criada_por                uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  atualizada_em             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rnds_credenciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rnds_credenciais FROM anon, authenticated;

ALTER TABLE public.rnds_config_unidade
  ADD COLUMN IF NOT EXISTS credencial_id uuid REFERENCES public.rnds_credenciais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rnds_config_unidade_credencial_idx ON public.rnds_config_unidade (credencial_id);

-- a chave pública do serviço no VPS; só uma ativa
CREATE TABLE IF NOT EXISTS public.rnds_chaves_publicas (
  id        text PRIMARY KEY CHECK (id ~ '^[0-9A-Za-z_-]{8,64}$'),
  jwk       jsonb NOT NULL CHECK (jwk ->> 'kty' = 'RSA' AND jwk ? 'n' AND jwk ? 'e' AND NOT jwk ? 'd'),
  ativa     boolean NOT NULL DEFAULT true,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rnds_chaves_publicas_uma_ativa ON public.rnds_chaves_publicas (ativa) WHERE ativa;
ALTER TABLE public.rnds_chaves_publicas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rnds_chaves_publicas FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rnds_bloqueios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  cns              text NOT NULL CHECK (cns ~ '^[0-9]{15}$'),
  profissional_id  uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  codigo           text NOT NULL,
  mensagem         text,
  item_id          uuid REFERENCES public.interop_outbox(id) ON DELETE SET NULL,
  bloqueado_em     timestamptz NOT NULL DEFAULT now(),
  desbloqueado_em  timestamptz,
  desbloqueado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rnds_bloqueios_ativo ON public.rnds_bloqueios (unidade_id, cns) WHERE desbloqueado_em IS NULL;
ALTER TABLE public.rnds_bloqueios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rnds_bloqueios FROM anon, authenticated;

-- ── 2. Apoio ────────────────────────────────────────────────────────────────
-- a principal e as filhas (as unidades cuja configuração aponta a credencial)
CREATE OR REPLACE FUNCTION private.rnds_unidades_da_credencial(p_credencial uuid)
RETURNS uuid[] LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT array(SELECT DISTINCT u FROM (
    SELECT c.unidade_principal_id AS u FROM public.rnds_credenciais c WHERE c.id = p_credencial
    UNION SELECT g.unidade_id FROM public.rnds_config_unidade g WHERE g.credencial_id = p_credencial) x)
$$;

-- aviso no sino aos gestores das unidades; o mesmo aviso no mesmo dia não repete
CREATE OR REPLACE FUNCTION private.rnds_avisar(p_unidades uuid[], p_tipo text, p_mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT ON (v.perfil_id, v.unidade_id) v.perfil_id, v.unidade_id, current_date, p_tipo, p_mensagem
    FROM public.vinculos v
   WHERE v.unidade_id = ANY (p_unidades) AND v.papel = 'gestor'
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now()
$$;

CREATE OR REPLACE FUNCTION private.rnds_pausar_credencial(p_credencial uuid, p_motivo text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.rnds_config_unidade SET pausado_em = now(), pausa_motivo = p_motivo, atualizado_em = now()
   WHERE credencial_id = p_credencial AND pausado_em IS NULL
$$;

-- ── 3. Carga e resultado: credencial e bloqueio ─────────────────────────────
CREATE OR REPLACE FUNCTION public.rnds_dados_documento(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.interop_outbox;
  c public.rnds_config_unidade;
  k public.rnds_credenciais;
  v_dados jsonb;
  v_prof uuid;
  v_cns text;
  v_uf text;
  v_anterior text;
  v_bloqueio public.rnds_bloqueios;
BEGIN
  SELECT * INTO o FROM public.interop_outbox WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'item % não encontrado', p_item; END IF;
  SELECT * INTO c FROM public.rnds_config_unidade WHERE unidade_id = o.unidade_id;
  SELECT * INTO k FROM public.rnds_credenciais WHERE id = c.credencial_id;
  SELECT u.uf INTO v_uf FROM public.unidades u WHERE u.id = o.unidade_id;

  IF o.tipo_documento = 'rac' THEN
    v_dados := private.rnds_carga_rac(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;
  ELSIF o.tipo_documento = 'sumario_alta' THEN
    v_dados := private.rnds_carga_sa(o.referencia_id);
    v_prof := nullif(v_dados -> 'profissional' ->> 'id', '')::uuid;
  ELSE
    v_dados := o.payload -> 'mira';
    IF v_dados IS NULL THEN RAISE EXCEPTION 'item de regulação sem o retrato MIRA'; END IF;
    v_prof := o.profissional_id;
  END IF;
  v_cns := private.rnds_carga_profissional(v_prof) ->> 'cns';

  SELECT * INTO v_bloqueio FROM public.rnds_bloqueios b
   WHERE b.unidade_id = o.unidade_id AND b.cns = v_cns AND b.desbloqueado_em IS NULL;
  IF FOUND THEN
    RAISE EXCEPTION 'retido: profissional bloqueado pela RNDS (%) desde %; o gestor desbloqueia depois de acertar o CNES',
      v_bloqueio.codigo, to_char(v_bloqueio.bloqueado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  END IF;

  SELECT x.id_rnds INTO v_anterior FROM public.interop_outbox x
   WHERE x.tipo_documento = o.tipo_documento AND x.referencia_id = o.referencia_id
     AND x.status = 'enviado' AND x.id_rnds IS NOT NULL AND x.id <> o.id
   ORDER BY x.enviado_em DESC LIMIT 1;

  RETURN jsonb_build_object(
    'item_id', o.id,
    'tipo', o.tipo_documento,
    'dados', v_dados,
    'envio', jsonb_build_object(
      'credencial_id', k.id,
      'ambiente', coalesce(k.ambiente, c.ambiente),
      'uf', v_uf,
      'identificador_solicitante', coalesce(k.identificador_solicitante, c.identificador_solicitante),
      'id_rnds_anterior', v_anterior,
      'profissional_id', v_prof,
      'profissional_cns', v_cns));
END;
$$;

-- Como na 5.3a, e mais: ERR906/ERR879 bloqueia o profissional; credencial
-- recusada avisa os gestores.
CREATE OR REPLACE FUNCTION public.rnds_registrar_resultado(
  p_item uuid, p_resultado text, p_id_rnds text DEFAULT NULL,
  p_bundle jsonb DEFAULT NULL, p_resposta jsonb DEFAULT NULL, p_erro text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.interop_outbox;
  v_status text;
  v_codigo text;
  v_cns text;
  v_prof uuid;
  v_credencial uuid;
  v_unidades uuid[];
  v_nome text;
BEGIN
  SELECT * INTO o FROM public.interop_outbox WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item % não encontrado', p_item; END IF;
  IF o.status NOT IN ('pendente', 'retido') THEN
    RAISE EXCEPTION 'item % está %, não aceita resultado', p_item, o.status;
  END IF;

  IF p_resultado = 'enviado' THEN
    IF nullif(p_id_rnds, '') IS NULL THEN RAISE EXCEPTION 'enviado sem o id da RNDS'; END IF;
    UPDATE public.interop_outbox
       SET status = 'enviado', id_rnds = p_id_rnds, enviado_em = now(), tentativas = tentativas + 1,
           bundle_enviado = p_bundle, resposta = p_resposta, ultimo_erro = NULL,
           proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'enviado';
  ELSIF p_resultado = 'retido' THEN
    UPDATE public.interop_outbox
       SET status = 'retido', ultimo_erro = p_erro, proxima_tentativa_em = now() + interval '1 hour',
           travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'retido';
  ELSIF p_resultado = 'reenviar' THEN
    v_status := CASE WHEN o.tentativas + 1 >= 30 THEN 'erro' ELSE 'pendente' END;
    UPDATE public.interop_outbox
       SET status = v_status, tentativas = tentativas + 1, bundle_enviado = coalesce(p_bundle, bundle_enviado),
           resposta = p_resposta,
           ultimo_erro = CASE WHEN v_status = 'erro' THEN 'sem resposta da RNDS depois de 30 tentativas: ' || coalesce(p_erro, '')
                              ELSE p_erro END,
           proxima_tentativa_em = CASE WHEN v_status = 'pendente'
                                       THEN now() + least(interval '1 minute' * power(2, o.tentativas), interval '1 hour') END,
           travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
  ELSIF p_resultado = 'erro' THEN
    UPDATE public.interop_outbox
       SET status = 'erro', tentativas = tentativas + 1, bundle_enviado = p_bundle, resposta = p_resposta,
           ultimo_erro = p_erro, proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    v_status := 'erro';

    -- profissional sem CBO autorizado no CNES: bloqueia (ERR906 vale para toda a credencial)
    v_codigo := substring(coalesce(p_erro, '') FROM 'ERR(906|879)');
    IF v_codigo IS NOT NULL THEN
      BEGIN
        IF o.tipo_documento = 'regulacao' THEN
          v_prof := o.profissional_id;
        ELSIF o.tipo_documento = 'rac' THEN
          v_prof := nullif(private.rnds_carga_rac(o.referencia_id) -> 'profissional' ->> 'id', '')::uuid;
        ELSE
          v_prof := nullif(private.rnds_carga_sa(o.referencia_id) -> 'profissional' ->> 'id', '')::uuid;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_prof := NULL;
      END;
      v_cns := private.rnds_carga_profissional(v_prof) ->> 'cns';
      IF v_cns IS NOT NULL THEN
        SELECT g.credencial_id INTO v_credencial FROM public.rnds_config_unidade g WHERE g.unidade_id = o.unidade_id;
        v_unidades := CASE WHEN v_codigo = '906' AND v_credencial IS NOT NULL
                           THEN private.rnds_unidades_da_credencial(v_credencial) ELSE ARRAY[o.unidade_id] END;
        INSERT INTO public.rnds_bloqueios (unidade_id, cns, profissional_id, codigo, mensagem, item_id)
        SELECT u, v_cns, v_prof, 'ERR' || v_codigo, left(p_erro, 500), CASE WHEN u = o.unidade_id THEN o.id END
          FROM unnest(v_unidades) u
        ON CONFLICT (unidade_id, cns) WHERE desbloqueado_em IS NULL DO NOTHING;
        SELECT f.nome_completo INTO v_nome FROM public.perfis f WHERE f.id = v_prof;
        PERFORM private.rnds_avisar(v_unidades, 'rnds_bloqueio_' || left(md5(v_cns), 8),
          'RNDS: ' || coalesce(v_nome, 'um profissional') || ' foi bloqueado (ERR' || v_codigo
          || ': sem CBO autorizado no CNES). Os documentos dele ficam retidos até o CNES ser acertado e o bloqueio ser tirado em Integrações > RNDS.');
      END IF;
    END IF;
  ELSIF p_resultado = 'credencial' THEN
    UPDATE public.interop_outbox
       SET status = 'pendente', resposta = p_resposta, ultimo_erro = p_erro,
           proxima_tentativa_em = NULL, travado_ate = NULL, atualizado_em = now()
     WHERE id = p_item;
    UPDATE public.rnds_config_unidade
       SET pausado_em = now(), pausa_motivo = coalesce(p_erro, 'credencial recusada pela RNDS'), atualizado_em = now()
     WHERE unidade_id = o.unidade_id AND pausado_em IS NULL;
    IF FOUND THEN
      PERFORM private.rnds_avisar(ARRAY[o.unidade_id], 'rnds_pausa',
        'RNDS: o envio da unidade parou porque a RNDS recusou a credencial ou o certificado. Confira o certificado em Integrações > RNDS e retome.');
    END IF;
    v_status := 'pendente';
  ELSE
    RAISE EXCEPTION 'resultado desconhecido: %', p_resultado;
  END IF;
  RETURN v_status;
END;
$$;

-- ── 4. Funções do serviço (chave de serviço) ────────────────────────────────
-- O serviço publica a chave pública ao subir. Chave nova torna ilegíveis os
-- certificados cifrados com a antiga: o gestor precisa enviar de novo.
CREATE OR REPLACE FUNCTION public.rnds_registrar_chave_publica(p_id text, p_jwk jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rnds_chaves_publicas WHERE id = p_id AND ativa) THEN RETURN; END IF;
  UPDATE public.rnds_chaves_publicas SET ativa = false WHERE ativa;
  INSERT INTO public.rnds_chaves_publicas (id, jwk, ativa) VALUES (p_id, p_jwk, true)
  ON CONFLICT (id) DO UPDATE SET jwk = excluded.jwk, ativa = true;
  UPDATE public.rnds_credenciais
     SET certificado_situacao = 'chave_trocada', atualizada_em = now()
   WHERE certificado_cifrado IS NOT NULL AND certificado_cifrado ->> 'chave_id' IS DISTINCT FROM p_id
     AND certificado_situacao <> 'chave_trocada';
END;
$$;

CREATE OR REPLACE FUNCTION public.rnds_certificado_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('credencial_id', k.id, 'certificado_cifrado', k.certificado_cifrado,
                            'situacao', k.certificado_situacao, 'impressao', k.certificado_impressao)
    FROM public.rnds_config_unidade g JOIN public.rnds_credenciais k ON k.id = g.credencial_id
   WHERE g.unidade_id = p_unidade AND k.certificado_cifrado IS NOT NULL
$$;

-- o que o serviço leu do certificado; o que não presta avisa os gestores
CREATE OR REPLACE FUNCTION public.rnds_registrar_certificado(
  p_credencial uuid, p_situacao text, p_titular text DEFAULT NULL, p_documento text DEFAULT NULL,
  p_valido_ate timestamptz DEFAULT NULL, p_impressao text DEFAULT NULL, p_erro text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  k public.rnds_credenciais;
  v_situacao text := CASE WHEN p_situacao = 'valido' AND p_valido_ate <= now() THEN 'vencido' ELSE p_situacao END;
BEGIN
  SELECT * INTO k FROM public.rnds_credenciais WHERE id = p_credencial FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credencial % não encontrada', p_credencial; END IF;
  IF v_situacao NOT IN ('valido', 'senha_incorreta', 'invalido', 'vencido', 'chave_trocada') THEN
    RAISE EXCEPTION 'situação desconhecida: %', p_situacao;
  END IF;
  -- nada muda se é o mesmo certificado já lido
  IF k.certificado_situacao = v_situacao AND k.certificado_impressao IS NOT DISTINCT FROM p_impressao THEN RETURN; END IF;
  UPDATE public.rnds_credenciais
     SET certificado_situacao = v_situacao, certificado_titular = p_titular, certificado_documento = p_documento,
         certificado_valido_ate = p_valido_ate, certificado_impressao = p_impressao,
         certificado_lido_em = now(), certificado_erro = left(p_erro, 500), atualizada_em = now()
   WHERE id = p_credencial;
  IF v_situacao = 'vencido' THEN
    PERFORM private.rnds_pausar_credencial(p_credencial, 'certificado vencido em '
      || to_char(p_valido_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'));
  END IF;
  IF v_situacao <> 'valido' THEN
    PERFORM private.rnds_avisar(private.rnds_unidades_da_credencial(p_credencial),
      'rnds_certificado_' || v_situacao || '_' || left(p_credencial::text, 8),
      'RNDS: o certificado da credencial "' || k.nome || '" ' || CASE v_situacao
        WHEN 'senha_incorreta' THEN 'não abriu com a senha informada'
        WHEN 'vencido' THEN 'venceu; o envio parou'
        WHEN 'chave_trocada' THEN 'precisa ser enviado de novo (a chave do serviço mudou)'
        ELSE 'não pôde ser lido' END || '. Envie o certificado em Integrações > RNDS.');
  END IF;
END;
$$;

-- ── 5. Aviso de vencimento (08:00 de Brasília) ──────────────────────────────
CREATE OR REPLACE FUNCTION private.rnds_avisos_certificado()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  k public.rnds_credenciais;
  v_dias integer;
  v_avisos integer := 0;
BEGIN
  FOR k IN SELECT * FROM public.rnds_credenciais
            WHERE certificado_situacao = 'valido' AND certificado_valido_ate IS NOT NULL FOR UPDATE LOOP
    v_dias := (k.certificado_valido_ate AT TIME ZONE 'America/Sao_Paulo')::date - (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    IF k.certificado_valido_ate <= now() THEN
      UPDATE public.rnds_credenciais SET certificado_situacao = 'vencido', atualizada_em = now() WHERE id = k.id;
      PERFORM private.rnds_pausar_credencial(k.id, 'certificado vencido em '
        || to_char(k.certificado_valido_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'));
      PERFORM private.rnds_avisar(private.rnds_unidades_da_credencial(k.id), 'rnds_certificado_vencido_' || left(k.id::text, 8),
        'RNDS: o certificado da credencial "' || k.nome || '" venceu; o envio parou. Envie o certificado novo em Integrações > RNDS.');
      v_avisos := v_avisos + 1;
    ELSIF v_dias IN (30, 15, 7, 1) THEN
      PERFORM private.rnds_avisar(private.rnds_unidades_da_credencial(k.id), 'rnds_certificado_' || v_dias || 'd_' || left(k.id::text, 8),
        'RNDS: o certificado da credencial "' || k.nome || '" vence em ' || v_dias
        || CASE WHEN v_dias = 1 THEN ' dia' ELSE ' dias' END || ' ('
        || to_char(k.certificado_valido_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
        || '). Envie o certificado renovado em Integrações > RNDS.');
      v_avisos := v_avisos + 1;
    END IF;
  END LOOP;
  RETURN v_avisos;
END;
$$;

-- ── 6. Funções do painel (gestor das unidades; 2FA; auditoria) ──────────────
CREATE OR REPLACE FUNCTION public.rnds_chave_publica()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', c.id, 'jwk', c.jwk) FROM public.rnds_chaves_publicas c WHERE c.ativa
$$;

CREATE OR REPLACE FUNCTION public.rnds_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.rnds_config_unidade;
  k public.rnds_credenciais;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê a RNDS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO g FROM public.rnds_config_unidade WHERE unidade_id = p_unidade;
  SELECT * INTO k FROM public.rnds_credenciais WHERE id = g.credencial_id;
  RETURN jsonb_build_object(
    'pode_producao', private.eh_super_admin(),
    'config', CASE WHEN g.unidade_id IS NULL THEN NULL ELSE jsonb_build_object(
      'financiamento', g.financiamento, 'envio_ligado', g.envio_ligado,
      'pausado_em', g.pausado_em, 'pausa_motivo', g.pausa_motivo, 'atualizado_em', g.atualizado_em) END,
    'credencial', CASE WHEN k.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', k.id, 'nome', k.nome, 'ambiente', k.ambiente, 'identificador_solicitante', k.identificador_solicitante,
      'unidade_principal_id', k.unidade_principal_id,
      'unidades', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes) ORDER BY u.nome), '[]')
                     FROM public.unidades u WHERE u.id = ANY (private.rnds_unidades_da_credencial(k.id))),
      'certificado', jsonb_build_object(
        'situacao', k.certificado_situacao, 'titular', k.certificado_titular, 'documento', k.certificado_documento,
        'valido_ate', k.certificado_valido_ate, 'enviado_em', k.certificado_enviado_em, 'lido_em', k.certificado_lido_em,
        'erro', k.certificado_erro)) END,
    'contagem', (SELECT coalesce(jsonb_object_agg(s.status, s.n), '{}') FROM (
      SELECT o.status, count(*) AS n FROM public.interop_outbox o WHERE o.unidade_id = p_unidade GROUP BY o.status) s),
    'bloqueios', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'profissional', f.nome_completo, 'codigo', b.codigo, 'mensagem', b.mensagem, 'bloqueado_em', b.bloqueado_em)
        ORDER BY b.bloqueado_em DESC), '[]')
      FROM public.rnds_bloqueios b LEFT JOIN public.perfis f ON f.id = b.profissional_id
     WHERE b.unidade_id = p_unidade AND b.desbloqueado_em IS NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.rnds_itens(p_unidade uuid, p_status text DEFAULT NULL, p_limite integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade vê a RNDS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'tipo', o.tipo_documento, 'referencia_id', o.referencia_id, 'status', o.status,
      'tentativas', o.tentativas, 'ultimo_erro', o.ultimo_erro, 'criado_em', o.created_at,
      'enviado_em', o.enviado_em, 'proxima_tentativa_em', o.proxima_tentativa_em, 'id_rnds', o.id_rnds)
      ORDER BY o.created_at DESC)
    FROM (SELECT * FROM public.interop_outbox x
           WHERE x.unidade_id = p_unidade AND (p_status IS NULL OR x.status = p_status)
           ORDER BY x.created_at DESC LIMIT greatest(1, least(coalesce(p_limite, 50), 200))) o), '[]');
END;
$$;

-- erro volta à fila; retido tenta agora
CREATE OR REPLACE FUNCTION public.rnds_reenviar(p_item uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.interop_outbox;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO o FROM public.interop_outbox WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(o.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade reenvia.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF o.status NOT IN ('erro', 'retido') THEN RAISE EXCEPTION 'Só item com erro ou retido volta à fila.'; END IF;
  UPDATE public.interop_outbox
     SET status = CASE WHEN o.status = 'erro' THEN 'pendente' ELSE 'retido' END,
         tentativas = CASE WHEN o.status = 'erro' THEN 0 ELSE tentativas END,
         proxima_tentativa_em = now(), travado_ate = NULL, atualizado_em = now()
   WHERE id = p_item;
  PERFORM private.registrar_auditoria('rnds_item_reenviado', 'interop_outbox', o.id, o.unidade_id,
    jsonb_build_object('tipo', o.tipo_documento, 'status', o.status));
  RETURN CASE WHEN o.status = 'erro' THEN 'pendente' ELSE 'retido' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.rnds_salvar_config(p_unidade uuid, p_financiamento text, p_envio_ligado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.rnds_config_unidade;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade configura a RNDS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_financiamento IS NOT NULL AND p_financiamento NOT IN ('01', '02', '03', '04', '05', '06', '07', '08') THEN
    RAISE EXCEPTION 'Financiamento fora da tabela da RNDS.';
  END IF;
  SELECT * INTO g FROM public.rnds_config_unidade WHERE unidade_id = p_unidade;
  IF p_envio_ligado AND (g.credencial_id IS NULL OR p_financiamento IS NULL) THEN
    RAISE EXCEPTION 'Para ligar o envio, a unidade precisa de uma credencial e do financiamento.';
  END IF;
  INSERT INTO public.rnds_config_unidade (unidade_id, financiamento, envio_ligado, atualizado_por)
  VALUES (p_unidade, p_financiamento, coalesce(p_envio_ligado, false), private.meu_perfil_id())
  ON CONFLICT (unidade_id) DO UPDATE
    SET financiamento = excluded.financiamento, envio_ligado = excluded.envio_ligado,
        atualizado_por = excluded.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('rnds_config_salva', 'rnds_config_unidade', p_unidade, p_unidade,
    jsonb_build_object('ativo', coalesce(p_envio_ligado, false), 'tipo', p_financiamento));
END;
$$;

CREATE OR REPLACE FUNCTION public.rnds_retomar(p_unidade uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade retoma o envio.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.rnds_config_unidade SET pausado_em = NULL, pausa_motivo = NULL, atualizado_em = now(),
         atualizado_por = private.meu_perfil_id()
   WHERE unidade_id = p_unidade AND pausado_em IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'O envio desta unidade não está pausado.'; END IF;
  PERFORM private.registrar_auditoria('rnds_envio_retomado', 'rnds_config_unidade', p_unidade, p_unidade, NULL);
END;
$$;

-- Cria ou altera a credencial: a principal e as filhas, todas da mesma UF e de
-- quem as gerencia. A credencial nasce na homologação.
CREATE OR REPLACE FUNCTION public.rnds_salvar_credencial(
  p_credencial uuid, p_nome text, p_unidade_principal uuid, p_identificador text, p_unidades uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := p_credencial;
  v_todas uuid[] := array(SELECT DISTINCT u FROM unnest(coalesce(p_unidades, '{}') || p_unidade_principal) u WHERE u IS NOT NULL);
  v_uf text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade_principal IS NULL THEN RAISE EXCEPTION 'Escolha a unidade principal da credencial.'; END IF;
  IF NOT private.eh_super_admin() AND EXISTS (SELECT 1 FROM unnest(v_todas) u WHERE NOT private.tenho_papel(u, 'gestor')) THEN
    RAISE EXCEPTION 'Só quem é gestor de todas as unidades monta a credencial.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_nome, ''))) < 3 THEN RAISE EXCEPTION 'Dê um nome à credencial.'; END IF;
  IF p_identificador IS NOT NULL AND p_identificador !~ '^[0-9A-Za-z]+$' THEN
    RAISE EXCEPTION 'O identificador do solicitante tem só letras e números.';
  END IF;
  SELECT uf INTO v_uf FROM public.unidades WHERE id = p_unidade_principal;
  IF v_uf IS NULL THEN RAISE EXCEPTION 'A unidade principal precisa da UF.'; END IF;
  IF EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = ANY (v_todas) AND u.uf IS DISTINCT FROM v_uf) THEN
    RAISE EXCEPTION 'As unidades filhas têm de ser da mesma UF da principal (regra da RNDS).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rnds_config_unidade g
              WHERE g.unidade_id = ANY (v_todas) AND g.credencial_id IS NOT NULL AND g.credencial_id IS DISTINCT FROM v_id) THEN
    RAISE EXCEPTION 'Uma das unidades já está em outra credencial.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.rnds_credenciais (nome, unidade_principal_id, identificador_solicitante, criada_por)
    VALUES (btrim(p_nome), p_unidade_principal, nullif(btrim(p_identificador), ''), private.meu_perfil_id())
    RETURNING id INTO v_id;
  ELSE
    IF NOT private.eh_super_admin() AND EXISTS (
      SELECT 1 FROM unnest(private.rnds_unidades_da_credencial(v_id)) u WHERE NOT private.tenho_papel(u, 'gestor')) THEN
      RAISE EXCEPTION 'Só quem é gestor de todas as unidades da credencial a altera.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    UPDATE public.rnds_credenciais SET nome = btrim(p_nome), unidade_principal_id = p_unidade_principal,
           identificador_solicitante = nullif(btrim(p_identificador), ''), atualizada_em = now()
     WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credencial não encontrada.'; END IF;
    -- quem saiu da lista deixa a credencial e para de enviar
    UPDATE public.rnds_config_unidade SET credencial_id = NULL, envio_ligado = false, atualizado_em = now()
     WHERE credencial_id = v_id AND NOT (unidade_id = ANY (v_todas));
  END IF;
  INSERT INTO public.rnds_config_unidade (unidade_id, credencial_id, atualizado_por)
  SELECT u, v_id, private.meu_perfil_id() FROM unnest(v_todas) u
  ON CONFLICT (unidade_id) DO UPDATE SET credencial_id = excluded.credencial_id, atualizado_em = now();
  PERFORM private.registrar_auditoria('rnds_credencial_salva', 'rnds_credenciais', v_id, p_unidade_principal,
    jsonb_build_object('quantidade', cardinality(v_todas)));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rnds_definir_ambiente(p_credencial uuid, p_ambiente text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k public.rnds_credenciais;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma muda o ambiente da credencial.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_ambiente NOT IN ('homologacao', 'producao') THEN RAISE EXCEPTION 'Ambiente desconhecido.'; END IF;
  UPDATE public.rnds_credenciais SET ambiente = p_ambiente, atualizada_em = now() WHERE id = p_credencial RETURNING * INTO k;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credencial não encontrada.'; END IF;
  PERFORM private.registrar_auditoria('rnds_ambiente_definido', 'rnds_credenciais', k.id, k.unidade_principal_id,
    jsonb_build_object('tipo', p_ambiente));
END;
$$;

-- O certificado chega cifrado pelo navegador com a chave pública ativa.
CREATE OR REPLACE FUNCTION public.rnds_enviar_certificado(p_credencial uuid, p_cifrado jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k public.rnds_credenciais;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO k FROM public.rnds_credenciais WHERE id = p_credencial FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credencial não encontrada.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(k.unidade_principal_id, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade principal envia o certificado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_typeof(p_cifrado) IS DISTINCT FROM 'object' OR (p_cifrado ->> 'versao') IS DISTINCT FROM '1'
     OR NOT (p_cifrado ?& ARRAY['chave_id', 'chave', 'iv', 'dados'])
     OR length(p_cifrado::text) > 200000 THEN
    RAISE EXCEPTION 'Certificado cifrado em formato inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rnds_chaves_publicas c WHERE c.ativa AND c.id = p_cifrado ->> 'chave_id') THEN
    RAISE EXCEPTION 'A chave do serviço mudou; recarregue a página e envie de novo.';
  END IF;
  UPDATE public.rnds_credenciais
     SET certificado_cifrado = p_cifrado, certificado_enviado_em = now(), certificado_enviado_por = private.meu_perfil_id(),
         certificado_situacao = 'aguardando', certificado_titular = NULL, certificado_documento = NULL,
         certificado_valido_ate = NULL, certificado_impressao = NULL, certificado_lido_em = NULL,
         certificado_erro = NULL, atualizada_em = now()
   WHERE id = k.id;
  PERFORM private.registrar_auditoria('rnds_certificado_enviado', 'rnds_credenciais', k.id, k.unidade_principal_id, NULL);
END;
$$;

-- Tira o bloqueio do profissional nas unidades da credencial; o documento que
-- causou o bloqueio volta à fila e os retidos tentam agora.
CREATE OR REPLACE FUNCTION public.rnds_desbloquear(p_bloqueio uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b public.rnds_bloqueios;
  v_unidades uuid[];
  v_credencial uuid;
  v_n integer;
  v_itens uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO b FROM public.rnds_bloqueios WHERE id = p_bloqueio AND desbloqueado_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bloqueio não encontrado ou já tirado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.tenho_papel(b.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Só o gestor da unidade tira o bloqueio.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT credencial_id INTO v_credencial FROM public.rnds_config_unidade WHERE unidade_id = b.unidade_id;
  v_unidades := CASE WHEN v_credencial IS NULL THEN ARRAY[b.unidade_id]
                     ELSE private.rnds_unidades_da_credencial(v_credencial) END;
  WITH tirados AS (
    UPDATE public.rnds_bloqueios SET desbloqueado_em = now(), desbloqueado_por = private.meu_perfil_id()
     WHERE cns = b.cns AND desbloqueado_em IS NULL
       AND unidade_id = ANY (array(SELECT u FROM unnest(v_unidades) u WHERE private.eh_super_admin() OR private.tenho_papel(u, 'gestor')))
    RETURNING item_id)
  SELECT count(*), array_agg(item_id) FILTER (WHERE item_id IS NOT NULL) INTO v_n, v_itens FROM tirados;
  UPDATE public.interop_outbox SET status = 'pendente', tentativas = 0, proxima_tentativa_em = now(), atualizado_em = now()
   WHERE id = ANY (coalesce(v_itens, '{}')) AND status = 'erro';
  UPDATE public.interop_outbox SET proxima_tentativa_em = now(), atualizado_em = now()
   WHERE unidade_id = ANY (v_unidades) AND status = 'retido' AND ultimo_erro LIKE 'retido: profissional bloqueado pela RNDS%';
  PERFORM private.registrar_auditoria('rnds_bloqueio_tirado', 'rnds_bloqueios', b.id, b.unidade_id,
    jsonb_build_object('quantidade', v_n));
  RETURN v_n;
END;
$$;

-- ── 7. Permissões ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.rnds_unidades_da_credencial(uuid), private.rnds_avisar(uuid[], text, text),
  private.rnds_pausar_credencial(uuid, text), private.rnds_avisos_certificado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rnds_registrar_chave_publica(text, jsonb), public.rnds_certificado_da_unidade(uuid),
  public.rnds_registrar_certificado(uuid, text, text, text, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rnds_registrar_chave_publica(text, jsonb), public.rnds_certificado_da_unidade(uuid),
  public.rnds_registrar_certificado(uuid, text, text, text, timestamptz, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.rnds_chave_publica(), public.rnds_painel(uuid), public.rnds_itens(uuid, text, integer),
  public.rnds_reenviar(uuid), public.rnds_salvar_config(uuid, text, boolean), public.rnds_retomar(uuid),
  public.rnds_salvar_credencial(uuid, text, uuid, text, uuid[]), public.rnds_definir_ambiente(uuid, text),
  public.rnds_enviar_certificado(uuid, jsonb), public.rnds_desbloquear(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rnds_chave_publica(), public.rnds_painel(uuid), public.rnds_itens(uuid, text, integer),
  public.rnds_reenviar(uuid), public.rnds_salvar_config(uuid, text, boolean), public.rnds_retomar(uuid),
  public.rnds_salvar_credencial(uuid, text, uuid, text, uuid[]), public.rnds_definir_ambiente(uuid, text),
  public.rnds_enviar_certificado(uuid, jsonb), public.rnds_desbloquear(uuid) TO authenticated;

-- 08:00 em Brasília (11:00 UTC)
SELECT cron.schedule('rnds-avisos-certificado', '0 11 * * *', 'SELECT private.rnds_avisos_certificado();');
