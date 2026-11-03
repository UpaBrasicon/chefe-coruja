-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 5, parte 5.1 (BACKLOG.md; decisões do RT em 03/11/2026, H1 a H5 =
-- A): envio da consulta da UBS à UPA (ou hospital) da rede, com acompanhamento.
--
-- 1. encaminhamentos_upa: origem (UBS, episódio, paciente), destino (UPA ou
--    hospital da mesma organização), motivo, resumo da consulta (fotografia no
--    envio: paciente, queixa, tipo, cor da escuta, último SOAP, sinais), e a
--    situação enviado → chegou / não chegou / cancelado. Acesso só por RPC.
-- 2. encaminhar_upa (H1, H5): o médico ou o enfermeiro de plantão no
--    consultório. Da escuta inicial (o paciente ainda na fila da enfermagem),
--    a ficha da UBS encerra com o envio; da consulta, o médico encerra pela
--    conduta, como sempre. Avisa a recepção, a enfermagem, os médicos e o
--    gestor da UPA.
-- 3. encaminhamento_upa_marcar_chegada: a UPA registra que chegou (ligando à
--    ficha que abriu, se abriu) ou que não chegou (com o relato), como a
--    chegada da regulação. Avisa quem enviou.
-- 4. Prazo (H1): de 15 em 15 minutos, o envio sem chegada em 12 horas passa a
--    "não chegou" e quem enviou é avisado (pg_cron 'encaminhamento-upa-prazo').
-- 5. Listas para as telas (H3): da origem ("Encaminhados"), do destino
--    ("Vindo da UBS") e do paciente.
--
-- A regulação (consulta, exame, internação; H2) não muda: a tela da UBS abre
-- a solicitação que já existe, já preenchida. Idempotente.
-- Teste: supabase/tests/5a_encaminhamento_upa.sql
--
-- Rollback (na ordem):
--   SELECT cron.unschedule('encaminhamento-upa-prazo');
--   DROP FUNCTION das RPCs encaminhar_upa, encaminhamento_upa_* e
--     encaminhamentos_upa_*, e private.encaminhamento_upa_*;
--   DROP TABLE public.encaminhamentos_upa;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.encaminhamentos_upa (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               bigint GENERATED ALWAYS AS IDENTITY,
  organizacao_id       uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_origem_id    uuid NOT NULL REFERENCES public.unidades(id),
  episodio_origem_id   uuid NOT NULL REFERENCES public.episodios(id),
  paciente_id          uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  unidade_destino_id   uuid NOT NULL REFERENCES public.unidades(id),
  motivo               text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  resumo               jsonb NOT NULL,
  situacao             text NOT NULL DEFAULT 'enviado' CHECK (situacao IN ('enviado', 'chegou', 'nao_chegou', 'cancelado')),
  enviado_por          uuid NOT NULL REFERENCES public.perfis(id),
  enviado_em           timestamptz NOT NULL DEFAULT now(),
  prazo_em             timestamptz NOT NULL,
  chegada_por          uuid REFERENCES public.perfis(id),
  chegada_em           timestamptz,
  episodio_destino_id  uuid REFERENCES public.episodios(id),
  observacao_chegada   text,
  cancelado_por        uuid REFERENCES public.perfis(id),
  cancelado_em         timestamptz,
  motivo_cancelamento  text,
  CHECK (unidade_destino_id <> unidade_origem_id),
  CHECK (situacao <> 'cancelado' OR (cancelado_em IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 5)),
  CHECK (situacao <> 'chegou' OR chegada_em IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_upa_origem ON public.encaminhamentos_upa (unidade_origem_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_upa_destino ON public.encaminhamentos_upa (unidade_destino_id, situacao, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_upa_paciente ON public.encaminhamentos_upa (paciente_id, enviado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_encaminhamentos_upa_ativo ON public.encaminhamentos_upa (episodio_origem_id) WHERE situacao = 'enviado';

ALTER TABLE public.encaminhamentos_upa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encaminhamentos_upa FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.encaminhamento_upa_json(x public.encaminhamentos_upa)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', x.id, 'numero', x.numero, 'situacao', x.situacao, 'motivo', x.motivo, 'resumo', x.resumo,
    'unidade_origem_id', x.unidade_origem_id, 'unidade_origem', (SELECT nome FROM public.unidades WHERE id = x.unidade_origem_id),
    'unidade_destino_id', x.unidade_destino_id, 'unidade_destino', (SELECT nome FROM public.unidades WHERE id = x.unidade_destino_id),
    'episodio_origem_id', x.episodio_origem_id, 'paciente_id', x.paciente_id,
    'enviado_por', (SELECT nome_completo FROM public.perfis WHERE id = x.enviado_por), 'enviado_em', x.enviado_em, 'prazo_em', x.prazo_em,
    'chegada_por', (SELECT nome_completo FROM public.perfis WHERE id = x.chegada_por), 'chegada_em', x.chegada_em,
    'episodio_destino_id', x.episodio_destino_id, 'observacao_chegada', x.observacao_chegada,
    'cancelado_em', x.cancelado_em, 'motivo_cancelamento', x.motivo_cancelamento)
$$;

-- avisos: à origem (quem enviou) ou ao destino (recepção, enfermagem, médicos, gestor)
CREATE OR REPLACE FUNCTION private.encaminhamento_upa_avisar(x public.encaminhamentos_upa, p_destino boolean, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_destino THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT DISTINCT vi.perfil_id, x.unidade_destino_id, current_date, p_tipo || '_' || x.numero, p_mensagem
      FROM public.vinculos vi
     WHERE vi.unidade_id = x.unidade_destino_id AND vi.ativo AND vi.papel::text IN ('recepcao', 'enfermeiro', 'plantonista', 'gestor')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  ELSE
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (x.enviado_por, x.unidade_origem_id, current_date, p_tipo || '_' || x.numero, p_mensagem)
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
END $$;

-- quem responde pelo destino: recepção, enfermagem, médico ou gestor da UPA
CREATE OR REPLACE FUNCTION private.encaminhamento_upa_sou_destino(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.eh_super_admin(), false)
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['recepcao', 'enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor']) r
                  WHERE private.tenho_papel(p_unidade, r) IS TRUE)
$$;

REVOKE ALL ON FUNCTION private.encaminhamento_upa_json(public.encaminhamentos_upa),
  private.encaminhamento_upa_avisar(public.encaminhamentos_upa, boolean, text, text),
  private.encaminhamento_upa_sou_destino(uuid) FROM PUBLIC, anon, authenticated;

-- ── enviar (H1, H5) ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encaminhar_upa(p_episodio uuid, p_destino uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  u_origem public.unidades;
  u_destino public.unidades;
  p public.pacientes;
  x public.encaminhamentos_upa;
  v_eu uuid := private.meu_perfil_id();
  v_resumo jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'O envio à UPA é da consulta da UBS.'; END IF;
  IF e.etapa NOT IN ('triagem', 'atendimento') THEN RAISE EXCEPTION 'A consulta já foi encerrada.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora())
     OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(e.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: envia o médico ou o enfermeiro de plantão no consultório.';
  END IF;
  SELECT * INTO u_origem FROM public.unidades WHERE id = e.unidade_id;
  SELECT * INTO u_destino FROM public.unidades WHERE id = p_destino;
  IF NOT FOUND OR u_destino.id = u_origem.id OR u_destino.organizacao_id IS DISTINCT FROM u_origem.organizacao_id
     OR u_destino.tipo::text NOT IN ('upa', 'hospital') OR NOT coalesce(u_destino.ativo, true) THEN
    RAISE EXCEPTION 'Escolha uma UPA ou um hospital da rede.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo do envio (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.encaminhamentos_upa WHERE episodio_origem_id = e.id AND situacao = 'enviado') THEN
    RAISE EXCEPTION 'Já há um envio à UPA em andamento para esta consulta.';
  END IF;

  SELECT * INTO p FROM public.pacientes WHERE id = e.paciente_id;
  -- fotografia da consulta no envio: o que a UPA precisa para receber
  v_resumo := jsonb_build_object(
    'paciente', jsonb_build_object('nome', p.nome, 'nome_social', p.nome_social, 'data_nascimento', p.data_nascimento,
                                   'sexo', p.sexo, 'cns', p.cns, 'cpf', p.cpf, 'nome_mae', p.nome_mae),
    'queixa', e.queixa,
    'tipo_atendimento', e.tipo_atendimento_aps,
    'prioridades_legais', to_jsonb(e.prioridades_legais),
    'cor_escuta', e.cor_atual,
    'soap', (SELECT jsonb_build_object('subjetivo', r.subjetivo, 'objetivo', r.objetivo, 'avaliacao', r.avaliacao,
                                       'plano', r.plano, 'cid', r.cid, 'em', r.criado_em)
               FROM public.atendimento_registros r WHERE r.episodio_id = e.id ORDER BY r.criado_em DESC LIMIT 1),
    'sinais', (SELECT jsonb_object_agg(c.nome, o.valor_num)
                 FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                WHERE o.episodio_id = e.id
                  AND o.aferido_em = (SELECT max(aferido_em) FROM public.observacao WHERE episodio_id = e.id)),
    'sinais_em', (SELECT max(aferido_em) FROM public.observacao WHERE episodio_id = e.id));

  INSERT INTO public.encaminhamentos_upa (organizacao_id, unidade_origem_id, episodio_origem_id, paciente_id, unidade_destino_id,
                                          motivo, resumo, enviado_por, prazo_em)
  VALUES (u_origem.organizacao_id, u_origem.id, e.id, e.paciente_id, u_destino.id, btrim(p_motivo), v_resumo, v_eu,
          now() + interval '12 hours')
  RETURNING * INTO x;

  -- da escuta inicial (o paciente ainda não passou pelo médico), a ficha da
  -- UBS encerra aqui; da consulta, o médico encerra pela conduta
  IF e.etapa = 'triagem' THEN
    UPDATE public.episodios
       SET etapa = 'encerrado', desfecho_motivo = 'Enviado à ' || u_destino.nome || ': ' || btrim(p_motivo),
           desfecho_em = now(), desfecho_por = v_eu, encerrado_em = now(), encerrado_por = v_eu, updated_at = now()
     WHERE id = e.id;
  END IF;

  PERFORM private.encaminhamento_upa_avisar(x, true, 'ubs_upa',
    'Vindo da ' || u_origem.nome || ': ' || coalesce(nullif(btrim(p.nome_social), ''), p.nome) || ' — ' || btrim(p_motivo));
  PERFORM private.registrar_auditoria('encaminhamento_upa_enviado', 'encaminhamentos_upa', x.id, u_origem.id,
    jsonb_build_object('status', 'enviado', 'unidade_id', u_destino.id));
  RETURN x.id;
END $$;

-- ── cancelar (origem) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encaminhamento_upa_cancelar(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.encaminhamentos_upa;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO x FROM public.encaminhamentos_upa WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Envio não encontrado.'; END IF;
  IF NOT (x.enviado_por = private.meu_perfil_id() OR private.tenho_papel(x.unidade_origem_id, 'gestor') IS TRUE
          OR private.tenho_papel(x.unidade_origem_id, 'plantonista') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: cancela quem enviou, um médico ou o gestor da UBS.';
  END IF;
  IF x.situacao <> 'enviado' THEN RAISE EXCEPTION 'Só se cancela o envio que ainda espera a chegada.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o motivo do cancelamento.'; END IF;
  UPDATE public.encaminhamentos_upa
     SET situacao = 'cancelado', cancelado_em = now(), cancelado_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = x.id RETURNING * INTO x;
  PERFORM private.encaminhamento_upa_avisar(x, true, 'ubs_upa',
    'Envio nº ' || x.numero || ' da ' || (SELECT nome FROM public.unidades WHERE id = x.unidade_origem_id) || ' cancelado: ' || btrim(p_motivo));
  PERFORM private.registrar_auditoria('encaminhamento_upa_cancelado', 'encaminhamentos_upa', x.id, x.unidade_origem_id,
    jsonb_build_object('status', 'cancelado'));
END $$;

-- ── chegada (destino) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encaminhamento_upa_marcar_chegada(p_id uuid, p_chegou boolean, p_episodio uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  x public.encaminhamentos_upa;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_nome text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO x FROM public.encaminhamentos_upa WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Envio não encontrado.'; END IF;
  IF NOT private.encaminhamento_upa_sou_destino(x.unidade_destino_id) THEN
    RAISE EXCEPTION 'Marca a chegada a unidade de destino.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- o "não chegou" automático (prazo) pode ser corrigido para "chegou"
  IF NOT (x.situacao = 'enviado' OR (x.situacao = 'nao_chegou' AND p_chegou AND x.chegada_por IS NULL)) THEN
    RAISE EXCEPTION 'Este envio não está esperando a chegada.';
  END IF;
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND unidade_id = x.unidade_destino_id) THEN
    RAISE EXCEPTION 'A ficha informada não é desta unidade.';
  END IF;
  IF NOT p_chegou AND length(coalesce(v_obs, '')) < 10 THEN RAISE EXCEPTION 'Escreva o que aconteceu (mínimo de 10 letras).'; END IF;
  v_nome := coalesce(nullif(btrim(x.resumo -> 'paciente' ->> 'nome_social'), ''), x.resumo -> 'paciente' ->> 'nome');
  UPDATE public.encaminhamentos_upa
     SET situacao = CASE WHEN p_chegou THEN 'chegou' ELSE 'nao_chegou' END, chegada_em = now(), chegada_por = private.meu_perfil_id(),
         episodio_destino_id = CASE WHEN p_chegou THEN p_episodio END, observacao_chegada = v_obs
   WHERE id = x.id RETURNING * INTO x;
  PERFORM private.encaminhamento_upa_avisar(x, false, 'ubs_upa',
    v_nome || CASE WHEN p_chegou THEN ' chegou à ' ELSE ' não chegou à ' END
           || (SELECT nome FROM public.unidades WHERE id = x.unidade_destino_id) || coalesce(' — ' || v_obs, '') || '.');
  PERFORM private.registrar_auditoria('encaminhamento_upa_chegada', 'encaminhamentos_upa', x.id, x.unidade_destino_id,
    jsonb_build_object('status', x.situacao));
  RETURN private.encaminhamento_upa_json(x);
END $$;

-- ── prazo de 12 horas (H1) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.encaminhamentos_upa_prazo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x public.encaminhamentos_upa; n int := 0;
BEGIN
  FOR x IN
    UPDATE public.encaminhamentos_upa
       SET situacao = 'nao_chegou', observacao_chegada = 'Sem registro de chegada em 12 horas.'
     WHERE situacao = 'enviado' AND prazo_em <= now()
    RETURNING *
  LOOP
    n := n + 1;
    PERFORM private.encaminhamento_upa_avisar(x, false, 'ubs_upa',
      coalesce(nullif(btrim(x.resumo -> 'paciente' ->> 'nome_social'), ''), x.resumo -> 'paciente' ->> 'nome')
      || ': a ' || (SELECT nome FROM public.unidades WHERE id = x.unidade_destino_id)
      || ' não registrou a chegada em 12 horas. Confira com o paciente.');
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.encaminhamentos_upa_prazo() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'encaminhamento-upa-prazo';
  PERFORM cron.schedule('encaminhamento-upa-prazo', '*/15 * * * *', 'SELECT private.encaminhamentos_upa_prazo();');
END $$;

-- ── listas (H3) ─────────────────────────────────────────────────────────────
-- "Encaminhados" da UBS: os envios dos últimos dias
CREATE OR REPLACE FUNCTION public.encaminhamentos_upa_origem(p_unidade uuid, p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.encaminhamento_upa_json(x) ORDER BY x.enviado_em DESC)
                     FROM public.encaminhamentos_upa x
                    WHERE x.unidade_origem_id = p_unidade
                      AND x.enviado_em >= now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))), '[]'::jsonb);
END $$;

-- "Vindo da UBS" na UPA: os que esperam a chegada e os do último dia
CREATE OR REPLACE FUNCTION public.encaminhamentos_upa_destino(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.encaminhamento_upa_sou_destino(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.encaminhamento_upa_json(x) ORDER BY (x.situacao = 'enviado') DESC, x.enviado_em DESC)
                     FROM public.encaminhamentos_upa x
                    WHERE x.unidade_destino_id = p_unidade
                      AND (x.situacao = 'enviado' OR x.enviado_em >= now() - interval '1 day')), '[]'::jsonb);
END $$;

-- histórico do paciente (janela da consulta da UBS)
CREATE OR REPLACE FUNCTION public.encaminhamentos_upa_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF private.segundo_fator_ok() IS NOT TRUE
     OR NOT (coalesce(private.eh_super_admin(), false) OR private.papel_na_unidade(v_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.encaminhamento_upa_json(x) ORDER BY x.enviado_em DESC)
                     FROM public.encaminhamentos_upa x WHERE x.paciente_id = p_paciente), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.encaminhar_upa(uuid, uuid, text), public.encaminhamento_upa_cancelar(uuid, text),
  public.encaminhamento_upa_marcar_chegada(uuid, boolean, uuid, text), public.encaminhamentos_upa_origem(uuid, integer),
  public.encaminhamentos_upa_destino(uuid), public.encaminhamentos_upa_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhar_upa(uuid, uuid, text), public.encaminhamento_upa_cancelar(uuid, text),
  public.encaminhamento_upa_marcar_chegada(uuid, boolean, uuid, text), public.encaminhamentos_upa_origem(uuid, integer),
  public.encaminhamentos_upa_destino(uuid), public.encaminhamentos_upa_do_paciente(uuid) TO authenticated;
