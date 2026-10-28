-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 4 (Webhooks), etapa 4.1: banco.
-- Decisões do RT em 27/10/2026 ("1a 2a 3a 4a 5a"):
--   1a  quem entrega é uma Edge Function chamada pelo pg_cron (etapa 4.2);
--   2a  evento enxuto: tipo, ids, unidade e data; nenhum dado de paciente sai
--       pelo webhook (o receptor busca o detalhe pela API v1, com a chave dele);
--   3a  os seis eventos do backlog;
--   4a  o super admin cadastra o destino (https, eventos, unidades), ligado a
--       uma chave da API; o gestor da unidade vê e desliga;
--   5a  Standard Webhooks (HMAC-SHA256), novas tentativas por até 24 h, depois
--       "falhou" com reenvio manual; destino que falha há 3 dias é desligado.
--
-- Esta etapa guarda: destinos (segredo no Vault), eventos e uma entrega por
-- destino. Nada sai do banco ainda; o envio é da 4.2.
-- O gatilho NUNCA derruba o fluxo clínico: sem destino ativo não grava nada, e
-- qualquer erro vira WARNING.
--
-- Eventos:
--   paciente.criado            INSERT em pacientes
--   atendimento.aberto         INSERT em episodios
--   atendimento.encerrado      episodios.etapa passa a 'encerrado'
--   internacao.iniciada        internacoes.internado_em preenchido
--   internacao.alta            internacoes.status passa a alta, óbito ou transferência
--                              (só de quem chegou a internar; a observação sai
--                              pelo atendimento.encerrado)
--   prescricao.assinada        prescricoes.status passa a 'assinada'
--   regulacao.status_alterado  regulacao_solicitacoes.status muda (fora rascunho e
--                              excluída), para a unidade de origem e a de destino
--
-- Rollback (ordem inversa):
--   DROP TRIGGER IF EXISTS trg_webhook ON public.pacientes;
--   DROP TRIGGER IF EXISTS trg_webhook ON public.episodios;
--   DROP TRIGGER IF EXISTS trg_webhook ON public.internacoes;
--   DROP TRIGGER IF EXISTS trg_webhook ON public.prescricoes;
--   DROP TRIGGER IF EXISTS trg_webhook ON public.regulacao_solicitacoes;
--   DELETE FROM vault.secrets WHERE id IN (SELECT segredo_id FROM public.webhook_destinos);
--   DROP TABLE IF EXISTS public.webhook_entregas, public.webhook_eventos, public.webhook_destinos;
--   DROP FUNCTION IF EXISTS private.trg_webhook_paciente(), private.trg_webhook_episodio(),
--     private.trg_webhook_internacao(), private.trg_webhook_prescricao(), private.trg_webhook_regulacao(),
--     public.webhook_criar_destino(text, text, uuid, uuid[], text[]), public.webhook_girar_segredo(uuid),
--     public.webhook_desligar_destino(uuid, text), public.webhook_religar_destino(uuid),
--     public.webhook_reenviar(uuid), public.webhook_destinos_lista(), public.webhook_entregas_do_destino(uuid, text),
--     private.webhook_emitir(uuid, text, uuid, jsonb), private.webhook_url_valida(text), private.webhook_tipos();
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.webhook_tipos()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY['paciente.criado', 'atendimento.aberto', 'atendimento.encerrado', 'internacao.iniciada',
               'internacao.alta', 'prescricao.assinada', 'regulacao.status_alterado']::text[]
$$;

-- Só https para um nome público: nada de IP, localhost ou rede interna (o
-- motor da 4.2 confere de novo antes de chamar).
CREATE OR REPLACE FUNCTION private.webhook_url_valida(p_url text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_url IS NOT NULL AND length(p_url) <= 2000
     AND p_url ~* '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?([/?][^\s#]*)?$'
     AND lower(substring(p_url FROM '^https://([^/:?]+)')) !~ '(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.test$|\.invalid$|^[0-9.]+$)'
$$;

CREATE TABLE IF NOT EXISTS public.webhook_destinos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 120),
  url                   text NOT NULL CHECK (private.webhook_url_valida(url)),
  chave_id              uuid NOT NULL REFERENCES public.api_chaves(id),
  unidades              uuid[] NOT NULL CHECK (cardinality(unidades) >= 1),
  eventos               text[] NOT NULL CHECK (cardinality(eventos) >= 1 AND eventos <@ private.webhook_tipos()),
  segredo_id            uuid NOT NULL,            -- vault.secrets.id
  segredo_girado_em     timestamptz,
  falhando_desde        timestamptz,              -- motor da 4.2: primeira falha sem sucesso depois
  desligado_em          timestamptz,
  desligado_por         uuid REFERENCES public.perfis(id),
  motivo_desligamento   text,
  desligado_automatico  boolean NOT NULL DEFAULT false,
  criado_por            uuid NOT NULL REFERENCES public.perfis(id),
  criado_em             timestamptz NOT NULL DEFAULT now(),
  CHECK ((desligado_em IS NULL) = (motivo_desligamento IS NULL))
);

