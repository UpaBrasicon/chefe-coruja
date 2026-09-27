-- Fase 3.6 — alta com impeditivos, cancelamento de alta e pacote de alta.
--
-- Regras (ESTADO.md 26/09, Etapa 12, e 27/08 item 1):
--  * impede a alta: documento do PEP aberto (rascunho), parecer sem resposta
--    ou pendência marcada como impeditiva, passagem de plantão aguardando aceite;
--  * CID de alta obrigatório; alta com hora mais de 30 min no passado é
--    retroativa e exige justificativa; óbito pede o número da DO;
--  * cancelar alta: justificativa de 10 letras ou mais, até 24h, por quem deu
--    a alta ou pelo gestor; o paciente volta ao censo;
--  * pacote de alta: link + código de 6 dígitos impressos na orientação de
--    alta (SMS/WhatsApp ainda não configurados — decisão de 26/09/2026). O
--    código é pedido a cada abertura; três erros bloqueiam o link; validade
--    de 30 dias; quem monta é o plantonista; o gestor também revoga.

ALTER TABLE public.internacoes
  ADD COLUMN IF NOT EXISTS cid_alta text,
  ADD COLUMN IF NOT EXISTS alta_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS alta_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS alta_justificativa_retroativa text,
  ADD COLUMN IF NOT EXISTS alta_observacoes text,
  ADD COLUMN IF NOT EXISTS alta_detalhes jsonb;

ALTER TABLE public.alta_paciente DROP CONSTRAINT IF EXISTS alta_paciente_status_check;
ALTER TABLE public.alta_paciente ADD CONSTRAINT alta_paciente_status_check CHECK (status IN ('em_alta', 'concluida', 'cancelada'));

-- ── impeditivos ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.impeditivos_alta(p_internacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'tipo'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('tipo', CASE WHEN p.tipo = 'parecer' THEN 'parecer' ELSE 'pendencia' END,
                              'id', p.id,
                              'descricao', CASE WHEN p.tipo = 'parecer' THEN 'Parecer sem resposta: ' ELSE 'Pendência impeditiva: ' END || p.descricao) x
      FROM public.pendencias p
     WHERE p.internacao_id = p_internacao AND p.situacao = 'aberta' AND p.impeditiva
    UNION ALL
    SELECT jsonb_build_object('tipo', 'documento', 'id', d.id,
                              'descricao', 'Documento do PEP aberto (rascunho): ' || replace(d.tipo_documento, '_', ' '))
      FROM public.documentos_clinicos d
      JOIN public.internacoes i ON i.id = p_internacao
     WHERE d.paciente_id = i.paciente_id AND d.estado = 'rascunho'
       AND (d.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id))
    UNION ALL
    SELECT jsonb_build_object('tipo', 'passagem', 'id', pp.id,
                              'descricao', 'Passagem de plantão aguardando aceite')
      FROM public.passagens_plantao pp
     WHERE pp.internacao_id = p_internacao AND pp.situacao = 'aguardando'
  ) s
$$;

