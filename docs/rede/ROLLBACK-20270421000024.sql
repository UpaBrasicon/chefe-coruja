-- ════════════════════════════════════════════════════════════════════════════
-- Rollback da migration 20270421000024_secretaria_completa.sql (perfil Gestor
-- da secretaria: indicadores, e-mail da designação, papéis sem convite,
-- rotina do leito e escala com nome).
--
-- Quando usar: se o que a 024 trouxe tiver de sair. Antes, voltar o frontend
-- para a versão sem estas telas (Indicadores da secretaria chama
-- secretaria_indicadores; a aba Pessoas da unidade chama pessoas_da_unidade e
-- definir_papeis_na_unidade; a Rede chama a função avisar-secretaria, que
-- chama secretaria_aviso_reservar e secretaria_aviso_concluir). A função
-- avisar-secretaria sai com: npx supabase functions delete avisar-secretaria.
--
-- O que se perde: as datas do aviso por e-mail (aviso_tentado_em, avisado_em
-- em secretaria_pessoas). Os papéis que alguém mudou pela aba Pessoas ficam
-- como estão (são vínculos comuns); a auditoria (vinculo_papeis_definidos,
-- secretaria_pessoa_avisada) fica no log_auditoria, que é só de inserção.
-- Plantões que a secretaria montou e reservas que ela fez ficam gravados.
--
-- As funções estendidas voltam ao corpo da homologação de 24/11/2026
-- (pg_get_functiondef antes da migration 024).
--
-- Testado na homologação (kswurfyxxvfydpjfrivy) em transação desfeita.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── funções e políticas novas ─────────────────────────────────────────────
DROP POLICY IF EXISTS escala_plantao_secretaria_delete ON public.escala_plantao;
DROP POLICY IF EXISTS escala_plantao_secretaria_select ON public.escala_plantao;
DROP FUNCTION IF EXISTS public.definir_papeis_na_unidade(uuid, uuid, public.papel[]);
DROP FUNCTION IF EXISTS public.pessoas_da_unidade(uuid);
DROP FUNCTION IF EXISTS private.pode_mudar_papeis(uuid);
DROP FUNCTION IF EXISTS public.secretaria_aviso_concluir(uuid, boolean);
DROP FUNCTION IF EXISTS public.secretaria_aviso_reservar(uuid);
DROP FUNCTION IF EXISTS public.secretaria_indicadores(integer, integer, uuid);

-- ── colunas do aviso ──────────────────────────────────────────────────────
ALTER TABLE public.secretaria_pessoas DROP COLUMN IF EXISTS avisado_em;
ALTER TABLE public.secretaria_pessoas DROP COLUMN IF EXISTS aviso_tentado_em;

-- ── funções estendidas: corpo anterior ────────────────────────────────────

-- concluir_higienizacao
CREATE OR REPLACE FUNCTION public.concluir_higienizacao(p_leito uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'Só a enfermagem ou o gestor da unidade concluem a higienização.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'higienizacao' THEN
    RAISE EXCEPTION 'Leito % não está em higienização.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'higienizacao_concluida', 'higienizacao', 'livre', v_perfil, 'Higienização concluída');
  PERFORM private.avisar_leito_liberado(p_leito);
END; $function$;

-- reservar_leito
CREATE OR REPLACE FUNCTION public.reservar_leito(p_leito uuid, p_horas integer, p_paciente uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'plantonista')) THEN
    RAISE EXCEPTION 'Só médico, enfermeiro ou gestor da unidade reservam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_horas IS NULL OR p_horas NOT IN (1, 2, 4, 8) THEN
    RAISE EXCEPTION 'Escolha a validade da reserva: 1, 2, 4 ou 8 horas.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NULL AND length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Escolha o paciente ou descreva o motivo da reserva.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = r.unidade_id) THEN
    RAISE EXCEPTION 'Paciente não pertence a esta unidade.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM private.expirar_reservas();   -- reserva vencida não segura leito nem paciente
  IF p_paciente IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservas_leito WHERE paciente_id = p_paciente AND situacao = 'ativa') THEN
    RAISE EXCEPTION 'Este paciente já tem um leito reservado: cancele a reserva anterior antes.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reservas_leito (leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
  VALUES (p_leito, r.unidade_id, p_paciente, v_motivo, v_perfil, now() + make_interval(hours => p_horas))
  RETURNING id INTO v_id;
  PERFORM set_config('cc.reserva_nova', p_leito::text, true);
  UPDATE public.leitos SET status = 'reservado' WHERE id = p_leito;   -- a trava recusa leito que não está livre
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'reserva', 'livre', 'reservado', v_perfil,
          CASE WHEN p_paciente IS NOT NULL THEN 'Reserva para paciente' ELSE 'Reserva: ' || v_motivo END
          || ' (' || p_horas || ' h)');
  RETURN v_id;
END; $function$;

