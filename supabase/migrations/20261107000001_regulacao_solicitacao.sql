-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 1 — solicitação de regulação. Decisões do RT em 10/10/2026
-- (BACKLOG.md):
--
-- • A Central de Regulação é uma unidade da organização marcada pelo super
--   admin como central (uma por organização). Os médicos reguladores ficam
--   vinculados a ela com o papel "regulador" e recebem as solicitações de todas
--   as unidades da organização.
-- • Abre a solicitação o médico (plantonista da unidade de origem) ou o gestor
--   (NIR), que pode enviar direto com a justificativa; o médico assistente fica
--   informado. O autor é sempre quem está logado.
-- • Tipos: consulta (especialidade), exame (procedimento SIGTAP), leito (tipo
--   de leito) e transferência (tipo de transporte).
-- • Destino: unidade da rede, serviço de fora (texto) ou "a definir".
-- • Prioridade: emergência, urgência, prioritária (não urgente) e eletiva.
-- • Justificativa: texto livre e CID-10.
-- • Pode ser ligada a um atendimento ou internação aberta, ou só ao paciente.
-- • Regulação externa: a central anota o sistema e o número do protocolo.
--
-- Fila, revisão de prioridade e decisão são as tarefas 2 a 4.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.centrais_regulacao (
  organizacao_id  uuid PRIMARY KEY REFERENCES public.organizacoes(id),
  unidade_id      uuid NOT NULL UNIQUE REFERENCES public.unidades(id),
  definida_por    uuid NOT NULL REFERENCES public.perfis(id),
  definida_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regulacao_solicitacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              bigint GENERATED ALWAYS AS IDENTITY,
  organizacao_id      uuid NOT NULL REFERENCES public.organizacoes(id),
  central_id          uuid NOT NULL REFERENCES public.unidades(id),
  unidade_origem_id   uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  tipo                text NOT NULL CHECK (tipo IN ('consulta', 'exame', 'leito', 'transferencia')),
  especialidade       text,
  procedimento        text,
  tipo_leito          text CHECK (tipo_leito IN ('enfermaria', 'uti_adulto', 'uti_pediatrica', 'uti_neonatal',
                                                 'semi_intensiva', 'isolamento', 'obstetrico', 'psiquiatria', 'outro')),
  transporte          text CHECK (transporte IN ('ambulancia_basica', 'ambulancia_avancada', 'uti_movel',
                                                 'transporte_sanitario', 'aereo', 'meios_proprios')),
  destino_tipo        text NOT NULL CHECK (destino_tipo IN ('rede', 'externo', 'a_definir')),
  destino_unidade_id  uuid REFERENCES public.unidades(id),
  destino_externo     text,
  prioridade          text NOT NULL CHECK (prioridade IN ('emergencia', 'urgencia', 'prioritaria', 'eletiva')),
  cid                 text NOT NULL,
  justificativa       text NOT NULL,
  medico_assistente_id uuid REFERENCES public.perfis(id),
  solicitante_id      uuid NOT NULL REFERENCES public.perfis(id),
  solicitante_papel   text NOT NULL CHECK (solicitante_papel IN ('medico', 'gestor')),
  status              text NOT NULL DEFAULT 'enviada'
                      CHECK (status IN ('enviada', 'em_analise', 'aceita', 'recusada', 'devolvida', 'cancelada', 'concluida')),
  externo_sistema     text,
  externo_protocolo   text,
  criada_em           timestamptz NOT NULL DEFAULT now(),
  cancelada_em        timestamptz,
  cancelada_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CHECK (tipo <> 'consulta' OR especialidade IS NOT NULL),
  CHECK (tipo <> 'exame' OR procedimento IS NOT NULL),
  CHECK (tipo <> 'leito' OR tipo_leito IS NOT NULL),
  CHECK (tipo <> 'transferencia' OR transporte IS NOT NULL),
  CHECK (destino_tipo <> 'rede' OR destino_unidade_id IS NOT NULL),
  CHECK (destino_tipo <> 'externo' OR length(btrim(coalesce(destino_externo, ''))) >= 3),
  CHECK (length(btrim(justificativa)) >= 20),
  CHECK (status <> 'cancelada' OR (cancelada_em IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 10))
);
CREATE INDEX IF NOT EXISTS idx_regulacao_central ON public.regulacao_solicitacoes (central_id, status, criada_em);
CREATE INDEX IF NOT EXISTS idx_regulacao_origem ON public.regulacao_solicitacoes (unidade_origem_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_regulacao_paciente ON public.regulacao_solicitacoes (paciente_id, criada_em DESC);

-- histórico: só inserção
CREATE TABLE IF NOT EXISTS public.regulacao_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  evento          text NOT NULL,
  por             uuid NOT NULL REFERENCES public.perfis(id),
  em              timestamptz NOT NULL DEFAULT now(),
  detalhes        jsonb
);
CREATE INDEX IF NOT EXISTS idx_regulacao_eventos ON public.regulacao_eventos (solicitacao_id, em);
DROP TRIGGER IF EXISTS trg_regulacao_eventos_so_insercao ON public.regulacao_eventos;
CREATE TRIGGER trg_regulacao_eventos_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_eventos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.centrais_regulacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulacao_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulacao_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.centrais_regulacao, public.regulacao_solicitacoes, public.regulacao_eventos FROM anon, authenticated;
-- leitura e escrita só pelas RPCs abaixo