CREATE TABLE IF NOT EXISTS public.webhook_eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  tipo         text NOT NULL CHECK (tipo = ANY (private.webhook_tipos())),
  recurso_id   uuid NOT NULL,
  dados        jsonb NOT NULL,
  ocorrido_em  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS webhook_eventos_unidade_idx ON public.webhook_eventos (unidade_id, ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS public.webhook_entregas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- vai no cabeçalho webhook-id
  evento_id       uuid NOT NULL REFERENCES public.webhook_eventos(id) ON DELETE CASCADE,
  destino_id      uuid NOT NULL REFERENCES public.webhook_destinos(id),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  situacao        text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'entregue', 'falhou', 'cancelada')),
  tentativas      integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  proxima_em      timestamptz NOT NULL DEFAULT clock_timestamp(),
  ultima_em       timestamptz,
  ultimo_status   integer,
  ultimo_erro     text CHECK (length(ultimo_erro) <= 500),
  entregue_em     timestamptz,
  reenviada_em    timestamptz,
  reenviada_por   uuid REFERENCES public.perfis(id),
  criada_em       timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (evento_id, destino_id)
);
CREATE INDEX IF NOT EXISTS webhook_entregas_fila_idx ON public.webhook_entregas (proxima_em) WHERE situacao = 'pendente';
CREATE INDEX IF NOT EXISTS webhook_entregas_destino_idx ON public.webhook_entregas (destino_id, criada_em DESC);

-- Só pelas funções abaixo (e pelo motor da 4.2, com service_role).
ALTER TABLE public.webhook_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_entregas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_destinos, public.webhook_eventos, public.webhook_entregas FROM PUBLIC, anon, authenticated;

-- ── emissão (gatilhos) ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.webhook_emitir(p_unidade uuid, p_tipo text, p_recurso uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_evento uuid;
BEGIN
  IF p_unidade IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.webhook_destinos d JOIN public.api_chaves c ON c.id = d.chave_id
        WHERE d.desligado_em IS NULL AND p_unidade = ANY (d.unidades) AND p_tipo = ANY (d.eventos)
          AND c.revogada_em IS NULL AND c.expira_em > now() AND p_unidade = ANY (c.unidades)) THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO public.webhook_eventos (unidade_id, tipo, recurso_id, dados)
    VALUES (p_unidade, p_tipo, p_recurso, jsonb_build_object('unidade_id', p_unidade) || coalesce(p_dados, '{}'::jsonb))
    RETURNING id INTO v_evento;
    INSERT INTO public.webhook_entregas (evento_id, destino_id, unidade_id)
    SELECT v_evento, d.id, p_unidade
      FROM public.webhook_destinos d JOIN public.api_chaves c ON c.id = d.chave_id
     WHERE d.desligado_em IS NULL AND p_unidade = ANY (d.unidades) AND p_tipo = ANY (d.eventos)
       AND c.revogada_em IS NULL AND c.expira_em > now() AND p_unidade = ANY (c.unidades);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'webhook % não registrado: %', p_tipo, SQLERRM;
  END;
