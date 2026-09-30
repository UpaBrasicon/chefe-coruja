-- Porte do frontend — página do pacote de alta (alta.html do protótipo).
--
-- O pacote passa a trazer o que a página do paciente precisa para os blocos
-- ricos, tudo lido do banco (nada inventado; bloco sem dado não aparece):
--  * identificação: nome (o social, se houver), idade, setor, leito, datas de
--    entrada e de alta, descrição do CID de alta quando a tabela CID-10 tem;
--  * "Volte ao pronto-socorro se…" e o retorno em partes (onde, quando, exame
--    de controle, o que levar) — colunas novas, preenchidas por quem monta;
--  * documentos do episódio com autor, CRM e hora da assinatura;
--  * exames do período que têm resultado.
-- Pacotes já gerados continuam abrindo: as colunas novas nascem vazias e as
-- chaves antigas da resposta (primeiro_nome, unidade, alta_em, expira_em,
-- orientacoes, retorno, documentos) não mudam.
--
-- A equipe vê a mesma página por `ver_pacote_alta_equipe` (sem código, com
-- login e segundo fator), para conferir e imprimir o pacote inteiro.
--
-- A unidade não tem telefone público no banco (o whatsapp_numero é do canal
-- da equipe), então a página não mostra telefone. Reaplicável.

ALTER TABLE public.pacotes_alta
  ADD COLUMN IF NOT EXISTS sinais_retorno   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS retorno_detalhes jsonb;

GRANT SELECT (sinais_retorno, retorno_detalhes) ON public.pacotes_alta TO authenticated;

-- ── o conteúdo que o paciente (e a equipe) lê ───────────────────────────────
CREATE OR REPLACE FUNCTION private.conteudo_pacote_alta(p_pacote uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'primeiro_nome', split_part(coalesce(nullif(btrim(pc.nome_social), ''), pc.nome), ' ', 1),
    'nome', coalesce(nullif(btrim(pc.nome_social), ''), pc.nome),
    'idade_anos', CASE WHEN pc.data_nascimento IS NOT NULL
                       THEN extract(year FROM age(coalesce(i.data_alta, now())::date, pc.data_nascimento))::int END,
    'idade_meses', CASE WHEN pc.data_nascimento IS NOT NULL
                        THEN (extract(year FROM age(coalesce(i.data_alta, now())::date, pc.data_nascimento)) * 12
                              + extract(month FROM age(coalesce(i.data_alta, now())::date, pc.data_nascimento)))::int END,
    'unidade', u.nome,
    'setor', s.nome,
    'leito', (SELECT l.identificador FROM public.leitos l
               WHERE l.id = coalesce(i.leito_atual_id,
                 (SELECT e.leito_origem_id FROM public.eventos_adt e
                   WHERE e.internacao_id = i.id AND e.leito_origem_id IS NOT NULL ORDER BY e.seq DESC LIMIT 1))),
    'internado_em', i.data_admissao,
    'alta_em', i.data_alta,
    'gerado_em', pa.criado_em,
    'expira_em', pa.expira_em,
    'diagnostico_cid', (SELECT c.descricao FROM terminologia.cid10 c
                         WHERE c.codigo IN (coalesce(i.cid_alta, i.cid_principal), replace(coalesce(i.cid_alta, i.cid_principal), '.', ''))
                         LIMIT 1),
    'orientacoes', pa.orientacoes,
    'retorno', pa.retorno,
    'sinais_retorno', pa.sinais_retorno,
    'retorno_detalhes', pa.retorno_detalhes,
    'medico', (SELECT jsonb_build_object('nome', m.nome_completo, 'crm', m.crm, 'uf_crm', m.uf_crm)
                 FROM public.perfis m WHERE m.id = pa.criado_por),
    'documentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'tipo', d.tipo_documento, 'numero', d.numero,
               'emitido_em', coalesce(d.emitido_em, d.created_at), 'assinado_em', d.assinado_em,
               'conteudo', d.conteudo,
               'autor', a.nome_completo, 'crm', a.crm, 'uf_crm', a.uf_crm)
             ORDER BY coalesce(d.emitido_em, d.created_at))
        FROM public.documentos_clinicos d
        LEFT JOIN public.perfis a ON a.id = d.autor_id
       WHERE d.estado = 'ativo'
         AND d.tipo_documento IN ('receita', 'atestado', 'encaminhamento', 'pedido_exames', 'sumario_alta')
         AND (d.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id))), '[]'::jsonb),
    'exames', coalesce((
      SELECT jsonb_agg(jsonb_build_object('exame', x.exame, 'resultado', x.resultado, 'quando', x.resolvido_em)
             ORDER BY x.resolvido_em, x.exame)
        FROM public.exames_pedidos x
       WHERE x.situacao = 'resultado' AND nullif(btrim(x.resultado), '') IS NOT NULL
         AND (x.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND x.episodio_id = i.episodio_id))), '[]'::jsonb))
  FROM public.pacotes_alta pa
  JOIN public.internacoes i ON i.id = pa.internacao_id
  JOIN public.pacientes pc ON pc.id = pa.paciente_id
  JOIN public.unidades u ON u.id = pa.unidade_id
  LEFT JOIN public.setores s ON s.id = i.setor_atual_id
  WHERE pa.id = p_pacote