-- ── apoio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_evento(p_sol uuid, p_evento text, p_detalhes jsonb DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.regulacao_eventos (solicitacao_id, evento, por, detalhes)
  VALUES (p_sol, p_evento, private.meu_perfil_id(), p_detalhes)
$$;
REVOKE ALL ON FUNCTION private.regulacao_evento(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Quem vê a solicitação: a origem (médico ou gestor), a central (regulador ou
-- gestor da central) e o super admin.
CREATE OR REPLACE FUNCTION private.regulacao_pode_ver(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin()
      OR private.tenho_papel(s.unidade_origem_id, 'plantonista') OR private.tenho_papel(s.unidade_origem_id, 'gestor')
      OR private.tenho_papel(s.central_id, 'regulador') OR private.tenho_papel(s.central_id, 'gestor')
$$;
REVOKE ALL ON FUNCTION private.regulacao_pode_ver(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_json(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'status', s.status, 'tipo', s.tipo, 'prioridade', s.prioridade,
    'especialidade', s.especialidade,
    'procedimento', s.procedimento,
    'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = s.procedimento),
    'tipo_leito', s.tipo_leito, 'transporte', s.transporte,
    'destino_tipo', s.destino_tipo,
    'destino_unidade', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.destino_unidade_id),
    'destino_externo', s.destino_externo,
    'cid', s.cid, 'cid_descricao', (SELECT c.descricao FROM terminologia.cid10 c WHERE c.codigo = s.cid),
    'justificativa', s.justificativa,
    'paciente', (SELECT jsonb_build_object('id', pa.id, 'nome', coalesce(pa.nome_social, pa.nome), 'nascimento', pa.data_nascimento,
                                           'sexo', pa.sexo, 'cns', pa.cns) FROM public.pacientes pa WHERE pa.id = s.paciente_id),
    'episodio_id', s.episodio_id, 'internacao_id', s.internacao_id,
    'origem', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.unidade_origem_id),
    'central', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.central_id),
    'solicitante', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.solicitante_id),
    'solicitante_papel', s.solicitante_papel,
    'medico_assistente', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.medico_assistente_id),
    'externo_sistema', s.externo_sistema, 'externo_protocolo', s.externo_protocolo,
    'criada_em', s.criada_em, 'cancelada_em', s.cancelada_em, 'motivo_cancelamento', s.motivo_cancelamento)