END $$;
REVOKE ALL ON FUNCTION private.webhook_emitir(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.trg_webhook_paciente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.webhook_emitir(NEW.unidade_id, 'paciente.criado', NEW.id, jsonb_build_object('paciente_id', NEW.id));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.trg_webhook_episodio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb := jsonb_build_object('atendimento_id', NEW.id, 'paciente_id', NEW.paciente_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.webhook_emitir(NEW.unidade_id, 'atendimento.aberto', NEW.id, v_dados);
  ELSIF NEW.etapa = 'encerrado' AND OLD.etapa IS DISTINCT FROM 'encerrado' THEN
    PERFORM private.webhook_emitir(NEW.unidade_id, 'atendimento.encerrado', NEW.id, v_dados);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.trg_webhook_internacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_saida text[] := ARRAY['alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito'];
  v_dados jsonb := jsonb_build_object('internacao_id', NEW.id, 'paciente_id', NEW.paciente_id, 'atendimento_id', NEW.episodio_id);
BEGIN
  IF NEW.internado_em IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.internado_em IS NULL) THEN
    PERFORM private.webhook_emitir(NEW.unidade_id, 'internacao.iniciada', NEW.id, v_dados);
  END IF;
  IF NEW.internado_em IS NOT NULL AND NEW.status = ANY (v_saida)
     AND (TG_OP = 'INSERT' OR NOT (OLD.status = ANY (v_saida))) THEN
    PERFORM private.webhook_emitir(NEW.unidade_id, 'internacao.alta', NEW.id, v_dados);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.trg_webhook_prescricao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'assinada' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'assinada') THEN
    PERFORM private.webhook_emitir(NEW.unidade_id, 'prescricao.assinada', NEW.id,
      jsonb_build_object('prescricao_id', NEW.id, 'paciente_id', NEW.paciente_id,
                         'atendimento_id', NEW.episodio_id, 'internacao_id', NEW.internacao_id));
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.trg_webhook_regulacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dados jsonb; u uuid;
BEGIN
  IF NEW.status IN ('rascunho', 'excluida') OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NULL;
  END IF;
  v_dados := jsonb_build_object('solicitacao_id', NEW.id, 'numero', NEW.numero, 'tipo', NEW.tipo,
    'paciente_id', NEW.paciente_id, 'status', NEW.status,
    'status_anterior', CASE WHEN TG_OP = 'UPDATE' AND OLD.status <> 'rascunho' THEN OLD.status END);
  FOR u IN SELECT DISTINCT x FROM unnest(ARRAY[NEW.unidade_origem_id, NEW.destino_unidade_id]) x WHERE x IS NOT NULL LOOP
    PERFORM private.webhook_emitir(u, 'regulacao.status_alterado', NEW.id, v_dados);
  END LOOP;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.trg_webhook_paciente(), private.trg_webhook_episodio(), private.trg_webhook_internacao(),
  private.trg_webhook_prescricao(), private.trg_webhook_regulacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_webhook ON public.pacientes;
CREATE TRIGGER trg_webhook AFTER INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION private.trg_webhook_paciente();
DROP TRIGGER IF EXISTS trg_webhook ON public.episodios;
CREATE TRIGGER trg_webhook AFTER INSERT OR UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.trg_webhook_episodio();
DROP TRIGGER IF EXISTS trg_webhook ON public.internacoes;
CREATE TRIGGER trg_webhook AFTER INSERT OR UPDATE OF internado_em, status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_webhook_internacao();
DROP TRIGGER IF EXISTS trg_webhook ON public.prescricoes;
CREATE TRIGGER trg_webhook AFTER INSERT OR UPDATE OF status ON public.prescricoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_webhook_prescricao();
DROP TRIGGER IF EXISTS trg_webhook ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_webhook AFTER INSERT OR UPDATE OF status ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_webhook_regulacao();

-- ── administração dos destinos ──────────────────────────────────────────────
-- Cria o destino e devolve o segredo UMA vez (formato whsec_ do Standard Webhooks).
CREATE OR REPLACE FUNCTION public.webhook_criar_destino(p_nome text, p_url text, p_chave uuid, p_unidades uuid[], p_eventos text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.api_chaves; v_id uuid := gen_random_uuid(); v_segredo text; v_segredo_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma cadastra destino de webhook.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.api_chaves WHERE id = p_chave;
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    RAISE EXCEPTION 'Escolha uma chave da API válida (não revogada nem vencida).';
  END IF;
  IF p_unidades IS NULL OR cardinality(p_unidades) = 0 OR NOT (p_unidades <@ c.unidades) THEN
    RAISE EXCEPTION 'As unidades do destino precisam estar na chave escolhida.';
  END IF;
  IF p_eventos IS NULL OR cardinality(p_eventos) = 0 OR NOT (p_eventos <@ private.webhook_tipos()) THEN
    RAISE EXCEPTION 'Escolha os eventos da lista: %.', array_to_string(private.webhook_tipos(), ', ');
  END IF;
  IF NOT private.webhook_url_valida(btrim(coalesce(p_url, ''))) THEN
    RAISE EXCEPTION 'Endereço inválido: use https com um nome público (sem IP, localhost ou rede interna).';
  END IF;
  v_segredo := 'whsec_' || encode(extensions.gen_random_bytes(24), 'base64');
  v_segredo_id := vault.create_secret(v_segredo, 'webhook_destino_' || v_id, 'Segredo do destino de webhook ' || v_id);
  INSERT INTO public.webhook_destinos (id, nome, url, chave_id, unidades, eventos, segredo_id, criado_por)
  VALUES (v_id, btrim(p_nome), btrim(p_url), c.id, (SELECT array_agg(DISTINCT x) FROM unnest(p_unidades) x),
          (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_eventos) x), v_segredo_id, private.meu_perfil_id());
  PERFORM private.registrar_auditoria('webhook_destino_criado', 'webhook_destinos', v_id, p_unidades[1],
    jsonb_build_object('nome', btrim(p_nome), 'url', btrim(p_url), 'chave', c.prefixo, 'unidades', p_unidades, 'eventos', p_eventos));
  RETURN jsonb_build_object('id', v_id, 'segredo', v_segredo);
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'Confira o nome (3 a 120 letras) e o endereço.';
END $$;

