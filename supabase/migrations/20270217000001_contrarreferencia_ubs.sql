-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 6, parte 6.1 (BACKLOG.md; decisões do RT em 03/11/2026, I1 a I5 =
-- A): retorno do paciente à UBS depois da UPA ou do hospital (contrarreferência).
--
-- 1. contrarreferencias: o fim do atendimento numa UPA ou num hospital da rede
--    (episódio encerrado ou alta da internação), a UBS que recebe, o cadastro
--    do paciente nela, o resumo (fotografia na saída) e a orientação à UBS.
--    Situação: a_ver → visto (ou cancelada, se a alta for desfeita). Acesso só
--    por RPC.
-- 2. Quem recebe (I1): a UBS que enviou o paciente à UPA (tarefa 5) e toda UBS
--    da mesma organização onde ele tem cadastro (mesmo CNS ou CPF válido, ou
--    cadastro unificado; a regra da regulação, private.regulacao_mesmo_paciente).
-- 3. Quando (I5): o episódio que encerra (alta, alta após medicação, alta a
--    pedido, transferência, evasão, óbito; observação e internação não) e a alta
--    da internação (todas as saídas). Sai sozinho por gatilho (I3), sem mudar
--    registrar_desfecho nem dar_alta: a "Orientação à UBS" opcional vai nos
--    detalhes, que já são jsonb (chave orientacao_ubs). Um erro aqui nunca
--    trava a alta: vira aviso no log.
-- 4. O resumo (I2): unidade, datas, desfecho, CID de alta, relato, último
--    registro do atendimento, documentos emitidos e, na internação, o retorno
--    do pacote de alta.
-- 5. Avisos e telas (I4): médico, enfermeiro e gestor da UBS são avisados
--    ('ubs_retorno_<número>'). A lista mostra a todos da UBS que o paciente
--    voltou; o resumo só abre para médico, enfermeiro e gestor, com registro
--    no acesso ao prontuário da unidade de origem, e marca "visto".
--
-- Idempotente. Teste: supabase/tests/5a_contrarreferencia.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_contrarreferencia_episodio ON public.episodios;
--   DROP TRIGGER trg_contrarreferencia_alta ON public.internacoes;
--   DROP FUNCTION das RPCs contrarreferencia_abrir, contrarreferencias_da_unidade
--     e contrarreferencias_do_paciente, e de private.contrarreferencia_*;
--   DROP TABLE public.contrarreferencias;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contrarreferencias (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                 bigint GENERATED ALWAYS AS IDENTITY,
  organizacao_id         uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_origem_id      uuid NOT NULL REFERENCES public.unidades(id),
  episodio_id            uuid REFERENCES public.episodios(id),
  internacao_id          uuid REFERENCES public.internacoes(id),
  paciente_origem_id     uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  unidade_ubs_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_ubs_id        uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  encaminhamento_upa_id  uuid REFERENCES public.encaminhamentos_upa(id),
  desfecho               text NOT NULL,
  saida_em               timestamptz NOT NULL,
  resumo                 jsonb NOT NULL,
  orientacao             text,
  situacao               text NOT NULL DEFAULT 'a_ver' CHECK (situacao IN ('a_ver', 'visto', 'cancelada')),
  criado_em              timestamptz NOT NULL DEFAULT now(),
  visto_por              uuid REFERENCES public.perfis(id),
  visto_em               timestamptz,
  cancelada_em           timestamptz,
  CHECK ((episodio_id IS NULL) <> (internacao_id IS NULL)),
  CHECK (unidade_ubs_id <> unidade_origem_id),
  CHECK (situacao <> 'visto' OR visto_em IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contrarreferencias_ubs ON public.contrarreferencias (unidade_ubs_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contrarreferencias_paciente ON public.contrarreferencias (paciente_ubs_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contrarreferencias_episodio ON public.contrarreferencias (episodio_id) WHERE episodio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contrarreferencias_internacao ON public.contrarreferencias (internacao_id) WHERE internacao_id IS NOT NULL;

ALTER TABLE public.contrarreferencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contrarreferencias FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
-- rótulo do fim do atendimento, para o aviso
CREATE OR REPLACE FUNCTION private.contrarreferencia_rotulo(p_desfecho text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_desfecho
    WHEN 'alta' THEN 'alta' WHEN 'alta_apos_medicacao' THEN 'alta após medicação' WHEN 'alta_a_pedido' THEN 'alta a pedido'
    WHEN 'transferencia' THEN 'transferência' WHEN 'evasao' THEN 'evasão' WHEN 'obito' THEN 'óbito'
    WHEN 'alta_melhorada' THEN 'alta da internação' WHEN 'alta_pedido' THEN 'alta a pedido da internação'
    WHEN 'alta_evasao' THEN 'evasão da internação' WHEN 'transferencia_externa' THEN 'transferência da internação'
    ELSE p_desfecho END
$$;

-- as UBS que recebem (I1): a que enviou à UPA e as que têm cadastro do paciente
CREATE OR REPLACE FUNCTION private.contrarreferencia_alvos(p_paciente uuid, p_episodio uuid)
RETURNS TABLE (unidade_id uuid, paciente_id uuid, encaminhamento_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (a.unidade_id) a.unidade_id, a.paciente_id, a.encaminhamento_id
    FROM (
      SELECT eu.unidade_origem_id AS unidade_id, eu.paciente_id, eu.id AS encaminhamento_id, 0 AS ordem, eu.enviado_em AS em
        FROM public.encaminhamentos_upa eu
       WHERE p_episodio IS NOT NULL AND eu.episodio_destino_id = p_episodio AND eu.situacao = 'chegou'
      UNION ALL
      SELECT x.unidade_id, x.id, NULL::uuid, 1, x.created_at
        FROM private.regulacao_mesmo_paciente(p_paciente) m
        JOIN public.pacientes x ON x.id = m.paciente_id
    ) a
    JOIN public.unidades u ON u.id = a.unidade_id
   WHERE u.tipo::text = 'ubs' AND coalesce(u.ativo, true)
   ORDER BY a.unidade_id, a.ordem, a.em DESC
$$;

-- documentos emitidos (só o tipo e a hora; a última versão de cada um)
CREATE OR REPLACE FUNCTION private.contrarreferencia_documentos(p_episodio uuid, p_internacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', d.tipo_documento, 'em', coalesce(d.emitido_em, d.created_at))
                            ORDER BY coalesce(d.emitido_em, d.created_at)), '[]'::jsonb)
    FROM (SELECT DISTINCT ON (dc.documento_raiz_id) dc.*
            FROM public.documentos_clinicos dc
           WHERE ((p_episodio IS NOT NULL AND dc.episodio_id = p_episodio) OR (p_internacao IS NOT NULL AND dc.internacao_id = p_internacao))
           ORDER BY dc.documento_raiz_id, dc.versao DESC) d
   WHERE d.estado <> 'rascunho' AND d.cancelado_em IS NULL
$$;

CREATE OR REPLACE FUNCTION private.contrarreferencia_json(x public.contrarreferencias, p_resumo boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', x.id, 'numero', x.numero, 'situacao', x.situacao, 'desfecho', x.desfecho, 'saida_em', x.saida_em, 'criado_em', x.criado_em,
    'unidade_origem', (SELECT nome FROM public.unidades WHERE id = x.unidade_origem_id),
    'internacao', x.internacao_id IS NOT NULL,
    'unidade_ubs_id', x.unidade_ubs_id, 'paciente_ubs_id', x.paciente_ubs_id,
    'paciente', (SELECT jsonb_build_object('nome', p.nome, 'nome_social', p.nome_social, 'data_nascimento', p.data_nascimento)
                   FROM public.pacientes p WHERE p.id = x.paciente_ubs_id),
    'encaminhamento_numero', (SELECT numero FROM public.encaminhamentos_upa WHERE id = x.encaminhamento_upa_id),
    'tem_orientacao', x.orientacao IS NOT NULL,
    'visto_por', (SELECT nome_completo FROM public.perfis WHERE id = x.visto_por), 'visto_em', x.visto_em)
  || CASE WHEN p_resumo THEN jsonb_build_object('resumo', x.resumo, 'orientacao', x.orientacao) ELSE '{}'::jsonb END
$$;

-- o resumo clínico abre para médico, enfermeiro e gestor da UBS
CREATE OR REPLACE FUNCTION private.contrarreferencia_ve_resumo(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.eh_super_admin(), false)
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['plantonista', 'enfermeiro', 'gestor']) r WHERE private.tenho_papel(p_unidade, r) IS TRUE)
$$;

-- ── gerar (gatilhos) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.contrarreferencia_gerar(p_episodio uuid, p_internacao uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  i public.internacoes;
  u public.unidades;
  p public.pacientes;
  x public.contrarreferencias;
  a record;
  d jsonb;
  v_desfecho text;
  v_saida timestamptz;
  v_cid text;
  v_orient text;
  v_resumo jsonb;
  v_ep uuid;
  n int := 0;
BEGIN
  IF p_internacao IS NOT NULL THEN
    SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
    IF NOT FOUND THEN RETURN 0; END IF;
    v_ep := i.episodio_id;
    SELECT * INTO u FROM public.unidades WHERE id = i.unidade_id;
    SELECT * INTO p FROM public.pacientes WHERE id = i.paciente_id;
    d := coalesce(i.alta_detalhes, '{}'::jsonb);
    v_desfecho := i.status; v_saida := coalesce(i.data_alta, now()); v_cid := i.cid_alta;
  ELSE
    SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
    IF NOT FOUND THEN RETURN 0; END IF;
    v_ep := e.id;
    SELECT * INTO u FROM public.unidades WHERE id = e.unidade_id;
    SELECT * INTO p FROM public.pacientes WHERE id = e.paciente_id;
    d := coalesce(e.desfecho_detalhes, '{}'::jsonb);
    v_desfecho := e.desfecho; v_saida := coalesce(e.encerrado_em, now()); v_cid := d ->> 'cid_alta';
  END IF;
  -- só UPA, hospital ou clínica da rede devolvem à UBS
  IF u.tipo::text = 'ubs' THEN RETURN 0; END IF;
  v_orient := nullif(btrim(coalesce(d ->> 'orientacao_ubs', '')), '');

  v_resumo := jsonb_build_object(
    'unidade', u.nome, 'tipo_unidade', u.tipo,
    'entrada_em', CASE WHEN p_internacao IS NOT NULL THEN coalesce(i.internado_em, i.data_admissao) ELSE e.chegada_em END,
    'saida_em', v_saida,
    'desfecho', v_desfecho,
    'cid', v_cid,
    'cid_descricao', (SELECT c.descricao FROM terminologia.cid10 c WHERE c.codigo IN (v_cid, replace(v_cid, '.', '')) LIMIT 1),
    'relato', CASE WHEN p_internacao IS NOT NULL THEN i.alta_observacoes ELSE e.desfecho_motivo END,
    'destino', nullif(btrim(coalesce(d ->> 'destino', '')), ''),
    'medico', (SELECT nome_completo FROM public.perfis
                WHERE id = CASE WHEN p_internacao IS NOT NULL THEN i.alta_por ELSE e.desfecho_por END),
    'registro', (SELECT jsonb_build_object('avaliacao', r.avaliacao, 'plano', r.plano, 'cid', r.cid, 'em', r.criado_em)
                   FROM public.atendimento_registros r WHERE r.episodio_id = v_ep ORDER BY r.criado_em DESC LIMIT 1),
    'documentos', private.contrarreferencia_documentos(CASE WHEN p_internacao IS NULL THEN v_ep END, p_internacao),
    'pacote_alta', (SELECT jsonb_build_object('orientacoes', pa.orientacoes, 'retorno', pa.retorno,
                                              'sinais_retorno', pa.sinais_retorno, 'retorno_detalhes', pa.retorno_detalhes)
                      FROM public.pacotes_alta pa
                     WHERE p_internacao IS NOT NULL AND pa.internacao_id = p_internacao AND pa.revogado_em IS NULL
                     ORDER BY pa.criado_em DESC LIMIT 1));

  FOR a IN SELECT * FROM private.contrarreferencia_alvos(p.id, v_ep) LOOP
    CONTINUE WHEN a.unidade_id = u.id;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.contrarreferencias c
                           WHERE c.unidade_ubs_id = a.unidade_id AND c.situacao <> 'cancelada'
                             AND ((p_internacao IS NOT NULL AND c.internacao_id = p_internacao)
                                  OR (p_internacao IS NULL AND c.episodio_id = p_episodio)));
    INSERT INTO public.contrarreferencias (organizacao_id, unidade_origem_id, episodio_id, internacao_id, paciente_origem_id,
                                           unidade_ubs_id, paciente_ubs_id, encaminhamento_upa_id, desfecho, saida_em, resumo, orientacao)
    VALUES (u.organizacao_id, u.id, CASE WHEN p_internacao IS NULL THEN p_episodio END, p_internacao, p.id,
            a.unidade_id, a.paciente_id, a.encaminhamento_id, v_desfecho, v_saida, v_resumo, v_orient)
    RETURNING * INTO x;
    n := n + 1;
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT DISTINCT vi.perfil_id, x.unidade_ubs_id, current_date, 'ubs_retorno_' || x.numero,
           coalesce(nullif(btrim(p.nome_social), ''), p.nome) || ': ' || private.contrarreferencia_rotulo(v_desfecho) || ' na ' || u.nome
           || ' em ' || to_char(v_saida AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'
           || CASE WHEN v_orient IS NOT NULL THEN ' Há orientação à UBS.' ELSE '' END
      FROM public.vinculos vi
     WHERE vi.unidade_id = x.unidade_ubs_id AND vi.ativo AND vi.papel::text IN ('plantonista', 'enfermeiro', 'gestor')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
    PERFORM private.registrar_auditoria('contrarreferencia_gerada', 'contrarreferencias', x.id, x.unidade_ubs_id,
      jsonb_build_object('status', 'a_ver', 'unidade_id', u.id));
  END LOOP;
  RETURN n;
END $$;

-- episódio que encerra (I5); observação e internação seguem na unidade
CREATE OR REPLACE FUNCTION private.contrarreferencia_no_episodio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado'
     AND coalesce(NEW.desfecho, '') IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito') THEN
    BEGIN
      PERFORM private.contrarreferencia_gerar(NEW.id, NULL);
    EXCEPTION WHEN others THEN
      -- a alta nunca trava pela contrarreferência
      RAISE WARNING 'contrarreferência do episódio % não gerada: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

-- alta da internação (todas as saídas); alta desfeita cancela o retorno
CREATE OR REPLACE FUNCTION private.contrarreferencia_na_alta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  altas text[] := ARRAY['alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito'];
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      IF NEW.status = ANY (altas) THEN
        PERFORM private.contrarreferencia_gerar(NULL, NEW.id);
      ELSIF OLD.status = ANY (altas) THEN
        UPDATE public.contrarreferencias SET situacao = 'cancelada', cancelada_em = now()
         WHERE internacao_id = NEW.id AND situacao <> 'cancelada';
      END IF;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'contrarreferência da internação % não gerada: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.contrarreferencia_rotulo(text), private.contrarreferencia_alvos(uuid, uuid),
  private.contrarreferencia_documentos(uuid, uuid), private.contrarreferencia_json(public.contrarreferencias, boolean),
  private.contrarreferencia_ve_resumo(uuid), private.contrarreferencia_gerar(uuid, uuid),
  private.contrarreferencia_no_episodio(), private.contrarreferencia_na_alta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contrarreferencia_episodio ON public.episodios;
CREATE TRIGGER trg_contrarreferencia_episodio AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.contrarreferencia_no_episodio();
DROP TRIGGER IF EXISTS trg_contrarreferencia_alta ON public.internacoes;
CREATE TRIGGER trg_contrarreferencia_alta AFTER UPDATE OF status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.contrarreferencia_na_alta();

-- ── listas e leitura (I4) ───────────────────────────────────────────────────
-- "Retornos" da UBS: todos da unidade veem que o paciente voltou (sem o resumo)
CREATE OR REPLACE FUNCTION public.contrarreferencias_da_unidade(p_unidade uuid, p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.contrarreferencia_json(x, false) ORDER BY (x.situacao = 'a_ver') DESC, x.saida_em DESC)
                     FROM public.contrarreferencias x
                    WHERE x.unidade_ubs_id = p_unidade AND x.situacao <> 'cancelada'
                      AND (x.situacao = 'a_ver'
                           OR x.saida_em >= now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365)))), '[]'::jsonb);
