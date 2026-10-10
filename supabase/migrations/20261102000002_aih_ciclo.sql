-- Fase 3, tarefa 1 — ciclo da AIH (decisões do RT de 09/10/2026, no BACKLOG).
--
-- Até aqui a "AIH" era só o documento laudo_aih. Agora:
--   • public.aihs — a AIH em si, ligada à internação (ou ao episódio, sem
--     internação aberta) e ao laudo (raiz das versões e versão vigente).
--     Status: solicitada → aprovada | rejeitada; solicitada/aprovada → cancelada.
--     Número de 13 dígitos e competência (AAAAMM) na aprovação.
--   • public.aih_eventos — histórico só de inserção: cada mudança de status,
--     retificação do laudo e ajuste de competência, com autor, hora e motivo.
--   • A AIH nasce sozinha quando o laudo de AIH é emitido, por qualquer caminho
--     (gatilho em documentos_clinicos). Retificar o laudo de AIH solicitada
--     atualiza a mesma AIH; de AIH aprovada é recusado (cancela-se antes).
--     Cancelar o laudo cancela a AIH.
--   • Uma AIH ativa (solicitada ou aprovada) por internação.
--   • Quem decide é o médico regulador (papel "regulador", com CRM no
--     cadastro). Quem solicitou só aprova se também for regulador.
--   • Competência: sugerida pelo mês da alta (ou o corrente, internado); o
--     regulador confirma ou ajusta, com motivo registrado.
--   • O número da AIH tem o formato conferido (13 dígitos). O dígito
--     verificador só será conferido com a fonte oficial do algoritmo.
--   • Fecha o furo de emitir_documento: o laudo de AIH passa pelas faltas de
--     cadastro também nesse caminho (antes, só o rascunho conferia).
--
-- Só aditiva (expand): tabelas e funções novas; emitir_documento recriada com
-- a mesma assinatura.

-- ── tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aihs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id  uuid REFERENCES public.internacoes(id),
  episodio_id    uuid REFERENCES public.episodios(id),
  laudo_raiz_id  uuid NOT NULL,
  laudo_id       uuid NOT NULL REFERENCES public.documentos_clinicos(id),
  status         text NOT NULL DEFAULT 'solicitada'
                 CHECK (status IN ('solicitada', 'aprovada', 'rejeitada', 'cancelada')),
  numero         text CHECK (numero ~ '^[0-9]{13}$'),
  competencia    text CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  solicitada_por uuid NOT NULL REFERENCES public.perfis(id),
  solicitada_em  timestamptz NOT NULL DEFAULT now(),
  decidida_por   uuid REFERENCES public.perfis(id),
  decidida_em    timestamptz,
  motivo         text,
  atualizada_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'aprovada' OR (numero IS NOT NULL AND competencia IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS aihs_numero_unico ON public.aihs (numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS aihs_uma_ativa ON public.aihs ((coalesce(internacao_id, episodio_id, paciente_id)))
  WHERE status IN ('solicitada', 'aprovada');
CREATE INDEX IF NOT EXISTS aihs_unidade_status ON public.aihs (unidade_id, status, solicitada_em DESC);
CREATE INDEX IF NOT EXISTS aihs_laudo_raiz ON public.aihs (laudo_raiz_id);

CREATE TABLE IF NOT EXISTS public.aih_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aih_id        uuid NOT NULL REFERENCES public.aihs(id),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  evento        text NOT NULL CHECK (evento IN ('solicitada', 'laudo_retificado', 'aprovada', 'rejeitada', 'cancelada', 'competencia_ajustada')),
  status_antes  text,
  status_depois text NOT NULL,
  numero        text,
  competencia   text,
  motivo        text,
  por           uuid REFERENCES public.perfis(id),
  em            timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS aih_eventos_aih ON public.aih_eventos (aih_id, em);
DROP TRIGGER IF EXISTS trg_aih_eventos_so_insercao ON public.aih_eventos;
CREATE TRIGGER trg_aih_eventos_so_insercao BEFORE UPDATE OR DELETE ON public.aih_eventos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.aihs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aih_eventos ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.aihs, public.aih_eventos FROM anon, authenticated;
REVOKE ALL ON public.aihs, public.aih_eventos FROM anon;
GRANT SELECT ON public.aihs, public.aih_eventos TO authenticated;
DROP POLICY IF EXISTS aihs_select ON public.aihs;
CREATE POLICY aihs_select ON public.aihs FOR SELECT TO authenticated
  USING (private.tenho_papel(unidade_id, 'regulador') OR private.tenho_papel(unidade_id, 'gestor')
         OR private.pode_atuar_no_paciente(paciente_id));
DROP POLICY IF EXISTS aihs_segundo_fator ON public.aihs;
CREATE POLICY aihs_segundo_fator ON public.aihs AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
DROP POLICY IF EXISTS aih_eventos_select ON public.aih_eventos;
CREATE POLICY aih_eventos_select ON public.aih_eventos FOR SELECT TO authenticated
  USING (private.tenho_papel(unidade_id, 'regulador') OR private.tenho_papel(unidade_id, 'gestor'));
DROP POLICY IF EXISTS aih_eventos_segundo_fator ON public.aih_eventos;
CREATE POLICY aih_eventos_segundo_fator ON public.aih_eventos AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());

-- ── apoio ───────────────────────────────────────────────────────────────────
-- conteúdo do documento é texto JSON; o legado pode não ser JSON
CREATE OR REPLACE FUNCTION private.json_seguro(p text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN p::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.json_seguro(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.json_seguro(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.internacao_aberta(p_paciente uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.id FROM public.internacoes i
   WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.data_admissao DESC NULLS LAST LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.internacao_aberta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.internacao_aberta(uuid) TO authenticated;

-- mês da alta; internado (sem alta), o mês corrente — fuso de Brasília
CREATE OR REPLACE FUNCTION private.competencia_sugerida(p_aih uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_char(coalesce((SELECT i.data_alta FROM public.internacoes i WHERE i.id = a.internacao_id), now())
                 AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
    FROM public.aihs a WHERE a.id = p_aih;
$$;
REVOKE ALL ON FUNCTION private.competencia_sugerida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.competencia_sugerida(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.evento_aih(p_aih public.aihs, p_evento text, p_antes text, p_motivo text, p_por uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.aih_eventos (aih_id, unidade_id, evento, status_antes, status_depois, numero, competencia, motivo, por)
  VALUES (p_aih.id, p_aih.unidade_id, p_evento, p_antes, p_aih.status, p_aih.numero, p_aih.competencia,
          nullif(btrim(coalesce(p_motivo, '')), ''), p_por);
  PERFORM private.registrar_auditoria('aih_' || p_evento, 'aihs', p_aih.id, p_aih.unidade_id,
    jsonb_build_object('status', p_aih.status));
END $$;
REVOKE ALL ON FUNCTION private.evento_aih(public.aihs, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── a AIH nasce do laudo ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.aih_do_laudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.aihs; v_int uuid; v_antes text;
BEGIN
  IF NEW.estado = 'ativo' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'ativo') THEN
    SELECT * INTO a FROM public.aihs
     WHERE laudo_raiz_id = NEW.documento_raiz_id AND status IN ('solicitada', 'aprovada') FOR UPDATE;
    IF FOUND THEN
      IF a.status = 'aprovada' THEN
        RAISE EXCEPTION 'AIH já aprovada (nº %): para mudar o laudo, o regulador cancela a AIH antes.', a.numero;
      END IF;
      UPDATE public.aihs SET laudo_id = NEW.id, atualizada_em = now() WHERE id = a.id RETURNING * INTO a;
      PERFORM private.evento_aih(a, 'laudo_retificado', 'solicitada', NEW.motivo_retificacao, NEW.autor_id);
      RETURN NULL;
    END IF;
    v_int := coalesce(NEW.internacao_id, private.internacao_aberta(NEW.paciente_id));
    IF EXISTS (SELECT 1 FROM public.aihs x
                WHERE coalesce(x.internacao_id, x.episodio_id, x.paciente_id) = coalesce(v_int, NEW.episodio_id, NEW.paciente_id)
                  AND x.status IN ('solicitada', 'aprovada')) THEN
      RAISE EXCEPTION 'Já existe AIH solicitada ou aprovada para esta internação: retifique o laudo dela ou peça ao regulador que a cancele.';
    END IF;
    INSERT INTO public.aihs (unidade_id, paciente_id, internacao_id, episodio_id, laudo_raiz_id, laudo_id, solicitada_por, solicitada_em)
    VALUES (NEW.unidade_id, NEW.paciente_id, v_int, NEW.episodio_id, NEW.documento_raiz_id, NEW.id, NEW.autor_id,
            coalesce(NEW.emitido_em, now()))
    RETURNING * INTO a;
    PERFORM private.evento_aih(a, 'solicitada', NULL, NULL, NEW.autor_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.estado = 'cancelado' AND OLD.estado IS DISTINCT FROM 'cancelado' THEN
    FOR a IN SELECT * FROM public.aihs WHERE laudo_raiz_id = NEW.documento_raiz_id AND status IN ('solicitada', 'aprovada') FOR UPDATE LOOP
      v_antes := a.status;
      UPDATE public.aihs SET status = 'cancelada', motivo = 'Laudo de AIH cancelado', atualizada_em = now()
       WHERE id = a.id RETURNING * INTO a;
      PERFORM private.evento_aih(a, 'cancelada', v_antes, 'Laudo de AIH cancelado', coalesce(NEW.cancelado_por, private.meu_perfil_id()));
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.aih_do_laudo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aih_do_laudo ON public.documentos_clinicos;
CREATE TRIGGER trg_aih_do_laudo AFTER INSERT OR UPDATE OF estado ON public.documentos_clinicos
  FOR EACH ROW WHEN (NEW.tipo_documento = 'laudo_aih') EXECUTE FUNCTION private.aih_do_laudo();

-- ── decisões do regulador ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.exigir_regulador(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.tenho_papel(p_unidade, 'regulador') THEN
    RAISE EXCEPTION 'A decisão da AIH é do médico regulador da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (SELECT p.crm FROM public.perfis p WHERE p.id = private.meu_perfil_id()) IS NULL THEN
    RAISE EXCEPTION 'Regulador sem CRM no cadastro: complete o registro profissional antes de decidir AIH.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.exigir_regulador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.exigir_regulador(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decidir_aih(p_aih uuid, p_aprovar boolean, p_numero text DEFAULT NULL,
                                              p_competencia text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.aihs; v_num text := btrim(coalesce(p_numero, '')); v_comp text := btrim(coalesce(p_competencia, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.aihs WHERE id = p_aih FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AIH não encontrada.'; END IF;
  PERFORM private.exigir_regulador(a.unidade_id);
  IF a.status <> 'solicitada' THEN RAISE EXCEPTION 'Só se decide AIH solicitada (esta está %).', a.status; END IF;
  IF p_aprovar THEN
    IF v_num !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'Número da AIH: 13 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM public.aihs x WHERE x.numero = v_num AND x.id <> a.id) THEN
      RAISE EXCEPTION 'Este número de AIH já está em outra AIH.';
    END IF;
    IF v_comp = '' THEN v_comp := private.competencia_sugerida(a.id); END IF;
    IF v_comp !~ '^[0-9]{4}(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
    UPDATE public.aihs SET status = 'aprovada', numero = v_num, competencia = v_comp, decidida_por = private.meu_perfil_id(),
           decidida_em = now(), motivo = nullif(btrim(coalesce(p_motivo, '')), ''), atualizada_em = now()
     WHERE id = a.id RETURNING * INTO a;
    PERFORM private.evento_aih(a, 'aprovada', 'solicitada', p_motivo, private.meu_perfil_id());
  ELSE
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Rejeitar exige motivo (mínimo de 10 letras).'; END IF;
    UPDATE public.aihs SET status = 'rejeitada', decidida_por = private.meu_perfil_id(), decidida_em = now(),
           motivo = btrim(p_motivo), atualizada_em = now()
     WHERE id = a.id RETURNING * INTO a;
    PERFORM private.evento_aih(a, 'rejeitada', 'solicitada', p_motivo, private.meu_perfil_id());
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.decidir_aih(uuid, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_aih(uuid, boolean, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_competencia_aih(p_aih uuid, p_competencia text, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.aihs; v_comp text := btrim(coalesce(p_competencia, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.aihs WHERE id = p_aih FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AIH não encontrada.'; END IF;
  PERFORM private.exigir_regulador(a.unidade_id);
  IF a.status <> 'aprovada' THEN RAISE EXCEPTION 'A competência se ajusta só em AIH aprovada.'; END IF;
  IF v_comp !~ '^[0-9]{4}(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
  IF v_comp = a.competencia THEN RAISE EXCEPTION 'A competência já é %.', v_comp; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Ajustar a competência exige motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.aihs SET competencia = v_comp, atualizada_em = now() WHERE id = a.id RETURNING * INTO a;
  PERFORM private.evento_aih(a, 'competencia_ajustada', 'aprovada', p_motivo, private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION public.ajustar_competencia_aih(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_competencia_aih(uuid, text, text) TO authenticated;

-- cancela: o regulador, ou quem solicitou (enquanto não decidida)
CREATE OR REPLACE FUNCTION public.cancelar_aih(p_aih uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.aihs; v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.aihs WHERE id = p_aih FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AIH não encontrada.'; END IF;
  IF NOT (private.tenho_papel(a.unidade_id, 'regulador')
          OR (a.status = 'solicitada' AND a.solicitada_por = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Cancela a AIH o regulador, ou quem a solicitou enquanto não foi decidida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF a.status NOT IN ('solicitada', 'aprovada') THEN RAISE EXCEPTION 'Esta AIH já está %.', a.status; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 15 THEN RAISE EXCEPTION 'Cancelar exige motivo (mínimo de 15 letras).'; END IF;
  v_antes := a.status;
  UPDATE public.aihs SET status = 'cancelada', motivo = btrim(p_motivo), atualizada_em = now() WHERE id = a.id RETURNING * INTO a;
  PERFORM private.evento_aih(a, 'cancelada', v_antes, p_motivo, private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION public.cancelar_aih(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_aih(uuid, text) TO authenticated;

-- ── leitura ─────────────────────────────────────────────────────────────────
-- fila do regulador (e leitura do gestor)
CREATE OR REPLACE FUNCTION public.aihs_da_unidade(p_unidade uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'AIH da unidade: regulador ou gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'status', a.status, 'numero', a.numero, 'competencia', a.competencia,
             'competencia_sugerida', private.competencia_sugerida(a.id),
             'paciente_id', a.paciente_id, 'paciente', coalesce(pa.nome_social, pa.nome), 'sexo', pa.sexo,
             'nascimento', pa.data_nascimento, 'cns', pa.cns,
             'local', coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = a.internacao_id),
                               (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
             'internacao_id', a.internacao_id,
             'alta_em', (SELECT i.data_alta FROM public.internacoes i WHERE i.id = a.internacao_id),
             'solicitada_por', ps.nome_completo, 'solicitada_em', a.solicitada_em, 'solicitada_por_mim', a.solicitada_por = private.meu_perfil_id(),
             'decidida_por', pd.nome_completo, 'decidida_em', a.decidida_em, 'motivo', a.motivo,
             'laudo_numero', d.numero, 'laudo_versao', d.versao,
             'carater', c->>'carater', 'diagnostico', c->>'diagnostico', 'cid', c->>'cid', 'cid_sec', c->>'cidSec',
             'proc_cod', c->>'procCod', 'proc_desc', c->>'procDesc', 'clinica', c->>'clinica')
             ORDER BY (a.status = 'solicitada') DESC, a.solicitada_em DESC)
      FROM public.aihs a
      JOIN public.pacientes pa ON pa.id = a.paciente_id
      JOIN public.documentos_clinicos d ON d.id = a.laudo_id
      LEFT JOIN public.perfis ps ON ps.id = a.solicitada_por
      LEFT JOIN public.perfis pd ON pd.id = a.decidida_por
      CROSS JOIN LATERAL (SELECT coalesce(private.json_seguro(d.conteudo) -> 'aih', '{}'::jsonb) AS c) j
     WHERE a.unidade_id = p_unidade AND (p_status IS NULL OR a.status = p_status)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.aihs_da_unidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aihs_da_unidade(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.eventos_aih(p_aih uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_paciente uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, paciente_id INTO v_unidade, v_paciente FROM public.aihs WHERE id = p_aih;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'AIH não encontrada.'; END IF;
  IF NOT (private.tenho_papel(v_unidade, 'regulador') OR private.tenho_papel(v_unidade, 'gestor')
          OR private.pode_atuar_no_paciente(v_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
           'evento', e.evento, 'status_antes', e.status_antes, 'status_depois', e.status_depois, 'numero', e.numero,
           'competencia', e.competencia, 'motivo', e.motivo, 'por', p.nome_completo, 'em', e.em) ORDER BY e.em)
    FROM public.aih_eventos e LEFT JOIN public.perfis p ON p.id = e.por WHERE e.aih_id = p_aih), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.eventos_aih(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eventos_aih(uuid) TO authenticated;

-- para o médico: a AIH de cada laudo (pela raiz das versões); a mais recente
CREATE OR REPLACE FUNCTION public.aihs_dos_laudos(p_laudos uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x.j), '[]'::jsonb) FROM (
    SELECT DISTINCT ON (d.id) jsonb_build_object(
             'laudo_id', d.id, 'aih_id', a.id, 'status', a.status, 'numero', a.numero, 'competencia', a.competencia,
             'motivo', a.motivo, 'decidida_por', p.nome_completo, 'decidida_em', a.decidida_em,
             'solicitada_por_mim', a.solicitada_por = private.meu_perfil_id()) AS j
      FROM public.documentos_clinicos d
      JOIN public.aihs a ON a.laudo_raiz_id = d.documento_raiz_id
      LEFT JOIN public.perfis p ON p.id = a.decidida_por
     WHERE d.id = ANY (p_laudos) AND private.segundo_fator_ok()
       AND (private.pode_atuar_no_paciente(d.paciente_id) OR private.tenho_papel(d.unidade_id, 'regulador')
            OR private.tenho_papel(d.unidade_id, 'gestor'))
     ORDER BY d.id, a.solicitada_em DESC) x;
$$;
REVOKE ALL ON FUNCTION public.aihs_dos_laudos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aihs_dos_laudos(uuid[]) TO authenticated;

-- ── emitir_documento: o laudo de AIH passa pelas faltas de cadastro ──────────
CREATE OR REPLACE FUNCTION public.emitir_documento(
  p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid DEFAULT NULL,
  p_retifica uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.documentos_clinicos; v_perfil uuid := private.meu_perfil_id(); v_faltas text[];
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  -- Fase 3: o laudo de AIH confere as mesmas faltas do caminho do rascunho
  IF p_tipo = 'laudo_aih' THEN
    v_faltas := private.faltas_documento(p_tipo, p_conteudo, p_paciente, v_perfil);
    IF cardinality(v_faltas) > 0 THEN
      RAISE EXCEPTION 'Falta para emitir: %.', array_to_string(v_faltas, '; ');
    END IF;
  END IF;
  -- duplo clique / reimpressão: mesmo conteúdo do mesmo autor em 2 min → o mesmo documento
  SELECT * INTO r FROM public.documentos_clinicos
   WHERE paciente_id = p_paciente AND tipo_documento = p_tipo AND autor_id = v_perfil AND estado = 'ativo'
     AND conteudo_hash = encode(extensions.digest(convert_to(coalesce(p_conteudo, ''), 'UTF8'), 'sha256'), 'hex')
     AND created_at > now() - interval '2 minutes' AND p_retifica IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    r := private.gravar_documento_episodio(NULL, p_paciente, p_tipo, p_conteudo, p_episodio, p_retifica, p_motivo,
                                           v_perfil, now(), false, NULL);
    PERFORM private.registrar_auditoria(CASE WHEN p_retifica IS NULL THEN 'emitir_documento' ELSE 'retificar_documento' END,
      'documentos_clinicos', r.id, r.unidade_id, jsonb_build_object('tipo', p_tipo));
  END IF;
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'episodio_id', r.episodio_id, 'versao', r.versao);
END $$;
REVOKE ALL ON FUNCTION public.emitir_documento(uuid, text, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_documento(uuid, text, text, uuid, uuid, text) TO authenticated;
