-- ════════════════════════════════════════════════════════════════════════════
-- Fase 3, tarefa 9 — exportação estruturada (CSV/JSON). Decisões do RT em
-- 10/10/2026 (BACKLOG.md):
--
-- • Quem exporta: o gestor (só a unidade dele) e o super admin (qualquer uma).
-- • Conjuntos: atendimentos, internações, leitos (situação agora), cadastro de
--   pacientes e lista de documentos (sem o texto clínico).
-- • Dado que identifica o paciente (nome, CPF, CNS, nascimento) sai mascarado
--   por padrão. A versão completa pede motivo (mínimo de 10 letras) e o código
--   do segundo fator confirmado nos últimos 5 minutos; cada paciente exportado
--   assim entra no log de acesso ao prontuário (tipo "exportacao").
-- • JSON com os mesmos nomes do contrato da API v1 (docs/api/openapi.yaml).
-- • Período de até 12 meses.
--
-- O arquivo é montado no navegador, página por página (1.000 linhas), para não
-- estourar o tempo de uma chamada. Cada exportação é registrada em
-- public.exportacoes (quem, quando, conjunto, período, formato, máscara,
-- motivo, linhas) e no log de auditoria.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exportacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  conjunto        text NOT NULL CHECK (conjunto IN ('atendimentos', 'internacoes', 'leitos', 'pacientes', 'documentos')),
  formato         text NOT NULL CHECK (formato IN ('csv', 'json')),
  desde           date,
  ate             date,
  mascarado       boolean NOT NULL DEFAULT true,
  motivo          text,
  total           integer NOT NULL DEFAULT 0,
  linhas          integer NOT NULL DEFAULT 0,
  solicitada_por  uuid NOT NULL REFERENCES public.perfis(id),
  solicitada_em   timestamptz NOT NULL DEFAULT now(),
  concluida_em    timestamptz,
  CHECK (mascarado OR length(btrim(coalesce(motivo, ''))) >= 10),
  CHECK (conjunto = 'leitos' OR (desde IS NOT NULL AND ate IS NOT NULL AND ate >= desde))
);
CREATE INDEX IF NOT EXISTS idx_exportacoes_unidade ON public.exportacoes (unidade_id, solicitada_em DESC);

ALTER TABLE public.exportacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exportacoes FROM anon, authenticated;
-- leitura e escrita só pelas RPCs abaixo

-- O registro não se apaga, e só o andamento (linhas, conclusão) muda.
CREATE OR REPLACE FUNCTION private.exportacao_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Registro de exportação não se apaga.'; END IF;
  IF (NEW.id, NEW.unidade_id, NEW.conjunto, NEW.formato, NEW.desde, NEW.ate, NEW.mascarado, NEW.motivo,
      NEW.total, NEW.solicitada_por, NEW.solicitada_em)
     IS DISTINCT FROM
     (OLD.id, OLD.unidade_id, OLD.conjunto, OLD.formato, OLD.desde, OLD.ate, OLD.mascarado, OLD.motivo,
      OLD.total, OLD.solicitada_por, OLD.solicitada_em) THEN
    RAISE EXCEPTION 'Só o andamento da exportação muda.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exportacoes_imutavel ON public.exportacoes;
CREATE TRIGGER trg_exportacoes_imutavel BEFORE UPDATE OR DELETE ON public.exportacoes
  FOR EACH ROW EXECUTE FUNCTION private.exportacao_imutavel();

-- ── segundo fator confirmado há pouco (ação sensível) ───────────────────────
-- Vale o código por e-mail ou o TOTP (o claim amr do JWT traz o horário).
-- O "verificado_em" da sessão não serve: o dispositivo confiável também o
-- renova, sem código. Por isso a coluna codigo_em, que só o código digitado
-- (verificar_codigo_2fa) preenche.
ALTER TABLE private.segundo_fator_sessao_ok ADD COLUMN IF NOT EXISTS codigo_em timestamptz;

