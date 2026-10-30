-- ════════════════════════════════════════════════════════════════════════════
-- Bug alto A4 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- "assumir o plantão" não existia. Quem recebia a passagem não via o pedido, não
-- aceitava e não era avisado; o plantão era empurrado sem o colega saber. Na
-- troca, o colega só aprovava (A2 tirou dele a aplicação).
--
-- Decisão do RT em 30/10/2026 (proposta A), igual para passagem e troca:
--  1. o pedido nasce esperando o colega, que recebe aviso no sino;
--  2. o colega aceita ou recusa (pedidos_para_mim, aceitar_passagem,
--     recusar_passagem, aceitar_troca, recusar_troca); recusa encerra e avisa;
--  3. aceito, o pedido vai ao gestor, que aprova (aplica e avisa os dois) ou
--     recusa (avisa os dois); o gestor não aprova antes do aceite;
--  4. na unidade com escala_passagem_exige_aprovacao = false, o aceite já aplica;
--  5. quem pediu cancela enquanto o gestor não decide (cancelar_pedido_escala,
--     cancelar_troca).
-- Os avisos vão para notificacoes_plantonista (o sino de todos os papéis).
--
-- Expand: colunas novas aceito_em (nulas); status 'cancelado' acrescentado ao
-- CHECK de solicitacoes_escala (o conjunto antigo continua valendo); funções
-- novas; corpos novos de passar_plantao, solicitar_troca, aprovar_troca,
-- recusar_troca e private.passagem_aprovada. O UPDATE direto de
-- solicitacoes_escala fica só nas colunas status e decidido_por (a tela do
-- gestor grava só essas); a inserção direta não grava aceite nem decisão.
-- Sem DROP/RENAME de coluna. Idempotente.
-- Teste: supabase/tests/escala_aceite_colega.sql
--
-- Rollback (nesta ordem):
--   DROP TRIGGER IF EXISTS trg_passagem_avisos ON public.solicitacoes_escala;
--   DROP TRIGGER IF EXISTS trg_solicitacao_insercao ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.passagem_avisos(), private.solicitacao_insercao(),
--     public.pedidos_para_mim(uuid), public.aceitar_passagem(uuid), public.recusar_passagem(uuid, text),
--     public.cancelar_pedido_escala(uuid), public.aceitar_troca(uuid), public.cancelar_troca(uuid),
--     private.avisar(uuid, uuid, date, text, text), private.avisar_gestores(uuid, date, text, text),
--     private.descrever_plantao(uuid);
--   GRANT UPDATE ON public.solicitacoes_escala TO authenticated;
--   reaplicar passar_plantao e solicitar_troca de 20261019000001_fix_redteam_v3_v4.sql
--   (com o search_path vazio de 20261022000022), aprovar_troca de 20270208000005,
--   recusar_troca de 20260815000028 e private.passagem_aprovada de 20270208000002.
--   As colunas aceito_em e o status 'cancelado' podem ficar (expand).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. colunas e status ────────────────────────────────────────────────────
ALTER TABLE public.solicitacoes_escala ADD COLUMN IF NOT EXISTS aceito_em timestamptz;
ALTER TABLE public.trocas_plantao ADD COLUMN IF NOT EXISTS aceito_em timestamptz;
ALTER TABLE public.solicitacoes_escala DROP CONSTRAINT IF EXISTS solicitacoes_escala_status_check;
ALTER TABLE public.solicitacoes_escala ADD CONSTRAINT solicitacoes_escala_status_check
  CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado'));

-- o gestor decide pela tela (status e decidido_por); o aceite só pelas funções
REVOKE UPDATE ON public.solicitacoes_escala FROM anon, authenticated;
GRANT UPDATE (status, decidido_por) ON public.solicitacoes_escala TO authenticated;

-- inserção direta pela API (justificar falta, sair do fixo) nasce pendente, sem
-- aceite nem decisão. Sem SECURITY DEFINER: current_user é quem insere; as RPCs
-- (SECURITY DEFINER) e as cargas do servidor não passam por aqui.
CREATE OR REPLACE FUNCTION private.solicitacao_insercao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := 'pendente';
    NEW.aceito_em := NULL;
    NEW.decidido_por := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.solicitacao_insercao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_solicitacao_insercao ON public.solicitacoes_escala;
CREATE TRIGGER trg_solicitacao_insercao BEFORE INSERT ON public.solicitacoes_escala
  FOR EACH ROW EXECUTE FUNCTION private.solicitacao_insercao();