$$;
REVOKE ALL ON FUNCTION private.regulacao_json(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- ── central da organização ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_definir_central(p_unidade uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.unidades;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma define a central de regulação.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade inexistente ou inativa.'; END IF;
  INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
  VALUES (u.organizacao_id, u.id, private.meu_perfil_id())
  ON CONFLICT (organizacao_id) DO UPDATE SET unidade_id = excluded.unidade_id, definida_por = excluded.definida_por, definida_em = now();
  PERFORM private.registrar_auditoria('regulacao_central_definida', 'centrais_regulacao', u.id, u.id,
    jsonb_build_object('organizacao_id', u.organizacao_id));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_central(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_central(uuid) TO authenticated;

-- Central da organização de uma unidade (para a tela), e se a unidade é a central.
CREATE OR REPLACE FUNCTION public.regulacao_contexto(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.centrais_regulacao;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT cr.* INTO c FROM public.centrais_regulacao cr JOIN public.unidades u ON u.organizacao_id = cr.organizacao_id
   WHERE u.id = p_unidade;
  RETURN jsonb_build_object(
    'central', CASE WHEN c.unidade_id IS NULL THEN NULL
                    ELSE (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = c.unidade_id) END,
    'sou_central', c.unidade_id = p_unidade,
    'pode_solicitar', private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor'),
    'sou_regulador', c.unidade_id IS NOT NULL AND private.tenho_papel(c.unidade_id, 'regulador'),
    'sou_super_admin', private.eh_super_admin(),
    -- unidades da rede, para o destino
    'unidades_rede', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
                       FROM public.unidades u
                      WHERE u.ativo AND u.organizacao_id = (SELECT organizacao_id FROM public.unidades WHERE id = p_unidade)
                        AND u.id IS DISTINCT FROM c.unidade_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_contexto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_contexto(uuid) TO authenticated;

-- Para o super admin: cada organização e a sua central.
CREATE OR REPLACE FUNCTION public.regulacao_centrais()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'organizacao_id', o.id, 'organizacao', o.nome,
      'central', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.centrais_regulacao c
                    JOIN public.unidades u ON u.id = c.unidade_id WHERE c.organizacao_id = o.id),
      'unidades', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
                              FROM public.unidades u WHERE u.organizacao_id = o.id AND u.ativo), '[]'::jsonb))
      ORDER BY o.nome)
    FROM public.organizacoes o WHERE o.ativo), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_centrais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_centrais() TO authenticated;