-- cancelar_reserva
CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_leito uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  res public.reservas_leito;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  SELECT * INTO res FROM public.reservas_leito WHERE leito_id = p_leito AND situacao = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito % não tem reserva ativa.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (res.reservado_por = v_perfil
          OR coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só quem reservou, o enfermeiro ou o gestor cancelam a reserva.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo do cancelamento.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reservas_leito
     SET situacao = 'cancelada', encerrada_em = now(), encerrada_por = v_perfil, motivo_encerramento = btrim(p_motivo)
   WHERE id = res.id;
  PERFORM set_config('cc.reserva_encerrada', p_leito::text, true);
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito AND status = 'reservado';
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'cancelamento_reserva', 'reservado', 'livre', v_perfil, 'Cancelada: ' || btrim(p_motivo));
END; $function$;

-- liberar_leito_sem_paciente
CREATE OR REPLACE FUNCTION public.liberar_leito_sem_paciente(p_leito uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) THEN
    RAISE EXCEPTION 'Só o gestor da unidade libera leito sem paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'ocupado' THEN
    RAISE EXCEPTION 'Leito % não está ocupado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes i
              WHERE i.leito_atual_id = p_leito AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'Leito % tem paciente: libere pela alta ou pela transferência.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.leitos WHERE id = p_leito AND obito_aguardando_id IS NOT NULL) THEN
    -- lacuna 5 (O5)
    RAISE EXCEPTION 'Leito % aguarda a liberação do corpo: registre a liberação no óbito.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'higienizacao' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'liberacao', 'ocupado', 'higienizacao', v_perfil, 'Sem paciente: ' || btrim(p_motivo));
END; $function$;

-- situacao_leitos
CREATE OR REPLACE FUNCTION public.situacao_leitos(p_unidade uuid)
 RETURNS TABLE(leito_id uuid, identificador text, setor_id uuid, setor_nome text, status status_leito, desde timestamp with time zone, motivo text, pode_higienizar boolean, pode_bloquear boolean, reserva_paciente text, reserva_motivo text, reserva_expira_em timestamp with time zone, pode_reservar boolean, pode_cancelar_reserva boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_gestor boolean;
  v_enf boolean;
  v_tec boolean;
  v_med boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.membro_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_gestor := coalesce(private.sou_gestor_da_unidade(p_unidade), false);
  v_enf := private.tenho_papel(p_unidade, 'enfermeiro');
  v_tec := private.tenho_papel(p_unidade, 'tecnico_enfermagem');
  v_med := private.tenho_papel(p_unidade, 'plantonista');
  RETURN QUERY
  SELECT l.id, l.identificador, s.id, s.nome, l.status,
         ev.created_at,
         CASE WHEN l.status = 'bloqueado' THEN
           (SELECT e.motivo FROM public.eventos_leito e
             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1)
              -- lacuna 5 (O5): o leito segue ocupado com o corpo
              WHEN l.obito_aguardando_id IS NOT NULL THEN 'aguardando_corpo' END,
         v_gestor OR v_enf OR v_tec,
         v_gestor OR v_enf,
         p.nome, rv.motivo, rv.expira_em,
         v_gestor OR v_enf OR v_med,
         rv.id IS NOT NULL AND (v_gestor OR v_enf OR rv.reservado_por = v_perfil)
    FROM public.leitos l
    JOIN public.setores s ON s.id = l.setor_id
    LEFT JOIN LATERAL (SELECT e.created_at FROM public.eventos_leito e
                        WHERE e.leito_id = l.id ORDER BY e.created_at DESC LIMIT 1) ev ON true
    LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
    LEFT JOIN public.pacientes p ON p.id = rv.paciente_id
   WHERE s.unidade_id = p_unidade AND l.ativo
   ORDER BY s.nome, l.identificador;
END; $function$;

-- adicionar_plantao_escala
CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(p_unidade uuid, p_setor uuid, p_perfil uuid, p_data date, p_turno text, p_rotulo text DEFAULT NULL::text, p_quinzenal boolean DEFAULT false, p_papel papel DEFAULT NULL::papel)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_existente uuid;
  v_id uuid;
  v_inicio timestamptz;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo nesta unidade.';
  END IF;
  -- a categoria escolhida tem de ser um papel da pessoa (o gatilho confere de novo)
  IF p_papel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo AND v.papel = p_papel) THEN
    RAISE EXCEPTION 'Este profissional não tem o papel de % nesta unidade.', replace(p_papel::text, '_', ' ');
  END IF;

  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este profissional já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por, papel)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid(), p_papel)
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este profissional.';
  END IF;

  -- B3: plantão que já começou fica como acerto retroativo no histórico
  SELECT e.inicio INTO v_inicio FROM public.escala_plantao e WHERE e.id = v_id;
  IF v_inicio <= now() THEN
    PERFORM private.registrar_historico(p_unidade, v_id, 'retroativo',
      'Acerto retroativo: plantão escalado depois de começar',
      jsonb_build_object('data', p_data, 'turno', p_turno, 'perfil_id', p_perfil, 'papel', p_papel));
  END IF;

  RETURN v_id;
END;
$function$;

COMMIT;