CREATE OR REPLACE FUNCTION public.webhook_girar_segredo(p_destino uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.webhook_destinos; v_segredo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma troca o segredo.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO d FROM public.webhook_destinos WHERE id = p_destino FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destino não encontrado.'; END IF;
  v_segredo := 'whsec_' || encode(extensions.gen_random_bytes(24), 'base64');
  PERFORM vault.update_secret(d.segredo_id, v_segredo);
  UPDATE public.webhook_destinos SET segredo_girado_em = now() WHERE id = d.id;
  PERFORM private.registrar_auditoria('webhook_segredo_trocado', 'webhook_destinos', d.id, d.unidades[1],
    jsonb_build_object('nome', d.nome));
  RETURN jsonb_build_object('id', d.id, 'segredo', v_segredo);
END $$;

-- O gestor de uma unidade do destino desliga; as entregas pendentes são canceladas.
CREATE OR REPLACE FUNCTION public.webhook_desligar_destino(p_destino uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.webhook_destinos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.webhook_destinos WHERE id = p_destino FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destino não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.gestor_de_alguma(d.unidades)) THEN
    RAISE EXCEPTION 'Desliga a administração da plataforma ou o gestor de uma unidade do destino.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF d.desligado_em IS NOT NULL THEN RAISE EXCEPTION 'Este destino já está desligado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.webhook_destinos SET desligado_em = now(), desligado_por = private.meu_perfil_id(),
         motivo_desligamento = btrim(p_motivo), desligado_automatico = false WHERE id = d.id;
  UPDATE public.webhook_entregas SET situacao = 'cancelada' WHERE destino_id = d.id AND situacao = 'pendente';
  PERFORM private.registrar_auditoria('webhook_destino_desligado', 'webhook_destinos', d.id, d.unidades[1],
    jsonb_build_object('nome', d.nome, 'motivo', btrim(p_motivo)));
END $$;

CREATE OR REPLACE FUNCTION public.webhook_religar_destino(p_destino uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.webhook_destinos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma religa o destino.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO d FROM public.webhook_destinos WHERE id = p_destino FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destino não encontrado.'; END IF;
  IF d.desligado_em IS NULL THEN RAISE EXCEPTION 'Este destino já está ligado.'; END IF;
  UPDATE public.webhook_destinos SET desligado_em = NULL, desligado_por = NULL, motivo_desligamento = NULL,
         desligado_automatico = false, falhando_desde = NULL WHERE id = d.id;
  PERFORM private.registrar_auditoria('webhook_destino_religado', 'webhook_destinos', d.id, d.unidades[1],
    jsonb_build_object('nome', d.nome));
END $$;

-- Reenvio manual: a entrega volta à fila com o mesmo webhook-id (o receptor
-- descarta se já tiver recebido).
CREATE OR REPLACE FUNCTION public.webhook_reenviar(p_entrega uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.webhook_entregas; d public.webhook_destinos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.webhook_entregas WHERE id = p_entrega FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega não encontrada.'; END IF;
  SELECT * INTO d FROM public.webhook_destinos WHERE id = e.destino_id;
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(e.unidade_id)) THEN
    RAISE EXCEPTION 'Reenvia a administração da plataforma ou o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF d.desligado_em IS NOT NULL THEN RAISE EXCEPTION 'O destino está desligado: religue antes de reenviar.'; END IF;
  IF e.situacao NOT IN ('falhou', 'entregue', 'cancelada') THEN RAISE EXCEPTION 'Esta entrega já está na fila.'; END IF;
  UPDATE public.webhook_entregas SET situacao = 'pendente', tentativas = 0, proxima_em = clock_timestamp(),
         reenviada_em = now(), reenviada_por = private.meu_perfil_id() WHERE id = e.id;
  PERFORM private.registrar_auditoria('webhook_entrega_reenviada', 'webhook_entregas', e.id, e.unidade_id,
    jsonb_build_object('destino', d.nome, 'situacao_anterior', e.situacao));
END $$;

-- ── leitura (telas da 4.3) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.webhook_destinos_lista()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'nome', d.nome, 'url', d.url, 'eventos', to_jsonb(d.eventos),
      'chave', jsonb_build_object('id', c.id, 'nome', c.nome, 'prefixo', c.prefixo,
                                  'valida', c.revogada_em IS NULL AND c.expira_em > now()),
      'unidades', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome), '[]'::jsonb)
                     FROM public.unidades u WHERE u.id = ANY (d.unidades)),
      'ligado', d.desligado_em IS NULL, 'desligado_em', d.desligado_em, 'desligado_por', pd.nome_completo,
      'motivo_desligamento', d.motivo_desligamento, 'desligado_automatico', d.desligado_automatico,
      'falhando_desde', d.falhando_desde, 'segredo_girado_em', d.segredo_girado_em,
      'criado_por', pc.nome_completo, 'criado_em', d.criado_em,
      'entregas_24h', (SELECT jsonb_build_object(
          'entregue', count(*) FILTER (WHERE e.situacao = 'entregue'),
          'pendente', count(*) FILTER (WHERE e.situacao = 'pendente'),
          'falhou', count(*) FILTER (WHERE e.situacao = 'falhou'))
        FROM public.webhook_entregas e WHERE e.destino_id = d.id AND e.criada_em > now() - interval '24 hours'),
      'pode_editar', private.eh_super_admin())
      ORDER BY (d.desligado_em IS NULL) DESC, d.nome)
    FROM public.webhook_destinos d
    JOIN public.api_chaves c ON c.id = d.chave_id
    LEFT JOIN public.perfis pc ON pc.id = d.criado_por
    LEFT JOIN public.perfis pd ON pd.id = d.desligado_por
   WHERE private.eh_super_admin() OR private.gestor_de_alguma(d.unidades)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.webhook_entregas_do_destino(p_destino uuid, p_situacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.webhook_destinos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.webhook_destinos WHERE id = p_destino;
  IF NOT FOUND OR NOT (private.eh_super_admin() OR private.gestor_de_alguma(d.unidades)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'evento_id', ev.id, 'tipo', ev.tipo, 'ocorrido_em', ev.ocorrido_em, 'unidade', u.nome,
      'situacao', e.situacao, 'tentativas', e.tentativas, 'proxima_em', e.proxima_em, 'ultima_em', e.ultima_em,
      'ultimo_status', e.ultimo_status, 'ultimo_erro', e.ultimo_erro, 'entregue_em', e.entregue_em,
      'reenviada_em', e.reenviada_em) ORDER BY e.criada_em DESC)
    FROM (SELECT * FROM public.webhook_entregas x
           WHERE x.destino_id = p_destino AND (p_situacao IS NULL OR x.situacao = p_situacao)
             AND (private.eh_super_admin() OR private.gestor_da_unidade(x.unidade_id))
           ORDER BY x.criada_em DESC LIMIT 200) e
    JOIN public.webhook_eventos ev ON ev.id = e.evento_id
    LEFT JOIN public.unidades u ON u.id = e.unidade_id), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.webhook_criar_destino(text, text, uuid, uuid[], text[]), public.webhook_girar_segredo(uuid),
  public.webhook_desligar_destino(uuid, text), public.webhook_religar_destino(uuid), public.webhook_reenviar(uuid),
  public.webhook_destinos_lista(), public.webhook_entregas_do_destino(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.webhook_criar_destino(text, text, uuid, uuid[], text[]), public.webhook_girar_segredo(uuid),
  public.webhook_desligar_destino(uuid, text), public.webhook_religar_destino(uuid), public.webhook_reenviar(uuid),
  public.webhook_destinos_lista(), public.webhook_entregas_do_destino(uuid, text) TO authenticated;