-- ── solicitar ───────────────────────────────────────────────────────────────
-- p_dados: tipo, especialidade, procedimento, tipo_leito, transporte,
-- destino_tipo, destino_unidade_id, destino_externo, prioridade, cid,
-- justificativa, episodio_id, internacao_id, medico_assistente_id.
CREATE OR REPLACE FUNCTION public.regulacao_solicitar(p_unidade uuid, p_paciente uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  u public.unidades; c public.centrais_regulacao; s public.regulacao_solicitacoes;
  v_papel text; v_medico uuid; v_ep uuid; v_int uuid; v_dest uuid; v_cid text; v_proc text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade inexistente.'; END IF;
  IF private.tenho_papel(p_unidade, 'plantonista') THEN v_papel := 'medico';
  ELSIF private.tenho_papel(p_unidade, 'gestor') THEN v_papel := 'gestor';
  ELSE RAISE EXCEPTION 'Abre a solicitação o médico ou o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.centrais_regulacao WHERE organizacao_id = u.organizacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A rede ainda não tem Central de Regulação. Fale com a administração da plataforma.'; END IF;
  IF c.unidade_id = p_unidade THEN RAISE EXCEPTION 'A central não solicita regulação para si mesma.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = p_unidade AND ativo) THEN
    RAISE EXCEPTION 'Paciente não encontrado nesta unidade.';
  END IF;

  -- vínculo opcional com atendimento ou internação aberta do mesmo paciente
  v_ep := nullif(d->>'episodio_id', '')::uuid;
  v_int := nullif(d->>'internacao_id', '')::uuid;
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = p_paciente
                                         AND e.unidade_id = p_unidade AND e.etapa <> 'encerrado') THEN
    RAISE EXCEPTION 'O atendimento informado não está aberto para este paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = p_paciente
                                          AND i.unidade_id = p_unidade AND i.data_alta IS NULL) THEN
    RAISE EXCEPTION 'A internação informada não está aberta para este paciente.';
  END IF;

  -- médico assistente: o próprio médico; o gestor pode informar um médico da unidade
  IF v_papel = 'medico' THEN
    v_medico := private.meu_perfil_id();
  ELSE
    v_medico := nullif(d->>'medico_assistente_id', '')::uuid;
    IF v_medico IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = v_medico
                                              AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'plantonista') THEN
      RAISE EXCEPTION 'O médico assistente precisa ser médico da unidade.';
    END IF;
  END IF;

  -- CID como na tabela (J18.9); aceita também sem o ponto (J189)
  v_cid := upper(btrim(coalesce(d->>'cid', '')));
  IF v_cid ~ '^[A-Z]\d{3}$' THEN v_cid := left(v_cid, 3) || '.' || right(v_cid, 1); END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.cid10 x WHERE x.codigo = v_cid) THEN
    RAISE EXCEPTION 'Informe um CID-10 válido.';
  END IF;
  IF d->>'tipo' = 'exame' THEN
    v_proc := regexp_replace(coalesce(d->>'procedimento', ''), '\D', '', 'g');
    IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento p WHERE p.codigo = v_proc) THEN
      RAISE EXCEPTION 'Informe um procedimento do SIGTAP.';
    END IF;
  END IF;
  IF d->>'destino_tipo' = 'rede' THEN
    v_dest := nullif(d->>'destino_unidade_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.unidades x WHERE x.id = v_dest AND x.ativo AND x.organizacao_id = u.organizacao_id
                     AND x.id <> c.unidade_id) THEN
      RAISE EXCEPTION 'O destino precisa ser uma unidade ativa da rede.';
    END IF;
    IF v_dest = p_unidade THEN RAISE EXCEPTION 'O destino não pode ser a própria unidade.'; END IF;
  END IF;

  BEGIN
    INSERT INTO public.regulacao_solicitacoes (organizacao_id, central_id, unidade_origem_id, paciente_id, episodio_id, internacao_id,
      tipo, especialidade, procedimento, tipo_leito, transporte, destino_tipo, destino_unidade_id, destino_externo,
      prioridade, cid, justificativa, medico_assistente_id, solicitante_id, solicitante_papel)
    VALUES (u.organizacao_id, c.unidade_id, p_unidade, p_paciente, v_ep, v_int,
      d->>'tipo',
      CASE WHEN d->>'tipo' = 'consulta' THEN nullif(btrim(coalesce(d->>'especialidade', '')), '') END,
      CASE WHEN d->>'tipo' = 'exame' THEN v_proc END,
      CASE WHEN d->>'tipo' = 'leito' THEN nullif(d->>'tipo_leito', '') END,
      CASE WHEN d->>'tipo' = 'transferencia' THEN nullif(d->>'transporte', '') END,
      d->>'destino_tipo', v_dest,
      CASE WHEN d->>'destino_tipo' = 'externo' THEN btrim(coalesce(d->>'destino_externo', '')) END,
      d->>'prioridade', v_cid, btrim(coalesce(d->>'justificativa', '')), v_medico, private.meu_perfil_id(), v_papel)
    RETURNING * INTO s;
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    RAISE EXCEPTION 'Confira o pedido: tipo, o campo do tipo (especialidade, procedimento, tipo de leito ou transporte), destino, prioridade e justificativa (mínimo de 20 letras).';
  END;
  PERFORM private.regulacao_evento(s.id, 'enviada', jsonb_build_object('papel', v_papel));
  PERFORM private.registrar_auditoria('regulacao_solicitada', 'regulacao_solicitacoes', s.id, p_unidade,
    jsonb_build_object('tipo', s.tipo, 'prioridade', s.prioridade, 'central', c.unidade_id));
  RETURN jsonb_build_object('id', s.id, 'numero', s.numero);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_solicitar(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_solicitar(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_cancelar(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (s.solicitante_id = private.meu_perfil_id() OR private.tenho_papel(s.unidade_origem_id, 'gestor')) THEN
    RAISE EXCEPTION 'Cancela quem solicitou ou o gestor da unidade de origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'devolvida') THEN RAISE EXCEPTION 'Esta solicitação não pode mais ser cancelada.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.regulacao_solicitacoes SET status = 'cancelada', cancelada_em = now(), cancelada_por = private.meu_perfil_id(),
         motivo_cancelamento = btrim(p_motivo) WHERE id = s.id;
  PERFORM private.regulacao_evento(s.id, 'cancelada', jsonb_build_object('motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_cancelada', 'regulacao_solicitacoes', s.id, s.unidade_origem_id,
    jsonb_build_object('motivo', btrim(p_motivo)));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_cancelar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_cancelar(uuid, text) TO authenticated;

-- A central anota a regulação externa (sistema e número do protocolo).
CREATE OR REPLACE FUNCTION public.regulacao_registrar_externo(p_id uuid, p_sistema text, p_protocolo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.tenho_papel(s.central_id, 'regulador') THEN
    RAISE EXCEPTION 'Quem anota a regulação externa é o regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_sistema, ''))) < 2 OR length(btrim(coalesce(p_protocolo, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o sistema e o número do protocolo.';
  END IF;
  UPDATE public.regulacao_solicitacoes SET externo_sistema = btrim(p_sistema), externo_protocolo = btrim(p_protocolo) WHERE id = s.id;
  PERFORM private.regulacao_evento(s.id, 'externo_registrado', jsonb_build_object('sistema', btrim(p_sistema), 'protocolo', btrim(p_protocolo)));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_registrar_externo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_registrar_externo(uuid, text, text) TO authenticated;

-- ── listas ──────────────────────────────────────────────────────────────────
-- Na unidade de origem: as solicitações da unidade. Na central: as recebidas
-- (a fila completa, com filtros e ordem por prioridade, é a tarefa 2).
CREATE OR REPLACE FUNCTION public.regulacao_lista(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_central boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_unidade);
  IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor') OR private.tenho_papel(p_unidade, 'plantonista')
          OR (v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.regulacao_json(s) ORDER BY s.criada_em DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes
           WHERE (v_central AND central_id = p_unidade) OR (NOT v_central AND unidade_origem_id = p_unidade)
           ORDER BY criada_em DESC LIMIT 200) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_lista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_lista(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_detalhe(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  RETURN private.regulacao_json(s) || jsonb_build_object('eventos', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'evento', e.evento, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.por), 'em', e.em, 'detalhes', e.detalhes)
      ORDER BY e.em) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_detalhe(uuid) TO authenticated;

-- Atendimento ou internação aberta do paciente, para ligar a solicitação.
CREATE OR REPLACE FUNCTION public.regulacao_vinculos_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.tenho_papel(v_unidade, 'plantonista') OR private.tenho_papel(v_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'episodio', (SELECT jsonb_build_object('id', e.id, 'chegada_em', e.chegada_em, 'etapa', e.etapa) FROM public.episodios e
                  WHERE e.paciente_id = p_paciente AND e.unidade_id = v_unidade AND e.etapa <> 'encerrado'
                  ORDER BY e.chegada_em DESC LIMIT 1),
    'internacao', (SELECT jsonb_build_object('id', i.id, 'admissao_em', i.data_admissao,
                     'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = i.leito_atual_id)) FROM public.internacoes i
                    WHERE i.paciente_id = p_paciente AND i.unidade_id = v_unidade AND i.data_alta IS NULL
                    ORDER BY i.data_admissao DESC LIMIT 1),
    'medicos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome_completo) ORDER BY p.nome_completo)
                  FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
                 WHERE v.unidade_id = v_unidade AND v.ativo AND v.papel = 'plantonista'), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_vinculos_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_vinculos_paciente(uuid) TO authenticated;