-- Igual à versão de 20261022000002, mais o codigo_em.
CREATE OR REPLACE FUNCTION public.verificar_codigo_2fa(p_codigo text, p_confiar boolean DEFAULT false, p_rotulo text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_uid uuid := auth.uid(); v_session uuid; v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  IF v_session IS NULL THEN RAISE EXCEPTION 'Sessão sem identificador; refaça o login.'; END IF;
  SELECT * INTO r FROM private.segundo_fator_email_codigo WHERE user_id = v_uid FOR UPDATE;
  IF r IS NULL OR r.expira_em < now() THEN RAISE EXCEPTION 'Código expirado. Peça um novo.'; END IF;
  IF r.tentativas >= 5 THEN RAISE EXCEPTION 'Muitas tentativas. Peça um novo código.'; END IF;
  IF encode(extensions.digest(coalesce(p_codigo, '') || v_uid::text, 'sha256'), 'hex') <> r.codigo_hash THEN
    IF r.tentativas + 1 >= 5 THEN
      -- 5ª tentativa errada: o código morre (expira já), e só um novo resolve
      UPDATE private.segundo_fator_email_codigo SET tentativas = 5, expira_em = now() WHERE user_id = v_uid;
    ELSE
      UPDATE private.segundo_fator_email_codigo SET tentativas = tentativas + 1 WHERE user_id = v_uid;
    END IF;
    RETURN NULL;  -- "código não confere": a tela trata data === null
  END IF;
  DELETE FROM private.segundo_fator_email_codigo WHERE user_id = v_uid;
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, codigo_em)
    VALUES (v_session, v_uid, now())
    ON CONFLICT (session_id) DO UPDATE SET verificado_em = now(), codigo_em = now(), user_id = excluded.user_id;
  IF p_confiar THEN
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.dispositivos_confiaveis (user_id, token_hash, rotulo, expira_em)
      VALUES (v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'),
              left(coalesce(nullif(p_rotulo, ''), 'Dispositivo'), 80), now() + interval '30 days');
    RETURN v_token;
  END IF;
  RETURN '';