-- ── 2. avisos ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.avisar(p_perfil uuid, p_unidade uuid, p_data date, p_tipo text, p_msg text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT p_perfil, p_unidade, coalesce(p_data, private.data_atual()), p_tipo, p_msg
   WHERE p_perfil IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING
$function$;
REVOKE ALL ON FUNCTION private.avisar(uuid, uuid, date, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.avisar_gestores(p_unidade uuid, p_data date, p_tipo text, p_msg text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  SELECT private.avisar(v.perfil_id, p_unidade, p_data, p_tipo, p_msg)
    FROM (SELECT DISTINCT perfil_id FROM public.vinculos
           WHERE unidade_id = p_unidade AND papel = 'gestor' AND ativo) v
$function$;
REVOKE ALL ON FUNCTION private.avisar_gestores(uuid, date, text, text) FROM PUBLIC, anon, authenticated;

-- "Pronto Socorro em 30/10 (manhã)"
CREATE OR REPLACE FUNCTION private.descrever_plantao(p_plantao uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT coalesce(s.nome, 'setor') || ' em ' || to_char(e.data, 'DD/MM') || ' ('
         || CASE e.turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END || ')'
    FROM public.escala_plantao e LEFT JOIN public.setores s ON s.id = e.setor_id
   WHERE e.id = p_plantao
$function$;
REVOKE ALL ON FUNCTION private.descrever_plantao(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.nome_de(p_perfil uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT coalesce((SELECT nome_completo FROM public.perfis WHERE id = p_perfil), 'Um colega')
$function$;
REVOKE ALL ON FUNCTION private.nome_de(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. passagem ────────────────────────────────────────────────────────────
-- Corpo de 20261019000001 (V4); sai a aplicação automática (agora vem do aceite)
-- e entra o aviso ao colega.
CREATE OR REPLACE FUNCTION public.passar_plantao(p_escala uuid, p_destino uuid, p_justificativa text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_solic uuid;
BEGIN
  SELECT * INTO v_escala FROM public.escala_plantao WHERE id = p_escala AND ativo;
  IF v_escala.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado';
  END IF;
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_escala.perfil_id IS DISTINCT FROM v_perfil
     AND (private.papel_na_unidade(v_escala.unidade_id) = 'gestor' OR private.eh_super_admin()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_escala.perfil_id = p_destino THEN
    RAISE EXCEPTION 'O destino não pode ser o próprio plantonista';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_destino AND v.unidade_id = v_escala.unidade_id AND v.ativo) THEN
    RAISE EXCEPTION 'O destino não tem vínculo ativo nesta unidade.';
  END IF;
  IF private.tem_conflito_plantao(p_destino, v_escala.unidade_id, v_escala.setor_id, v_escala.data, v_escala.turno, NULL) THEN
    PERFORM private.registrar_historico(v_escala.unidade_id, p_escala, 'erro_passagem',
      'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário',
      jsonb_build_object('destino', p_destino, 'tipo', 'passagem'));
    RAISE EXCEPTION 'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário';
  END IF;

  INSERT INTO public.solicitacoes_escala
    (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por)
  VALUES
    (v_escala.unidade_id, p_escala, v_perfil, 'passar_plantao', 'pendente', p_destino, p_justificativa, v_perfil)
  RETURNING id INTO v_solic;

  PERFORM private.registrar_historico(v_escala.unidade_id, p_escala, 'passagem_solicitada',
    'Passagem de plantão solicitada', jsonb_build_object('destino', p_destino, 'solicitacao', v_solic));
  PERFORM private.avisar(p_destino, v_escala.unidade_id, v_escala.data, 'passagem_pedida_' || v_solic,
    private.nome_de(v_perfil) || ' quer passar o plantão de ' || private.descrever_plantao(p_escala)
      || ' para você. Aceite ou recuse na aba Escala.');
  RETURN v_solic;
END;
$function$;

-- o colega aceita; na unidade sem aprovação do gestor, aplica na hora
CREATE OR REPLACE FUNCTION public.aceitar_passagem(p_solicitacao uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_s public.solicitacoes_escala%ROWTYPE;
  v_aprovacao boolean;
  v_pl public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.solicitacoes_escala WHERE id = p_solicitacao AND tipo = 'passar_plantao';
  IF v_s.id IS NULL OR v_s.destino_perfil_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_s.status <> 'pendente' THEN RAISE EXCEPTION 'O pedido não está mais pendente.'; END IF;
  IF v_s.aceito_em IS NOT NULL THEN RAISE EXCEPTION 'Você já aceitou esta passagem; falta a coordenação.'; END IF;
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = v_s.escala_plantao_id;

  UPDATE public.solicitacoes_escala SET aceito_em = now(), updated_at = now() WHERE id = p_solicitacao;
  PERFORM private.registrar_historico(v_s.unidade_id, v_s.escala_plantao_id, 'passagem_aceita',
    'Passagem aceita pelo colega', jsonb_build_object('solicitacao', p_solicitacao, 'por', v_perfil));

  SELECT (valor = 'true') INTO v_aprovacao FROM public.configuracoes_unidade
   WHERE unidade_id = v_s.unidade_id AND chave = 'escala_passagem_exige_aprovacao';
  IF coalesce(v_aprovacao, true) IS FALSE THEN
    -- o gatilho trg_passagem_aprovada aplica e trg_passagem_avisos avisa
    UPDATE public.solicitacoes_escala SET status = 'aprovado', decidido_por = v_perfil WHERE id = p_solicitacao;
    RETURN 'aplicada';
  END IF;

  PERFORM private.avisar(v_s.perfil_id, v_s.unidade_id, v_pl.data, 'passagem_aceita_' || p_solicitacao,
    private.nome_de(v_perfil) || ' aceitou o plantão de ' || private.descrever_plantao(v_pl.id)
      || '. Falta a coordenação aprovar; até lá o plantão continua com você.');
  PERFORM private.avisar_gestores(v_s.unidade_id, v_pl.data, 'passagem_aceita_' || p_solicitacao,
    'Passagem para aprovar: ' || private.nome_de(v_s.perfil_id) || ' → ' || private.nome_de(v_perfil)
      || ', ' || private.descrever_plantao(v_pl.id) || '. Veja em Escala › Pedidos.');
  RETURN 'aceita';
END;
$function$;

CREATE OR REPLACE FUNCTION public.recusar_passagem(p_solicitacao uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_s public.solicitacoes_escala%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.solicitacoes_escala WHERE id = p_solicitacao AND tipo = 'passar_plantao';
  IF v_s.id IS NULL OR v_s.destino_perfil_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_s.status <> 'pendente' THEN RAISE EXCEPTION 'O pedido não está mais pendente.'; END IF;
  -- trg_passagem_avisos avisa quem pediu
  UPDATE public.solicitacoes_escala SET status = 'recusado', decidido_por = v_perfil WHERE id = p_solicitacao;
  PERFORM private.registrar_historico(v_s.unidade_id, v_s.escala_plantao_id, 'passagem_recusada',
    coalesce(nullif(btrim(p_motivo), ''), 'Recusada pelo colega'), jsonb_build_object('solicitacao', p_solicitacao, 'por', v_perfil));
END;
$function$;

-- quem pediu cancela qualquer pedido seu ainda pendente
CREATE OR REPLACE FUNCTION public.cancelar_pedido_escala(p_solicitacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_s public.solicitacoes_escala%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.solicitacoes_escala WHERE id = p_solicitacao;
  IF v_s.id IS NULL OR v_s.perfil_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_s.status <> 'pendente' THEN RAISE EXCEPTION 'O pedido não está mais pendente.'; END IF;
  UPDATE public.solicitacoes_escala SET status = 'cancelado', decidido_por = v_perfil WHERE id = p_solicitacao;
  PERFORM private.registrar_historico(v_s.unidade_id, v_s.escala_plantao_id, 'pedido_cancelado',
    'Pedido cancelado por quem pediu', jsonb_build_object('solicitacao', p_solicitacao, 'tipo', v_s.tipo));
END;
$function$;

-- Gatilho da C2 (20270208000002): entra a exigência do aceite do colega.
CREATE OR REPLACE FUNCTION private.passagem_aprovada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
BEGIN
  IF NEW.aceito_em IS NULL THEN
    RAISE EXCEPTION 'O colega ainda não aceitou a passagem. Espere o aceite ou recuse o pedido.';
  END IF;
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id AND ativo;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'O plantão da passagem não está mais ativo.';
  END IF;
  IF v_pl.perfil_id IS DISTINCT FROM NEW.perfil_id THEN
    RAISE EXCEPTION 'A passagem não confere com a escala: o plantão não é mais de quem pediu. Recuse o pedido.';
  END IF;
  IF NEW.destino_perfil_id IS NULL OR NEW.destino_perfil_id = v_pl.perfil_id THEN
    RAISE EXCEPTION 'A passagem não tem destino válido. Recuse o pedido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = NEW.destino_perfil_id AND v.unidade_id = v_pl.unidade_id AND v.ativo) THEN
    RAISE EXCEPTION 'O destino não tem vínculo ativo nesta unidade.';
  END IF;
  IF private.tem_conflito_plantao(NEW.destino_perfil_id, v_pl.unidade_id, v_pl.setor_id, v_pl.data, v_pl.turno, v_pl.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o destino já tem plantão no mesmo horário.';
  END IF;

  UPDATE public.escala_plantao
     SET perfil_id = NEW.destino_perfil_id, updated_at = now()
   WHERE id = v_pl.id;

  PERFORM private.registrar_historico(v_pl.unidade_id, v_pl.id, 'passagem_aplicada',
    'Passagem aprovada pelo gestor',
    jsonb_build_object('solicitacao', NEW.id, 'de', v_pl.perfil_id, 'para', NEW.destino_perfil_id,
                       'decidido_por', NEW.decidido_por));
  RETURN NEW;
END;
$function$;

-- avisos da decisão da passagem (aprovada, recusada, cancelada)
CREATE OR REPLACE FUNCTION private.passagem_avisos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
  v_desc text;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id;
  v_desc := coalesce(private.descrever_plantao(NEW.escala_plantao_id), 'plantão');
  IF NEW.status = 'aprovado' THEN
    PERFORM private.avisar(NEW.perfil_id, NEW.unidade_id, v_pl.data, 'passagem_decidida_' || NEW.id,
      'Passagem aprovada: o plantão de ' || v_desc || ' agora é de ' || private.nome_de(NEW.destino_perfil_id) || '.');
    PERFORM private.avisar(NEW.destino_perfil_id, NEW.unidade_id, v_pl.data, 'passagem_decidida_' || NEW.id,
      'Passagem aprovada: o plantão de ' || v_desc || ' agora é seu.');
  ELSIF NEW.status = 'recusado' AND NEW.decidido_por IS NOT DISTINCT FROM NEW.destino_perfil_id THEN
    PERFORM private.avisar(NEW.perfil_id, NEW.unidade_id, v_pl.data, 'passagem_decidida_' || NEW.id,
      private.nome_de(NEW.destino_perfil_id) || ' recusou o plantão de ' || v_desc || '. O plantão continua com você.');
  ELSIF NEW.status = 'recusado' THEN
    PERFORM private.avisar(NEW.perfil_id, NEW.unidade_id, v_pl.data, 'passagem_decidida_' || NEW.id,
      'A coordenação recusou a passagem do plantão de ' || v_desc || '. O plantão continua com você.');
    PERFORM private.avisar(NEW.destino_perfil_id, NEW.unidade_id, v_pl.data, 'passagem_decidida_' || NEW.id,
      'A coordenação recusou a passagem do plantão de ' || v_desc || ' para você.');
  ELSIF NEW.status = 'cancelado' AND NEW.aceito_em IS NOT NULL THEN
    PERFORM private.avisar(NEW.destino_perfil_id, NEW.unidade_id, v_pl.data, 'passagem_cancelada_' || NEW.id,
      private.nome_de(NEW.perfil_id) || ' cancelou a passagem do plantão de ' || v_desc || '.');
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.passagem_avisos() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_passagem_avisos ON public.solicitacoes_escala;
CREATE TRIGGER trg_passagem_avisos
  AFTER UPDATE OF status ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'passar_plantao' AND OLD.status = 'pendente' AND NEW.status <> 'pendente')
  EXECUTE FUNCTION private.passagem_avisos();

-- ── 4. troca ───────────────────────────────────────────────────────────────
-- Corpo de 20261019000001 (V4); sai a aplicação automática (agora vem do aceite)
-- e entra o aviso ao colega.
CREATE OR REPLACE FUNCTION public.solicitar_troca(p_plantao_a uuid, p_plantao_b uuid, p_mensagem text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_a public.escala_plantao%ROWTYPE;
  v_b public.escala_plantao%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_a FROM public.escala_plantao WHERE id = p_plantao_a AND ativo;
  SELECT * INTO v_b FROM public.escala_plantao WHERE id = p_plantao_b AND ativo;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'Plantões inválidos';
  END IF;
  IF v_a.unidade_id <> v_b.unidade_id THEN
    RAISE EXCEPTION 'Os plantões devem pertencer à mesma unidade';
  END IF;
  IF v_a.perfil_id <> v_perfil THEN
    RAISE EXCEPTION 'Você só pode oferecer seus próprios plantões';
  END IF;
  IF v_b.perfil_id IS NULL OR v_b.perfil_id = v_perfil THEN
    RAISE EXCEPTION 'O plantão B deve pertencer a outro plantonista';
  END IF;

  INSERT INTO public.trocas_plantao
    (unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, mensagem, criado_por)
  VALUES
    (v_a.unidade_id, v_a.id, v_perfil, v_b.id, v_b.perfil_id, p_mensagem, v_perfil)
  RETURNING id INTO v_id;

  PERFORM private.registrar_historico(v_a.unidade_id, v_a.id, 'troca_solicitada',
    format('Troca solicitada: %s <-> %s', v_a.rotulo, v_b.rotulo),
    jsonb_build_object('troca_id', v_id));
  PERFORM private.avisar(v_b.perfil_id, v_a.unidade_id, v_b.data, 'troca_pedida_' || v_id,
    private.nome_de(v_perfil) || ' quer trocar: você fica com ' || private.descrever_plantao(v_a.id)
      || ' e passa ' || private.descrever_plantao(v_b.id) || '. Aceite ou recuse na aba Escala.');
  RETURN v_id;
END;
$function$;

-- aplica a troca e avisa os dois (usado pelo gestor e pelo aceite sem aprovação)
CREATE OR REPLACE FUNCTION private.efetivar_troca(p_troca uuid, p_decisor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_t public.trocas_plantao%ROWTYPE;
  v_data date;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  PERFORM private.aplicar_troca(v_t);
  UPDATE public.trocas_plantao SET status = 'aprovado', decidido_por = p_decisor, updated_at = now() WHERE id = p_troca;
  PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_aprovada',
    'Troca aprovada', jsonb_build_object('troca_id', p_troca));
  SELECT data INTO v_data FROM public.escala_plantao WHERE id = v_t.plantao_a_id;
  PERFORM private.avisar(v_t.perfil_a_id, v_t.unidade_id, v_data, 'troca_decidida_' || p_troca,
    'Troca aprovada: agora você está em ' || private.descrever_plantao(v_t.plantao_b_id) || '.');
  PERFORM private.avisar(v_t.perfil_b_id, v_t.unidade_id, v_data, 'troca_decidida_' || p_troca,
    'Troca aprovada: agora você está em ' || private.descrever_plantao(v_t.plantao_a_id) || '.');
END;
$function$;
REVOKE ALL ON FUNCTION private.efetivar_troca(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aceitar_troca(p_troca uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_aprovacao boolean;
  v_data date;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL OR v_t.perfil_b_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_t.status <> 'pendente' THEN RAISE EXCEPTION 'O pedido não está mais pendente.'; END IF;
  IF v_t.aceito_em IS NOT NULL THEN RAISE EXCEPTION 'Você já aceitou esta troca; falta a coordenação.'; END IF;
  UPDATE public.trocas_plantao SET aceito_em = now(), updated_at = now() WHERE id = p_troca;
  PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_aceita',
    'Troca aceita pelo colega', jsonb_build_object('troca_id', p_troca));

  SELECT (valor = 'true') INTO v_aprovacao FROM public.configuracoes_unidade
   WHERE unidade_id = v_t.unidade_id AND chave = 'escala_passagem_exige_aprovacao';
  IF coalesce(v_aprovacao, true) IS FALSE THEN
    PERFORM private.efetivar_troca(p_troca, v_perfil);
    RETURN 'aplicada';
  END IF;

  SELECT data INTO v_data FROM public.escala_plantao WHERE id = v_t.plantao_a_id;
  PERFORM private.avisar(v_t.perfil_a_id, v_t.unidade_id, v_data, 'troca_aceita_' || p_troca,
    private.nome_de(v_perfil) || ' aceitou a troca. Falta a coordenação aprovar.');
  PERFORM private.avisar_gestores(v_t.unidade_id, v_data, 'troca_aceita_' || p_troca,
    'Troca para aprovar: ' || private.nome_de(v_t.perfil_a_id) || ' (' || private.descrever_plantao(v_t.plantao_a_id)
      || ') com ' || private.nome_de(v_perfil) || ' (' || private.descrever_plantao(v_t.plantao_b_id) || '). Veja em Escala › Pedidos.');
  RETURN 'aceita';
END;
$function$;

-- Corpo de 20270208000005 (A2): entra a exigência do aceite e os avisos.
CREATE OR REPLACE FUNCTION public.aprovar_troca(p_troca uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  -- A2: só o gestor da unidade (ou o super admin) põe a troca na escala
  IF NOT (private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Só o gestor da unidade aprova a troca. O colega pode recusar.';
  END IF;
  -- A4: depois do aceite do colega
  IF v_t.aceito_em IS NULL THEN
    RAISE EXCEPTION 'O colega ainda não aceitou a troca. Espere o aceite ou recuse o pedido.';
  END IF;
  PERFORM private.efetivar_troca(p_troca, v_perfil);
END;
$function$;

-- Corpo de 20260815000028: entram os avisos.
CREATE OR REPLACE FUNCTION public.recusar_troca(p_troca uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_data date;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  IF NOT (v_t.perfil_b_id = v_perfil OR private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.trocas_plantao SET status = 'recusado', decidido_por = v_perfil, updated_at = now() WHERE id = p_troca;
  PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_recusada',
    coalesce(p_motivo, 'sem justificativa'), jsonb_build_object('troca_id', p_troca));
  SELECT data INTO v_data FROM public.escala_plantao WHERE id = v_t.plantao_a_id;
  IF v_t.perfil_b_id = v_perfil THEN
    PERFORM private.avisar(v_t.perfil_a_id, v_t.unidade_id, v_data, 'troca_decidida_' || p_troca,
      private.nome_de(v_perfil) || ' recusou a troca. Seus plantões continuam como estavam.');
  ELSE
    PERFORM private.avisar(v_t.perfil_a_id, v_t.unidade_id, v_data, 'troca_decidida_' || p_troca,
      'A coordenação recusou a troca. Seus plantões continuam como estavam.');
    PERFORM private.avisar(v_t.perfil_b_id, v_t.unidade_id, v_data, 'troca_decidida_' || p_troca,
      'A coordenação recusou a troca. Seus plantões continuam como estavam.');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_troca(p_troca uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_data date;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL OR v_t.perfil_a_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_t.status <> 'pendente' THEN RAISE EXCEPTION 'O pedido não está mais pendente.'; END IF;
  UPDATE public.trocas_plantao SET status = 'cancelada', decidido_por = v_perfil, updated_at = now() WHERE id = p_troca;
  PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'troca_cancelada',
    'Troca cancelada por quem pediu', jsonb_build_object('troca_id', p_troca));
  IF v_t.aceito_em IS NOT NULL THEN
    SELECT data INTO v_data FROM public.escala_plantao WHERE id = v_t.plantao_a_id;
    PERFORM private.avisar(v_t.perfil_b_id, v_t.unidade_id, v_data, 'troca_cancelada_' || p_troca,
      private.nome_de(v_perfil) || ' cancelou a troca que você tinha aceitado.');
  END IF;
END;
$function$;

-- ── 5. pedidos para mim (o colega que recebe) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.pedidos_para_mim(p_unidade uuid)
RETURNS TABLE (tipo text, id uuid, de_nome text, recebo text, recebo_data date, entrego text,
               mensagem text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT 'passagem', s.id, private.nome_de(s.perfil_id), private.descrever_plantao(s.escala_plantao_id), e.data,
         NULL::text, s.justificativa, s.created_at
    FROM public.solicitacoes_escala s JOIN public.escala_plantao e ON e.id = s.escala_plantao_id
   WHERE s.unidade_id = p_unidade AND s.tipo = 'passar_plantao' AND s.status = 'pendente' AND s.aceito_em IS NULL
     AND s.destino_perfil_id = private.meu_perfil_id()
  UNION ALL
  SELECT 'troca', t.id, private.nome_de(t.perfil_a_id), private.descrever_plantao(t.plantao_a_id), a.data,
         private.descrever_plantao(t.plantao_b_id), t.mensagem, t.created_at
    FROM public.trocas_plantao t JOIN public.escala_plantao a ON a.id = t.plantao_a_id
   WHERE t.unidade_id = p_unidade AND t.status = 'pendente' AND t.aceito_em IS NULL
     AND t.perfil_b_id = private.meu_perfil_id()
  ORDER BY 8 DESC
$function$;

REVOKE ALL ON FUNCTION public.pedidos_para_mim(uuid), public.aceitar_passagem(uuid), public.recusar_passagem(uuid, text),
  public.cancelar_pedido_escala(uuid), public.aceitar_troca(uuid), public.cancelar_troca(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedidos_para_mim(uuid), public.aceitar_passagem(uuid), public.recusar_passagem(uuid, text),
  public.cancelar_pedido_escala(uuid), public.aceitar_troca(uuid), public.cancelar_troca(uuid) TO authenticated;