$$;

-- ── gerar: aceita os sinais de retorno e o retorno em partes ────────────────
DROP FUNCTION IF EXISTS public.gerar_pacote_alta(uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.gerar_pacote_alta(
  p_internacao uuid, p_orientacoes jsonb DEFAULT '[]'::jsonb, p_retorno text DEFAULT NULL,
  p_sinais_retorno jsonb DEFAULT '[]'::jsonb, p_retorno_detalhes jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_token text := encode(extensions.gen_random_bytes(18), 'hex');
  v_codigo text := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  v_id uuid;
  v_expira timestamptz;
  v_sinais jsonb;
  v_detalhes jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') AND coalesce(i.alta_registrada_em, '-infinity') < now() - interval '24 hours' THEN
    RAISE EXCEPTION 'A alta tem mais de 24 horas: o pacote é do gestor.';
  END IF;
  IF jsonb_typeof(coalesce(p_orientacoes, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Orientações inválidas.'; END IF;
  IF jsonb_typeof(coalesce(p_sinais_retorno, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Sinais de retorno inválidos.'; END IF;
  IF p_retorno_detalhes IS NOT NULL AND jsonb_typeof(p_retorno_detalhes) <> 'object' THEN RAISE EXCEPTION 'Retorno inválido.'; END IF;

  -- só texto que diz alguma coisa: linha vazia não vira item na página
  SELECT coalesce(jsonb_agg(btrim(x)), '[]'::jsonb) INTO v_sinais
    FROM jsonb_array_elements_text(coalesce(p_sinais_retorno, '[]'::jsonb)) x WHERE btrim(x) <> '';
  SELECT jsonb_object_agg(k, btrim(v)) INTO v_detalhes
    FROM jsonb_each_text(coalesce(p_retorno_detalhes, '{}'::jsonb)) AS e(k, v)
   WHERE k IN ('onde', 'quando', 'exame_controle', 'levar') AND btrim(coalesce(v, '')) <> '';

  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = v_perfil
   WHERE internacao_id = i.id AND situacao = 'ativo';
  INSERT INTO public.pacotes_alta (unidade_id, internacao_id, paciente_id, token, codigo_hash, orientacoes, retorno,
                                   sinais_retorno, retorno_detalhes, criado_por)
  VALUES (i.unidade_id, i.id, i.paciente_id, v_token,
          encode(extensions.digest(v_token || ':' || v_codigo, 'sha256'), 'hex'),
          coalesce(p_orientacoes, '[]'::jsonb), nullif(btrim(p_retorno), ''), v_sinais, v_detalhes, v_perfil)
  RETURNING id, expira_em INTO v_id, v_expira;
  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'codigo', v_codigo, 'expira_em', v_expira);
END $$;

-- ── abrir (paciente, sem login): mesma porta, conteúdo ampliado ─────────────
CREATE OR REPLACE FUNCTION public.abrir_pacote_alta(p_token text, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacotes_alta;
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
  RETURN jsonb_build_object('situacao', 'ok') || private.conteudo_pacote_alta(pa.id);
END $$;

-- ── a equipe vê o que o paciente vê (sem código; login e segundo fator) ─────
-- Quem gerou, quem cuida do setor agora ou o gestor da unidade. Vale também
-- para link revogado, bloqueado ou vencido: o pacote impresso é a via de quem
-- não tem celular, e o conteúdo é o do prontuário.
CREATE OR REPLACE FUNCTION public.ver_pacote_alta_equipe(p_pacote uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacotes_alta; i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacotes_alta WHERE id = p_pacote;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = pa.internacao_id;
  IF NOT (pa.criado_por = private.meu_perfil_id()
          OR private.cuido_da_internacao(i)
          OR private.papel_na_unidade(pa.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN jsonb_build_object(
      'situacao', 'ok',
      'situacao_link', CASE WHEN pa.situacao = 'ativo' AND pa.expira_em < now() THEN 'expirado' ELSE pa.situacao END)
    || private.conteudo_pacote_alta(pa.id);
END $$;

REVOKE ALL ON FUNCTION private.conteudo_pacote_alta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gerar_pacote_alta(uuid, jsonb, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_pacote_alta(uuid, jsonb, text, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ver_pacote_alta_equipe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ver_pacote_alta_equipe(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.abrir_pacote_alta(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abrir_pacote_alta(text, text) TO anon, authenticated;