END $$;

-- janela da consulta da UBS: os retornos do paciente (sem o resumo)
CREATE OR REPLACE FUNCTION public.contrarreferencias_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(v_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.contrarreferencia_json(x, false) ORDER BY x.saida_em DESC)
                     FROM public.contrarreferencias x
                    WHERE x.paciente_ubs_id = p_paciente AND x.situacao <> 'cancelada'), '[]'::jsonb);
END $$;

-- abrir o resumo: médico, enfermeiro ou gestor da UBS; registra o acesso no
-- prontuário da unidade de origem e marca "visto" na primeira abertura
CREATE OR REPLACE FUNCTION public.contrarreferencia_abrir(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.contrarreferencias; v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO x FROM public.contrarreferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR x.situacao = 'cancelada' THEN RAISE EXCEPTION 'Retorno não encontrado.'; END IF;
  IF NOT private.contrarreferencia_ve_resumo(x.unidade_ubs_id) THEN
    RAISE EXCEPTION 'O resumo do retorno é visto pelo médico, pelo enfermeiro e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_eu IS NOT NULL THEN
    INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel, tipo_acesso)
    VALUES (x.organizacao_id, x.unidade_origem_id, x.paciente_origem_id, x.internacao_id, v_eu,
            coalesce(private.papel_na_unidade(x.unidade_ubs_id), 'super_admin'), 'leitura_prontuario');
  END IF;
  IF x.situacao = 'a_ver' THEN
    UPDATE public.contrarreferencias SET situacao = 'visto', visto_em = now(), visto_por = v_eu WHERE id = x.id RETURNING * INTO x;
    PERFORM private.registrar_auditoria('contrarreferencia_vista', 'contrarreferencias', x.id, x.unidade_ubs_id,
      jsonb_build_object('status', 'visto'));
  END IF;
  RETURN private.contrarreferencia_json(x, true);
END $$;

REVOKE ALL ON FUNCTION public.contrarreferencias_da_unidade(uuid, integer), public.contrarreferencias_do_paciente(uuid),
  public.contrarreferencia_abrir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contrarreferencias_da_unidade(uuid, integer), public.contrarreferencias_do_paciente(uuid),
  public.contrarreferencia_abrir(uuid) TO authenticated;