CREATE OR REPLACE FUNCTION public.impeditivos_alta(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND OR NOT (private.cuido_da_internacao(i) OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN private.impeditivos_alta(p_internacao);
END $$;

-- ── dar alta ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.dar_alta_internado(uuid, text, text);

CREATE OR REPLACE FUNCTION public.dar_alta(
  p_internacao uuid, p_tipo text, p_cid text, p_quando timestamptz DEFAULT NULL,
  p_justificativa text DEFAULT NULL, p_observacoes text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_quando timestamptz := coalesce(p_quando, now());
  v_cid text := upper(btrim(coalesce(p_cid, '')));
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_imp jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação já encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A alta é do médico.'; END IF;
  IF p_tipo NOT IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;
  IF v_cid !~ '^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$' THEN RAISE EXCEPTION 'Informe o CID de alta.'; END IF;
  IF v_quando > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora da alta no futuro.'; END IF;
  IF v_quando < i.data_admissao THEN RAISE EXCEPTION 'Hora da alta antes da admissão.'; END IF;
  IF v_quando < now() - interval '30 minutes' AND length(btrim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Alta retroativa (mais de 30 minutos atrás): justifique (mínimo de 10 letras).';
  END IF;
  IF p_tipo IN ('alta_pedido', 'alta_evasao') AND length(btrim(coalesce(p_observacoes, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_tipo = 'obito' AND length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o número da Declaração de Óbito.';
  END IF;

  v_imp := private.impeditivos_alta(i.id);
  IF jsonb_array_length(v_imp) > 0 THEN
    RAISE EXCEPTION 'Existe(m) pendência(s) em aberto: %',
      (SELECT string_agg(x ->> 'descricao', '; ') FROM jsonb_array_elements(v_imp) x);
  END IF;

  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
    jsonb_build_object('cid', v_cid, 'quando', v_quando) || d);
  UPDATE public.internacoes
     SET data_alta = v_quando, cid_alta = v_cid, alta_por = v_perfil, alta_registrada_em = now(),
         alta_justificativa_retroativa = nullif(btrim(p_justificativa), ''),
         alta_observacoes = nullif(btrim(p_observacoes), ''),
         alta_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END
   WHERE id = i.id;
  UPDATE public.episodios SET encerrado_em = v_quando WHERE id = i.episodio_id;
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = i.paciente_id;
  INSERT INTO public.alta_paciente (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES (i.paciente_id, i.unidade_id, 'concluida', jsonb_build_object('tipo', p_tipo, 'cid', v_cid, 'internacao_id', i.id),
          nullif(btrim(p_observacoes), ''), i.leito_atual_id IS NOT NULL, v_perfil);
END $$;

-- ── cancelar alta ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_alta(p_internacao uuid, p_justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  ev public.eventos_adt;
  v_status text;
  v_leito uuid;
  v_estado jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status IN ('admitido', 'em_observacao', 'internado') OR i.alta_registrada_em IS NULL THEN
    RAISE EXCEPTION 'Não há alta para cancelar.';
  END IF;
  IF NOT (i.alta_por = v_perfil OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Só quem deu a alta, ou o gestor, cancela.';
  END IF;
  IF i.alta_registrada_em < now() - interval '24 hours' THEN RAISE EXCEPTION 'A alta tem mais de 24 horas: fale com o gestor.'; END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Justifique o cancelamento (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = i.paciente_id AND id <> i.id
               AND status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'O paciente já tem outra internação ativa.';
  END IF;

  SELECT * INTO ev FROM public.eventos_adt WHERE internacao_id = i.id ORDER BY seq DESC LIMIT 1;
  v_status := coalesce(ev.estado_antes ->> 'status', 'internado');
  v_leito := nullif(ev.estado_antes ->> 'leito', '')::uuid;
  -- o leito volta se ainda não foi ocupado por outro
  IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND status IN ('livre', 'higienizacao')) THEN
    v_leito := NULL;
  END IF;

  v_estado := jsonb_build_object('status', v_status, 'setor', i.setor_atual_id, 'leito', v_leito);
  INSERT INTO public.eventos_adt (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento, estado_antes, estado_depois,
    leito_destino_id, setor_destino_id, autor_id, motivo, hash_previo, hash_conteudo)
  VALUES (ev.seq + 1, i.organizacao_id, i.unidade_id, i.id, i.paciente_id, 'cancelamento_alta', ev.estado_depois, v_estado,
    v_leito, i.setor_atual_id, v_perfil, btrim(p_justificativa), ev.hash_conteudo,
    private.hash_evento(ev.seq + 1, 'cancelamento_alta', v_estado, v_perfil, btrim(p_justificativa), ev.hash_conteudo));

  UPDATE public.internacoes
     SET status = v_status, leito_atual_id = v_leito, data_alta = NULL, cid_alta = NULL, alta_por = NULL,
         alta_registrada_em = NULL, alta_justificativa_retroativa = NULL, alta_observacoes = NULL, alta_detalhes = NULL,
         updated_at = now()
   WHERE id = i.id;
  IF v_leito IS NOT NULL THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = v_leito;
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito, i.unidade_id, 'ocupacao', 'higienizacao', 'ocupado', i.id, v_perfil, 'Alta cancelada');
  END IF;
  UPDATE public.pacientes SET setor_id = i.setor_atual_id, updated_at = now() WHERE id = i.paciente_id;
  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = v_perfil
   WHERE internacao_id = i.id AND situacao = 'ativo';
  UPDATE public.alta_paciente SET status = 'cancelada', justificativa = coalesce(justificativa || ' · ', '') || 'Cancelada: ' || btrim(p_justificativa), updated_at = now()
   WHERE paciente_id = i.paciente_id AND criterios ->> 'internacao_id' = i.id::text AND status = 'concluida';
END $$;

-- ── pacote de alta ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacotes_alta (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  internacao_id uuid NOT NULL REFERENCES public.internacoes(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id),
  token         text NOT NULL UNIQUE,
  codigo_hash   text NOT NULL,
  orientacoes   jsonb NOT NULL DEFAULT '[]'::jsonb,
  retorno       text,
  situacao      text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'revogado', 'bloqueado')),
  tentativas    int NOT NULL DEFAULT 0,
  expira_em     timestamptz NOT NULL DEFAULT now() + interval '30 days',
  criado_por    uuid NOT NULL REFERENCES public.perfis(id),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  revogado_em   timestamptz,
  revogado_por  uuid REFERENCES public.perfis(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacote_alta_ativo ON public.pacotes_alta (internacao_id) WHERE situacao = 'ativo';

CREATE TABLE IF NOT EXISTS public.pacotes_alta_acessos (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pacote_id uuid NOT NULL REFERENCES public.pacotes_alta(id),
  em        timestamptz NOT NULL DEFAULT now(),
  aceito    boolean NOT NULL
);

ALTER TABLE public.pacotes_alta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacotes_alta_acessos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacotes_alta_select ON public.pacotes_alta;
CREATE POLICY pacotes_alta_select ON public.pacotes_alta FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS pacotes_alta_segundo_fator ON public.pacotes_alta;
CREATE POLICY pacotes_alta_segundo_fator ON public.pacotes_alta AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
DROP POLICY IF EXISTS pacotes_alta_acessos_select ON public.pacotes_alta_acessos;
CREATE POLICY pacotes_alta_acessos_select ON public.pacotes_alta_acessos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pacotes_alta p WHERE p.id = pacote_id));
REVOKE ALL ON public.pacotes_alta, public.pacotes_alta_acessos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pacotes_alta, public.pacotes_alta_acessos FROM authenticated;
-- o token e o hash do código nunca saem para a tela da equipe: SELECT só por
-- coluna (REVOKE de coluna não vale contra um GRANT da tabela inteira).
REVOKE SELECT ON public.pacotes_alta FROM authenticated;
GRANT SELECT (id, unidade_id, internacao_id, paciente_id, orientacoes, retorno, situacao, tentativas,
              expira_em, criado_por, criado_em, revogado_em, revogado_por) ON public.pacotes_alta TO authenticated;
GRANT SELECT ON public.pacotes_alta_acessos TO authenticated;

-- Devolve o código UMA vez, para a folha de orientação impressa. Gerar de novo
-- revoga o anterior.
CREATE OR REPLACE FUNCTION public.gerar_pacote_alta(p_internacao uuid, p_orientacoes jsonb DEFAULT '[]'::jsonb, p_retorno text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_token text := encode(extensions.gen_random_bytes(18), 'hex');
  v_codigo text := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  v_id uuid;
  v_expira timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') AND coalesce(i.alta_registrada_em, '-infinity') < now() - interval '24 hours' THEN
    RAISE EXCEPTION 'A alta tem mais de 24 horas: o pacote é do gestor.';
  END IF;
  IF jsonb_typeof(coalesce(p_orientacoes, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Orientações inválidas.'; END IF;
  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = v_perfil
   WHERE internacao_id = i.id AND situacao = 'ativo';
  INSERT INTO public.pacotes_alta (unidade_id, internacao_id, paciente_id, token, codigo_hash, orientacoes, retorno, criado_por)
  VALUES (i.unidade_id, i.id, i.paciente_id, v_token,
          encode(extensions.digest(v_token || ':' || v_codigo, 'sha256'), 'hex'),
          coalesce(p_orientacoes, '[]'::jsonb), nullif(btrim(p_retorno), ''), v_perfil)
  RETURNING id, expira_em INTO v_id, v_expira;
  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'codigo', v_codigo, 'expira_em', v_expira);
END $$;

CREATE OR REPLACE FUNCTION public.revogar_pacote_alta(p_pacote uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacotes_alta; i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacotes_alta WHERE id = p_pacote FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = pa.internacao_id;
  IF NOT (private.papel_na_unidade(pa.unidade_id) = 'gestor' OR private.cuido_da_internacao(i)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF pa.situacao <> 'ativo' THEN RAISE EXCEPTION 'O link já não está ativo.'; END IF;
  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = private.meu_perfil_id() WHERE id = pa.id;
END $$;

-- Página pública: sem o código, só diz se o link vale (nada de nome).
CREATE OR REPLACE FUNCTION public.situacao_pacote_alta(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT jsonb_build_object(
      'situacao', CASE WHEN pa.situacao = 'ativo' AND pa.expira_em < now() THEN 'expirado' ELSE pa.situacao END,
      'unidade', u.nome)
    FROM public.pacotes_alta pa JOIN public.unidades u ON u.id = pa.unidade_id
    WHERE pa.token = p_token), jsonb_build_object('situacao', 'inexistente'))
$$;

CREATE OR REPLACE FUNCTION public.abrir_pacote_alta(p_token text, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacotes_alta;
  i public.internacoes;
  v_ok boolean;
BEGIN
  SELECT * INTO pa FROM public.pacotes_alta WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('situacao', 'inexistente'); END IF;
  IF pa.situacao <> 'ativo' THEN RETURN jsonb_build_object('situacao', pa.situacao); END IF;
  IF pa.expira_em < now() THEN RETURN jsonb_build_object('situacao', 'expirado'); END IF;
  v_ok := pa.codigo_hash = encode(extensions.digest(p_token || ':' || btrim(coalesce(p_codigo, '')), 'sha256'), 'hex');
  INSERT INTO public.pacotes_alta_acessos (pacote_id, aceito) VALUES (pa.id, v_ok);
  IF NOT v_ok THEN
    UPDATE public.pacotes_alta SET tentativas = tentativas + 1,
           situacao = CASE WHEN tentativas + 1 >= 3 THEN 'bloqueado' ELSE situacao END
     WHERE id = pa.id;
    RETURN jsonb_build_object('situacao', CASE WHEN pa.tentativas + 1 >= 3 THEN 'bloqueado' ELSE 'codigo_errado' END,
                              'restantes', greatest(0, 3 - (pa.tentativas + 1)));
  END IF;
  UPDATE public.pacotes_alta SET tentativas = 0 WHERE id = pa.id;
  SELECT * INTO i FROM public.internacoes WHERE id = pa.internacao_id;
  RETURN jsonb_build_object(
    'situacao', 'ok',
    'primeiro_nome', (SELECT split_part(nome, ' ', 1) FROM public.pacientes WHERE id = pa.paciente_id),
    'unidade', (SELECT nome FROM public.unidades WHERE id = pa.unidade_id),
    'alta_em', i.data_alta,
    'expira_em', pa.expira_em,
    'orientacoes', pa.orientacoes,
    'retorno', pa.retorno,
    'documentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('tipo', d.tipo_documento, 'numero', d.numero,
                                          'emitido_em', coalesce(d.emitido_em, d.created_at), 'conteudo', d.conteudo)
                       ORDER BY coalesce(d.emitido_em, d.created_at))
        FROM public.documentos_clinicos d
       WHERE d.estado = 'ativo'
         AND d.tipo_documento IN ('receita', 'atestado', 'encaminhamento', 'pedido_exames', 'sumario_alta')
         AND (d.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id))), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.impeditivos_alta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dar_alta(uuid, text, text, timestamptz, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_alta(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gerar_pacote_alta(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revogar_pacote_alta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.impeditivos_alta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dar_alta(uuid, text, text, timestamptz, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_alta(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_pacote_alta(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_pacote_alta(uuid) TO authenticated;
-- o paciente não tem login: as duas portas públicas
REVOKE ALL ON FUNCTION public.situacao_pacote_alta(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abrir_pacote_alta(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.situacao_pacote_alta(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_pacote_alta(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION private.impeditivos_alta(uuid) FROM PUBLIC, anon, authenticated;