END; $$;
REVOKE ALL ON FUNCTION public.verificar_codigo_2fa(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_codigo_2fa(text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.confirmacao_recente(p_janela interval DEFAULT interval '5 minutes')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (auth.jwt()->>'aal' = 'aal2' AND private.ultima_verificacao_totp() > now() - p_janela)
    OR EXISTS (SELECT 1 FROM private.segundo_fator_sessao_ok s
                WHERE s.user_id = auth.uid()
                  AND s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
                  AND s.codigo_em > now() - p_janela),
    false)
$$;
REVOKE ALL ON FUNCTION private.confirmacao_recente(interval) FROM PUBLIC, anon, authenticated;

-- ── máscaras ────────────────────────────────────────────────────────────────
-- "Maria da Silva Souza" → "M. S. S."
CREATE OR REPLACE FUNCTION private.mascarar_nome(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(string_agg(upper(left(w, 1)) || '.', ' ' ORDER BY n), '')
    FROM regexp_split_to_table(btrim(coalesce(p, '')), '\s+') WITH ORDINALITY AS t(w, n)
   WHERE w <> '' AND lower(w) NOT IN ('de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du')
$$;

-- CPF: ***.456.789-** (só os 6 dígitos do meio)
CREATE OR REPLACE FUNCTION private.mascarar_cpf(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN length(d) = 11 THEN '***.' || substr(d, 4, 3) || '.' || substr(d, 7, 3) || '-**' END
    FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x
$$;

-- CNS: só os 4 últimos dígitos
CREATE OR REPLACE FUNCTION private.mascarar_cns(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN length(d) = 15 THEN '***********' || right(d, 4) END
    FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x
$$;
REVOKE ALL ON FUNCTION private.mascarar_nome(text), private.mascarar_cpf(text), private.mascarar_cns(text) FROM PUBLIC, anon, authenticated;

-- Paciente resumido (id, nome, cns), como em api_paciente_resumo, com máscara.
CREATE OR REPLACE FUNCTION private.exp_paciente_resumo(p_paciente uuid, p_mascarado boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_mascarado THEN
           jsonb_build_object('id', pa.id, 'nome', private.mascarar_nome(coalesce(pa.nome_social, pa.nome)),
                              'cns', CASE WHEN private.cns_valido(pa.cns) THEN private.mascarar_cns(pa.cns) END)
         ELSE private.api_paciente_resumo(pa.id) END
    FROM public.pacientes pa WHERE pa.id = p_paciente
$$;
REVOKE ALL ON FUNCTION private.exp_paciente_resumo(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Cadastro completo, como em api_paciente, com máscara (nascimento vira o ano).
CREATE OR REPLACE FUNCTION private.exp_paciente(pa public.pacientes, p_mascarado boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_mascarado THEN
           private.api_paciente(pa) || jsonb_build_object(
             'nome', private.mascarar_nome(pa.nome), 'nome_social', private.mascarar_nome(pa.nome_social),
             'nascimento', to_char(pa.data_nascimento, 'YYYY'),
             'cns', CASE WHEN private.cns_valido(pa.cns) THEN private.mascarar_cns(pa.cns) END,
             'cpf', CASE WHEN NOT private.cns_valido(pa.cns) AND private.cpf_valido(pa.cpf) THEN private.mascarar_cpf(pa.cpf) END)
         ELSE private.api_paciente(pa) END
$$;
REVOKE ALL ON FUNCTION private.exp_paciente(public.pacientes, boolean) FROM PUBLIC, anon, authenticated;

-- ── quem pode ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.pode_exportar(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')
$$;
REVOKE ALL ON FUNCTION private.pode_exportar(uuid) FROM PUBLIC, anon, authenticated;

-- ── as linhas de cada conjunto (uma página, com o total) ────────────────────
-- Devolve {total, dados}. Ordem estável para a paginação por deslocamento.
CREATE OR REPLACE FUNCTION private.exp_linhas(x public.exportacoes, p_desloc integer, p_limite integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_ini timestamptz := x.desde::timestamptz;
  v_fim timestamptz := (x.ate + 1)::timestamptz;
  v jsonb;
BEGIN
  CASE x.conjunto
  WHEN 'atendimentos' THEN
    WITH f AS (SELECT e.* FROM public.episodios e
                WHERE e.unidade_id = x.unidade_id AND e.chegada_em >= v_ini AND e.chegada_em < v_fim),
         p AS (SELECT * FROM f ORDER BY chegada_em, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(private.api_atendimento(e) || jsonb_build_object('paciente', private.exp_paciente_resumo(e.paciente_id, x.mascarado))
                                         ORDER BY e.chegada_em, e.id) FROM p JOIN public.episodios e ON e.id = p.id), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'internacoes' THEN
    -- internações que estiveram abertas em algum momento do período
    WITH f AS (SELECT i.* FROM public.internacoes i
                WHERE i.unidade_id = x.unidade_id AND i.data_admissao < v_fim
                  AND (i.data_alta IS NULL OR i.data_alta >= v_ini)),
         p AS (SELECT * FROM f ORDER BY data_admissao, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', p.id, 'unidade_id', p.unidade_id, 'paciente', private.exp_paciente_resumo(p.paciente_id, x.mascarado),
                 'atendimento_id', p.episodio_id,
                 'setor', (SELECT s.nome FROM public.setores s WHERE s.id = p.setor_atual_id),
                 'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = p.leito_atual_id),
                 'tipo', p.tipo_internacao, 'origem', p.origem_admissao, 'status', p.status,
                 'admissao_em', p.data_admissao, 'alta_em', p.data_alta,
                 'permanencia_dias', round((extract(epoch FROM coalesce(p.data_alta, now()) - p.data_admissao) / 86400)::numeric, 1),
                 'cid_principal', p.cid_principal, 'cid_alta', p.cid_alta, 'motivo_alta', p.motivo_alta)
               ORDER BY p.data_admissao, p.id) FROM p), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'leitos' THEN
    -- situação agora; o paciente vai só pelo id (sem nome nem documento)
    WITH f AS (
      SELECT l.id, s.nome AS setor, l.identificador,
             jsonb_build_object('id', l.id, 'unidade_id', s.unidade_id, 'setor', s.nome, 'identificador', l.identificador,
               'tipo', l.tipo, 'status', l.status, 'paciente_id', i.paciente_id, 'ocupado_desde', i.data_entrada_setor) AS j
        FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
        LEFT JOIN LATERAL (SELECT it.paciente_id, it.data_entrada_setor FROM public.internacoes it
                            WHERE it.leito_atual_id = l.id AND it.data_alta IS NULL ORDER BY it.data_admissao DESC LIMIT 1) i ON true
       WHERE s.unidade_id = x.unidade_id AND l.ativo),
    p AS (SELECT * FROM f ORDER BY setor, identificador, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(p.j ORDER BY p.setor, p.identificador, p.id) FROM p), '[]'::jsonb),
             'pacientes', '[]'::jsonb)
      INTO v;
  WHEN 'pacientes' THEN
    -- cadastrados no período ou com atendimento no período
    WITH f AS (SELECT pa.* FROM public.pacientes pa
                WHERE pa.unidade_id = x.unidade_id AND pa.ativo
                  AND ((pa.created_at >= v_ini AND pa.created_at < v_fim)
                       OR EXISTS (SELECT 1 FROM public.episodios e
                                   WHERE e.paciente_id = pa.id AND e.unidade_id = x.unidade_id
                                     AND e.chegada_em >= v_ini AND e.chegada_em < v_fim))),
         p AS (SELECT * FROM f ORDER BY nome, id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(private.exp_paciente(pa, x.mascarado) ORDER BY pa.nome, pa.id)
                                  FROM p JOIN public.pacientes pa ON pa.id = p.id), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(p.id) FROM p), '[]'::jsonb))
      INTO v;
  WHEN 'documentos' THEN
    -- só a lista: tipo, número, versão, autor e datas; o texto clínico não sai
    WITH f AS (SELECT d.* FROM public.documentos_clinicos d
                WHERE d.unidade_id = x.unidade_id
                  AND coalesce(d.emitido_em, d.created_at) >= v_ini AND coalesce(d.emitido_em, d.created_at) < v_fim),
         p AS (SELECT * FROM f ORDER BY coalesce(emitido_em, created_at), id OFFSET p_desloc LIMIT p_limite)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
             'dados', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', p.id, 'unidade_id', p.unidade_id, 'paciente', private.exp_paciente_resumo(p.paciente_id, x.mascarado),
                 'atendimento_id', p.episodio_id, 'internacao_id', p.internacao_id,
                 'tipo', p.tipo_documento, 'numero', p.numero, 'versao', p.versao, 'estado', p.estado,
                 'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = p.autor_id),
                 'emitido_em', coalesce(p.emitido_em, p.created_at), 'assinado_em', p.assinado_em, 'cancelado_em', p.cancelado_em)
               ORDER BY coalesce(p.emitido_em, p.created_at), p.id) FROM p), '[]'::jsonb),
             'pacientes', coalesce((SELECT jsonb_agg(DISTINCT p.paciente_id) FROM p WHERE p.paciente_id IS NOT NULL), '[]'::jsonb))
      INTO v;
  END CASE;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION private.exp_linhas(public.exportacoes, integer, integer) FROM PUBLIC, anon, authenticated;

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Abre a exportação: confere quem pede, o período e, na versão completa, o
-- motivo e o segundo fator recente. Devolve o id e o total de linhas.
CREATE OR REPLACE FUNCTION public.exportacao_iniciar(p_unidade uuid, p_conjunto text, p_formato text,
  p_desde date, p_ate date, p_mascarado boolean DEFAULT true, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.exportacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.pode_exportar(p_unidade) THEN
    RAISE EXCEPTION 'Exporta o gestor da unidade ou a administração da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_conjunto IS NULL OR p_conjunto NOT IN ('atendimentos', 'internacoes', 'leitos', 'pacientes', 'documentos') THEN
    RAISE EXCEPTION 'Conjunto inválido.';
  END IF;
  IF p_formato IS NULL OR p_formato NOT IN ('csv', 'json') THEN RAISE EXCEPTION 'Formato: csv ou json.'; END IF;
  IF p_conjunto = 'leitos' THEN
    p_desde := NULL; p_ate := NULL;
  ELSE
    IF p_desde IS NULL OR p_ate IS NULL OR p_ate < p_desde THEN RAISE EXCEPTION 'Informe o período (início até fim).'; END IF;
    IF p_ate >= (p_desde + interval '12 months')::date THEN RAISE EXCEPTION 'O período vai até 12 meses.'; END IF;
  END IF;
  IF NOT coalesce(p_mascarado, true) THEN
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Para exportar sem máscara, escreva o motivo (mínimo de 10 letras).';
    END IF;
    IF NOT private.confirmacao_recente() THEN
      RAISE EXCEPTION 'CONFIRMACAO: confirme o código do segundo fator para exportar sem máscara.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  x.id := gen_random_uuid();
  x.unidade_id := p_unidade; x.conjunto := p_conjunto; x.formato := p_formato;
  x.desde := p_desde; x.ate := p_ate; x.mascarado := coalesce(p_mascarado, true);
  x.motivo := CASE WHEN NOT x.mascarado THEN btrim(p_motivo) END;
  x.total := (private.exp_linhas(x, 0, 0)->>'total')::integer;
  INSERT INTO public.exportacoes (id, unidade_id, conjunto, formato, desde, ate, mascarado, motivo, total, solicitada_por)
  VALUES (x.id, x.unidade_id, x.conjunto, x.formato, x.desde, x.ate, x.mascarado, x.motivo, x.total, private.meu_perfil_id());
  PERFORM private.registrar_auditoria('exportacao_iniciada', 'exportacoes', x.id, p_unidade,
    jsonb_build_object('conjunto', p_conjunto, 'formato', p_formato, 'desde', p_desde, 'ate', p_ate,
                       'mascarado', x.mascarado, 'motivo', x.motivo, 'total', x.total));
  RETURN jsonb_build_object('id', x.id, 'total', x.total);
END $$;
REVOKE ALL ON FUNCTION public.exportacao_iniciar(uuid, text, text, date, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportacao_iniciar(uuid, text, text, date, date, boolean, text) TO authenticated;

-- Uma página da exportação (1.000 linhas). Só quem abriu, na hora seguinte.
CREATE OR REPLACE FUNCTION public.exportacao_pagina(p_id uuid, p_desloc integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.exportacoes; v jsonb; v_n integer; v_lim constant integer := 1000; v_papel text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO x FROM public.exportacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR x.solicitada_por IS DISTINCT FROM private.meu_perfil_id() THEN
    RAISE EXCEPTION 'Exportação não encontrada.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF x.concluida_em IS NOT NULL OR x.solicitada_em < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Esta exportação já terminou ou expirou. Comece outra.';
  END IF;
  IF NOT private.pode_exportar(x.unidade_id) THEN
    RAISE EXCEPTION 'Exporta o gestor da unidade ou a administração da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v := private.exp_linhas(x, greatest(coalesce(p_desloc, 0), 0), v_lim);
  v_n := jsonb_array_length(v->'dados');

  -- versão completa: cada paciente exportado entra no log de acesso ao prontuário
  IF NOT x.mascarado AND jsonb_array_length(v->'pacientes') > 0 THEN
    v_papel := CASE WHEN private.tenho_papel(x.unidade_id, 'gestor') THEN 'gestor' ELSE 'admin' END;
    INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso)
    SELECT u.organizacao_id, x.unidade_id, pid::uuid, x.solicitada_por, v_papel, 'exportacao'
      FROM jsonb_array_elements_text(v->'pacientes') pid
      JOIN public.unidades u ON u.id = x.unidade_id;
  END IF;

  UPDATE public.exportacoes SET linhas = linhas + v_n WHERE id = x.id;
  RETURN jsonb_build_object('dados', v->'dados',
    'proximo', CASE WHEN v_n = v_lim AND coalesce(p_desloc, 0) + v_n < (v->>'total')::integer THEN coalesce(p_desloc, 0) + v_n END);
END $$;
REVOKE ALL ON FUNCTION public.exportacao_pagina(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportacao_pagina(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.exportacao_concluir(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.exportacoes;
BEGIN
  SELECT * INTO x FROM public.exportacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR x.solicitada_por IS DISTINCT FROM private.meu_perfil_id() THEN
    RAISE EXCEPTION 'Exportação não encontrada.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF x.concluida_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.exportacoes SET concluida_em = now() WHERE id = x.id;
  PERFORM private.registrar_auditoria('exportacao_concluida', 'exportacoes', x.id, x.unidade_id,
    jsonb_build_object('conjunto', x.conjunto, 'linhas', x.linhas, 'mascarado', x.mascarado));
END $$;
REVOKE ALL ON FUNCTION public.exportacao_concluir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportacao_concluir(uuid) TO authenticated;

-- Últimas 50 exportações da unidade (para a tela, à vista do gestor).
CREATE OR REPLACE FUNCTION public.exportacoes_lista(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.pode_exportar(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', x.id, 'conjunto', x.conjunto, 'formato', x.formato, 'desde', x.desde, 'ate', x.ate,
      'mascarado', x.mascarado, 'motivo', x.motivo, 'linhas', x.linhas,
      'solicitada_por', pf.nome_completo, 'solicitada_em', x.solicitada_em, 'concluida_em', x.concluida_em)
      ORDER BY x.solicitada_em DESC)
    FROM (SELECT * FROM public.exportacoes WHERE unidade_id = p_unidade ORDER BY solicitada_em DESC LIMIT 50) x
    LEFT JOIN public.perfis pf ON pf.id = x.solicitada_por), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.exportacoes_lista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportacoes_lista(uuid) TO authenticated;
