-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 7 do Portão de 11/10/2026: documento e checklist de transferência.
-- Diagnóstico e decisão do RT (10/11/2026, A em T1 a T9):
--   docs/porta/LACUNA-07-TRANSFERENCIA-DIAGNOSTICO.md
--
-- Fontes (texto conferido em 10/11/2026):
--   - Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1: (a) o médico
--     solicita a vaga à Central e faz contato prévio com o serviço que recebe;
--     (b) estabiliza antes de remover; (d) a decisão de transferir é médica;
--     (f) o documento de transferência acompanha o paciente e compõe o
--     prontuário de quem recebe, com diagnóstico de entrada, exames e condutas,
--     nome, CRM e assinatura do solicitante; (g) autorização escrita do
--     paciente ou do responsável, salvo quando não for possível; (h) o médico
--     solicitante responde até o paciente ser recebido; (l) onde há Central de
--     Regulação, nenhuma transferência sem contato com ela. Item 3.3 (e): as
--     intercorrências do transporte são registradas no documento.
--   - Resolução CFM nº 1.672/2003, Art. 1º: estabilização prévia (II); contato
--     e concordância do médico que recebe (IV); relatório completo, legível e
--     assinado, com CRM, também assinado por quem recebe (VI); consentimento
--     escrito, dispensável com risco de morte e sem responsável (VII); neonato
--     em ambulância com incubadora de transporte (IX).
--   - Resolução CFM nº 2.079/2014 (UPA 24h), Arts. 9º e 10: registro completo
--     com a identificação dos médicos; diálogo com o regulador.
--   - Resolução CFM nº 2.110/2014, Art. 18: o paciente transferido vai com
--     relatório completo do quadro clínico.
--
-- O que faz:
--   T1  tipo novo em documentos_clinicos: documento_transferencia ("Documento
--       de transferência", o nome da Portaria 2.048). Só nasce pela RPC
--       public.emitir_documento_transferencia: emitir_documento e salvar_rascunho
--       continuam recusando o tipo (listas próprias), então ninguém grava um
--       documento de transferência sem a fotografia do servidor.
--   T2/T3  public.dados_transferencia(paciente): a fotografia do momento, montada
--       no servidor (modelo: private.contrarreferencia_gerar): identificação,
--       unidade, setor e leito de origem, diagnóstico de entrada (o primeiro
--       registro do atendimento e o CID da internação), alergias, últimos sinais
--       vitais crus (public.observacao), prescrição ativa com a validade
--       (prescricao_itens.valida_ate, lacuna 6), exames com resultado,
--       dispositivos, isolamento, contenção ativa, controlados em uso
--       (medicamento.controlado_lista) e a regulação (número, protocolo,
--       destino, aceite e transporte). O médico escreve o resumo clínico, as
--       condutas e o motivo da transferência; o resto fica só para leitura.
--       O conteúdo do documento guarda a fotografia e os três textos (jsonb).
--   T4  public.transferencia_checklist: um registro por item e por
--       atendimento (porta: o episódio; observação e internação: a
--       internação). Itens do médico: contato prévio e aceite do destino (nome
--       de quem aceitou), regulação (número, ou o motivo de não haver),
--       autorização escrita (paciente ou responsável, ou a exceção justificada),
--       paciente estabilizado (declaração) e tipo de transporte. Itens da
--       enfermagem: isolamento informado ao destino, incubadora (só no
--       recém-nascido, até 27 dias de vida, a faixa de cadastrar_rn) e quem da
--       equipe acompanha. Cada item: feito, ou "não se aplica" com o motivo.
--   T5  a única trava: a transferência externa (registrar_desfecho
--       'transferencia', dar_alta 'transferencia_externa' e, por ela,
--       finalizar_observacao 'transferencia') é recusada sem documento de
--       transferência emitido e em vigor (nem cancelado nem substituído) daquele
--       atendimento. O checklist fica registrado e não trava (vaga zero e
--       emergência não esperam).
--   T6  emite o médico de plantão em cuidado do paciente, ou o médico da porta
--       que abriu a observação, enquanto ela está aberta (a regra do
--       encerramento, 20270305000001) (autor = login; a
--       folha leva o registro do cadastro, private.folha_registro); marca os
--       itens de enfermagem o enfermeiro em cuidado; o NIR da unidade lê.
--   T7  só a transferência externa (porta, observação e internação).
--   T8  folha A4 em duas vias (src/lib/folhas.ts): folha_documento passa o
--       checklist do momento da impressão (chave checklist_atual).
--   T9  public.transferencia_da_regulacao(solicitação): a Regulação, o NIR e o
--       destino na rede leem o documento, com a mesma regra de quem vê o pedido
--       (private.regulacao_pode_ver), mais a enfermagem de plantão no destino
--       e quem cuida do paciente no destino depois da chegada. Nada é copiado
--       para o cadastro do destino.
--   cancelar_documento aceita o tipo novo (o autor cancela com o motivo; o
--   cancelado deixa de contar para a trava).
--
-- Funções trocadas trecho a trecho pelo texto atual (pg_get_functiondef),
-- como em 20270326000001: trecho que sumiu para a migration com erro; trecho
-- já trocado é pulado (reaplicável); corpo CRLF continua CRLF. Conferido em
-- 10/11/2026 na homologação: registrar_desfecho, dar_alta, cancelar_documento
-- e folha_documento (mesma assinatura).
--
-- Só expande: tabela, índices e funções novos; a CHECK de
-- documentos_clinicos.tipo_documento fica maior; quatro funções com trecho novo.
-- Teste: supabase/tests/transferencia.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das funções
-- trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── T1: o tipo novo ─────────────────────────────────────────────────────────
ALTER TABLE public.documentos_clinicos DROP CONSTRAINT IF EXISTS documentos_clinicos_tipo_documento_check;
ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento = ANY (ARRAY[
  'admissao_anamnese', 'evolucao', 'prescricao', 'sumario_alta', 'sumario_obito', 'atestado', 'termo_consentimento',
  'boletim_emergencia', 'partograma', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'teleinterconsulta',
  'parecer', 'evolucao_enfermagem', 'anotacao_enfermagem', 'evolucao_fisioterapia', 'evolucao_nutricao', 'evolucao_outros',
  'reavaliacao_quadro', 'documento_transferencia'])) NOT VALID;
ALTER TABLE public.documentos_clinicos VALIDATE CONSTRAINT documentos_clinicos_tipo_documento_check;
-- a trava procura o documento vigente do atendimento
CREATE INDEX IF NOT EXISTS documentos_transferencia_vigente ON public.documentos_clinicos (episodio_id, internacao_id)
  WHERE tipo_documento = 'documento_transferencia' AND estado IN ('ativo', 'assinado');

-- ── T4: o checklist ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transferencia_checklist (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id    uuid REFERENCES public.episodios(id),
  -- observação e internação: o atendimento é a internação
  internacao_id  uuid REFERENCES public.internacoes(id),
  item           text NOT NULL CHECK (item IN ('contato_destino', 'regulacao', 'autorizacao', 'estabilizado', 'transporte',
                                               'isolamento_informado', 'incubadora', 'acompanhante_equipe')),
  situacao       text NOT NULL CHECK (situacao IN ('feito', 'nao_se_aplica')),
  -- contato_destino: nome de quem aceitou; regulacao: número ou protocolo;
  -- autorizacao: paciente ou responsavel; transporte: o tipo (os da regulação);
  -- acompanhante_equipe: medico, enfermagem ou medico_e_enfermagem
  detalhe        text CHECK (length(detalhe) <= 120),
  motivo         text CHECK (length(motivo) <= 500),
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  papel          text NOT NULL CHECK (papel IN ('plantonista', 'enfermeiro')),
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transferencia_checklist_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  CONSTRAINT transferencia_checklist_motivo CHECK (situacao = 'feito' OR length(btrim(coalesce(motivo, ''))) >= 10)
);
COMMENT ON TABLE public.transferencia_checklist IS
  'Lacuna 7 (T4): checklist da transferência externa, um item por atendimento (porta: episódio; observação e internação: internação). Registra e não trava (só o documento trava). Leitura e escrita só pelas RPCs.';
CREATE UNIQUE INDEX IF NOT EXISTS transferencia_checklist_item ON public.transferencia_checklist ((coalesce(internacao_id, episodio_id)), item);
CREATE INDEX IF NOT EXISTS transferencia_checklist_unidade_id_fk_idx ON public.transferencia_checklist (unidade_id);
CREATE INDEX IF NOT EXISTS transferencia_checklist_paciente_id_fk_idx ON public.transferencia_checklist (paciente_id);
CREATE INDEX IF NOT EXISTS transferencia_checklist_episodio_id_fk_idx ON public.transferencia_checklist (episodio_id);
CREATE INDEX IF NOT EXISTS transferencia_checklist_internacao_id_fk_idx ON public.transferencia_checklist (internacao_id);
CREATE INDEX IF NOT EXISTS transferencia_checklist_registrado_por_fk_idx ON public.transferencia_checklist (registrado_por);
ALTER TABLE public.transferencia_checklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transferencia_checklist FROM anon, authenticated;

-- ── o atendimento aberto do paciente ────────────────────────────────────────
-- internação ou observação ativa primeiro; senão o episódio da porta em atendimento
CREATE OR REPLACE FUNCTION private.transferencia_contexto(p_paciente uuid)
RETURNS TABLE (episodio_id uuid, internacao_id uuid, origem text, unidade_id uuid, setor_id uuid, leito_id uuid, entrada_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.ep, x.it, x.ori, x.uni, x.se, x.le, x.ent FROM (
    SELECT i.episodio_id AS ep, i.id AS it, CASE WHEN i.status = 'em_observacao' THEN 'observacao' ELSE 'internacao' END AS ori,
           i.unidade_id AS uni, i.setor_atual_id AS se, i.leito_atual_id AS le, i.data_admissao AS ent, 1 AS ordem
      FROM public.internacoes i
     WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
    UNION ALL
    SELECT e.id, NULL::uuid, 'porta', e.unidade_id, e.setor_id, NULL::uuid, e.chegada_em, 2
      FROM public.episodios e
     WHERE e.paciente_id = p_paciente AND e.etapa = 'atendimento') x
  ORDER BY x.ordem, x.ent DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.transferencia_contexto(uuid) FROM PUBLIC, anon, authenticated;

-- quem cuida do paciente (escala do setor, gestor) e também o médico da porta
-- que abriu a observação, enquanto ela está aberta: ele encerra a observação
-- (20270305000001), pede parecer e registra alergia (20270307000005,
-- 20270308000008); sem isto ele não emitiria o documento da transferência
-- que pode registrar
CREATE OR REPLACE FUNCTION private.transferencia_atuo(p_paciente uuid, p_internacao uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.pode_atuar_no_paciente(p_paciente), false)
      OR (p_internacao IS NOT NULL AND EXISTS (SELECT 1 FROM public.internacoes i
                                                WHERE i.id = p_internacao AND i.paciente_id = p_paciente
                                                  AND coalesce(private.abriu_a_observacao(i), false)))
$$;
REVOKE ALL ON FUNCTION private.transferencia_atuo(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- recém-nascido: até 27 dias de vida (a faixa de cadastrar_rn, 20261124000001)
CREATE OR REPLACE FUNCTION private.transferencia_neonato(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT pa.data_nascimento >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 27
                     FROM public.pacientes pa WHERE pa.id = p_paciente), false)
$$;
REVOKE ALL ON FUNCTION private.transferencia_neonato(uuid) FROM PUBLIC, anon, authenticated;

-- a regulação de leito ou de transferência deste atendimento (a mais recente em curso)
CREATE OR REPLACE FUNCTION private.transferencia_regulacao(p_paciente uuid, p_episodio uuid, p_internacao uuid)
RETURNS public.regulacao_solicitacoes LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s FROM public.regulacao_solicitacoes s
   WHERE s.paciente_id = p_paciente AND s.tipo IN ('transferencia', 'leito')
     AND s.status NOT IN ('rascunho', 'negada', 'cancelada', 'excluida')
     AND ((p_internacao IS NOT NULL AND s.internacao_id = p_internacao) OR (p_episodio IS NOT NULL AND s.episodio_id = p_episodio))
   ORDER BY s.criada_em DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.transferencia_regulacao(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── T2/T3: a fotografia do momento ──────────────────────────────────────────
-- Sinais vitais crus: o valor como foi gravado, sem marca de alterado.
CREATE OR REPLACE FUNCTION private.transferencia_dados(p_paciente uuid, p_episodio uuid, p_internacao uuid, p_origem text,
                                                       p_setor uuid, p_leito uuid, p_entrada timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  u public.unidades;
  r public.regulacao_solicitacoes := private.transferencia_regulacao(p_paciente, p_episodio, p_internacao);
  v_reg jsonb;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  SELECT * INTO u FROM public.unidades WHERE id = pa.unidade_id;
  IF r.id IS NOT NULL THEN
    v_reg := jsonb_strip_nulls(jsonb_build_object(
      'id', r.id, 'numero', r.numero, 'tipo', r.tipo, 'status', r.status,
      'sistema_externo', r.externo_sistema, 'protocolo_externo', r.externo_protocolo,
      'destino', coalesce((SELECT x.nome FROM public.unidades x WHERE x.id = r.destino_unidade_id), r.destino_externo),
      'destino_na_rede', r.destino_unidade_id IS NOT NULL,
      'transporte', coalesce(r.transporte_central, r.transporte), 'incubadora', r.incubadora,
      'isolamento', CASE WHEN r.isolamento THEN coalesce(r.isolamento_tipo, 'sim') END,
      'autorizada_em', r.autorizada_em, 'data_prevista', r.data_prevista,
      'aceite', (SELECT jsonb_strip_nulls(jsonb_build_object('em', a.em, 'por', coalesce(nullif(btrim(a.externo_quem), ''), pf.nome_completo),
                                                              'registro', a.por_registro, 'meio', a.externo_meio))
                   FROM public.regulacao_destino_respostas a LEFT JOIN public.perfis pf ON pf.id = a.por
                  WHERE a.solicitacao_id = r.id AND a.resposta = 'aceita' ORDER BY a.em DESC LIMIT 1)));
  END IF;
  RETURN jsonb_build_object(
    'tirado_em', now(),
    'identificacao', jsonb_strip_nulls(jsonb_build_object(
      'nome', pa.nome, 'nome_social', nullif(btrim(coalesce(pa.nome_social, '')), ''), 'nascimento', pa.data_nascimento,
      'sexo', pa.sexo, 'cns', pa.cns, 'prontuario', pa.prontuario, 'neonato', private.transferencia_neonato(p_paciente))),
    'origem', jsonb_strip_nulls(jsonb_build_object(
      'atendimento', p_origem, 'unidade', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf,
      'setor', (SELECT s.nome FROM public.setores s WHERE s.id = p_setor),
      'leito', (SELECT l.identificador FROM public.leitos l WHERE l.id = p_leito),
      'entrada_em', p_entrada)),
    -- diagnóstico de entrada (Portaria 2.048, 3.1 f): o primeiro registro do atendimento
    'diagnostico_entrada', (SELECT jsonb_strip_nulls(jsonb_build_object(
                              'hipotese', nullif(btrim(coalesce(ar.avaliacao, '')), ''), 'cid', ar.cid,
                              'cid_descricao', (SELECT c.descricao FROM terminologia.cid10 c WHERE c.codigo IN (ar.cid, replace(ar.cid, '.', '')) LIMIT 1),
                              'em', ar.criado_em))
                              FROM public.atendimento_registros ar
                             WHERE ar.episodio_id = p_episodio ORDER BY ar.criado_em LIMIT 1),
    'cid_internacao', (SELECT i.cid_principal FROM public.internacoes i WHERE i.id = p_internacao),
    'alergias', jsonb_build_object(
      'estado', public.estado_alergia(p_paciente),
      'itens', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('substancia', a.substancia, 'tipo', a.tipo,
                                                                               'gravidade', a.gravidade, 'reacao', a.reacao))
                                          ORDER BY a.registrado_em)
                           FROM public.alergias_paciente a WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL), '[]'::jsonb)),
    'sinais_vitais', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('conceito', x.nome, 'valor', x.valor, 'unidade', x.unidade,
                                                                                      'aferido_em', x.aferido_em)) ORDER BY x.ordem, x.nome)
      FROM (SELECT DISTINCT ON (o.conceito_id) c.nome, c.ordem_exibicao AS ordem,
                   coalesce(nullif(o.valor_texto, ''), o.valor_num::text,
                            (SELECT vc.nome FROM public.conceito vc WHERE vc.id = o.valor_conceito_id)) AS valor,
                   coalesce(nullif(o.unidade, ''), c.unidade_padrao) AS unidade, o.aferido_em
              FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
             WHERE o.paciente_id = p_paciente AND c.categoria = 'sinal_vital'
               AND (o.episodio_id = p_episodio OR (p_internacao IS NOT NULL AND o.internacao_id = p_internacao))
             ORDER BY o.conceito_id, o.aferido_em DESC, o.created_at DESC) x), '[]'::jsonb),
    'prescricao', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                     'descricao', it.descricao, 'tipo', it.tipo, 'dose', it.dose, 'via', it.via, 'posologia', it.posologia,
                     'se_necessario', it.se_necessario, 'valida_ate', it.valida_ate,
                     'vencido', it.valida_ate IS NOT NULL AND it.valida_ate < now(), 'controlado', m.controlado_lista))
                   ORDER BY pr.created_at, it.ordem, it.created_at)
      FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
      LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
     WHERE pr.paciente_id = p_paciente AND pr.status = 'ativa' AND it.suspenso_em IS NULL
       AND (pr.episodio_id = p_episodio OR (p_internacao IS NOT NULL AND pr.internacao_id = p_internacao))), '[]'::jsonb),
    'controlados', coalesce((SELECT jsonb_agg(jsonb_build_object('descricao', it.descricao, 'lista', m.controlado_lista) ORDER BY it.descricao)
      FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
      JOIN public.medicamento m ON m.id = it.medicamento_id
     WHERE pr.paciente_id = p_paciente AND pr.status = 'ativa' AND it.suspenso_em IS NULL AND m.controlado_lista IS NOT NULL
       AND (pr.episodio_id = p_episodio OR (p_internacao IS NOT NULL AND pr.internacao_id = p_internacao))), '[]'::jsonb),
    'exames', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'exame', x.exame, 'situacao', x.situacao, 'pedido_em', x.pedido_em,
                  'resultado', coalesce(nullif(btrim(coalesce(er.texto, '')), ''), nullif(btrim(coalesce(x.resultado, '')), '')),
                  'liberado_em', coalesce(er.liberado_em, x.resolvido_em),
                  'itens', (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('analito', ri.analito,
                                     'valor', coalesce(nullif(ri.valor_texto, ''), ri.valor_num::text), 'unidade', ri.unidade,
                                     'referencia', ri.referencia)) ORDER BY ri.ordem)
                              FROM public.exame_resultado_itens ri WHERE ri.resultado_id = er.id)))
                ORDER BY x.pedido_em)
      FROM public.exames_pedidos x
      LEFT JOIN LATERAL (SELECT * FROM public.exame_resultados z WHERE z.exame_id = x.id AND z.vigente ORDER BY z.versao DESC LIMIT 1) er ON true
     WHERE x.paciente_id = p_paciente AND x.situacao <> 'cancelado'
       AND (x.episodio_id = p_episodio OR (p_internacao IS NOT NULL AND x.internacao_id = p_internacao))), '[]'::jsonb),
    'dispositivos', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('tipo', dv.tipo, 'local', dv.local, 'calibre', dv.calibre,
                                                                                    'inserido_em', dv.inserido_em)) ORDER BY dv.registrado_em)
      FROM public.dispositivos_enfermagem dv
     WHERE dv.paciente_id = p_paciente AND dv.retirado_em IS NULL
       AND (dv.episodio_id = p_episodio OR (p_internacao IS NOT NULL AND dv.internacao_id = p_internacao))), '[]'::jsonb),
    'isolamento', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', s.tipo, 'desde', s.marcado_em) ORDER BY s.marcado_em)
      FROM public.isolamentos_paciente s WHERE s.paciente_id = p_paciente AND s.retirado_em IS NULL), '[]'::jsonb),
    'contencao', coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('desde', k.iniciada_em, 'locais', to_jsonb(k.locais),
                                                                                 'motivo', k.motivo)) ORDER BY k.iniciada_em)
      FROM public.contencoes k WHERE k.paciente_id = p_paciente AND k.retirada_em IS NULL), '[]'::jsonb),
    'regulacao', v_reg);
END $$;
REVOKE ALL ON FUNCTION private.transferencia_dados(uuid, uuid, uuid, text, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── o documento vigente do atendimento ──────────────────────────────────────
-- porta: o do episódio sem internação; observação e internação: o da internação
CREATE OR REPLACE FUNCTION private.transferencia_documento_vigente(p_episodio uuid, p_internacao uuid)
RETURNS public.documentos_clinicos LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d FROM public.documentos_clinicos d
   WHERE d.tipo_documento = 'documento_transferencia' AND d.estado IN ('ativo', 'assinado')
     AND CASE WHEN p_internacao IS NOT NULL THEN d.internacao_id = p_internacao
              ELSE d.episodio_id = p_episodio AND d.internacao_id IS NULL END
   ORDER BY d.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.transferencia_documento_vigente(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- T5: a trava (registrar_desfecho e dar_alta)
CREATE OR REPLACE FUNCTION private.transferencia_documento_emitido(p_episodio uuid, p_internacao uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (private.transferencia_documento_vigente(p_episodio, p_internacao)).id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION private.transferencia_documento_emitido(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── T4: o checklist como lista (os oito itens, na ordem) ────────────────────
CREATE OR REPLACE FUNCTION private.transferencia_checklist_json(p_paciente uuid, p_episodio uuid, p_internacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_agg(
    CASE
      WHEN k.item = 'incubadora' AND NOT private.transferencia_neonato(p_paciente) THEN
        jsonb_build_object('item', k.item, 'quem', k.quem, 'situacao', 'nao_se_aplica', 'automatico', true,
                           'motivo', 'Não é recém-nascido (mais de 27 dias de vida).')
      WHEN c.id IS NULL THEN jsonb_build_object('item', k.item, 'quem', k.quem, 'situacao', NULL)
      ELSE jsonb_strip_nulls(jsonb_build_object('item', k.item, 'quem', k.quem, 'situacao', c.situacao, 'detalhe', c.detalhe,
                                                'motivo', c.motivo, 'em', c.registrado_em,
                                                'por', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = c.registrado_por)))
    END ORDER BY k.ordem)
  FROM (VALUES (1, 'contato_destino', 'medico'), (2, 'regulacao', 'medico'), (3, 'autorizacao', 'medico'), (4, 'estabilizado', 'medico'),
               (5, 'transporte', 'medico'), (6, 'acompanhante_equipe', 'enfermagem'), (7, 'isolamento_informado', 'enfermagem'),
               (8, 'incubadora', 'enfermagem')) k(ordem, item, quem)
  LEFT JOIN public.transferencia_checklist c
    ON c.item = k.item AND coalesce(c.internacao_id, c.episodio_id) = coalesce(p_internacao, p_episodio)
       AND (p_internacao IS NOT NULL OR c.internacao_id IS NULL)
$$;
REVOKE ALL ON FUNCTION private.transferencia_checklist_json(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- o documento para a tela (conteúdo em jsonb)
CREATE OR REPLACE FUNCTION private.transferencia_documento_json(d public.documentos_clinicos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', d.id, 'numero', d.numero, 'versao', d.versao, 'estado', d.estado, 'emitido_em', coalesce(d.emitido_em, d.created_at),
    'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = d.autor_id),
    'autor_registro', private.folha_registro(d.autor_id),
    'meu', d.autor_id = private.meu_perfil_id(),
    'episodio_id', d.episodio_id, 'internacao_id', d.internacao_id,
    'conteudo', d.conteudo::jsonb) END
$$;
REVOKE ALL ON FUNCTION private.transferencia_documento_json(public.documentos_clinicos) FROM PUBLIC, anon, authenticated;

-- ── T2/T3/T6: o painel da origem ────────────────────────────────────────────
-- Lê quem cuida do paciente (médico, enfermagem, gestor) e o NIR da unidade.
CREATE OR REPLACE FUNCTION public.dados_transferencia(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  v_atua boolean;
  c record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  SELECT * INTO c FROM private.transferencia_contexto(p_paciente);
  v_atua := private.transferencia_atuo(p_paciente, c.internacao_id);
  IF v_unidade IS NULL OR NOT (v_atua OR coalesce(private.sou_nir(v_unidade), false)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.origem IS NULL THEN
    RETURN jsonb_build_object('contexto', NULL);
  END IF;
  RETURN jsonb_build_object(
    'contexto', jsonb_build_object('origem', c.origem, 'episodio_id', c.episodio_id, 'internacao_id', c.internacao_id),
    'dados', private.transferencia_dados(p_paciente, c.episodio_id, c.internacao_id, c.origem, c.setor_id, c.leito_id, c.entrada_em),
    'documento', private.transferencia_documento_json(private.transferencia_documento_vigente(c.episodio_id, c.internacao_id)),
    'checklist', private.transferencia_checklist_json(p_paciente, c.episodio_id, c.internacao_id),
    'neonato', private.transferencia_neonato(p_paciente),
    'eu', jsonb_build_object('nome', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = private.meu_perfil_id()),
                             'registro', private.folha_registro(private.meu_perfil_id())),
    'pode', jsonb_build_object(
      'emitir', v_atua AND coalesce(private.tenho_papel(c.unidade_id, 'plantonista'), false),
      'enfermagem', v_atua AND coalesce(private.tenho_papel(c.unidade_id, 'enfermeiro'), false)));
END $$;
REVOKE ALL ON FUNCTION public.dados_transferencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dados_transferencia(uuid) TO authenticated;

-- ── T1/T3/T6: emitir (o médico em cuidado) ──────────────────────────────────
-- p_textos: resumo_clinico, condutas e motivo (o que o médico escreve). Já há
-- documento em vigor neste atendimento: só uma nova versão (p_retifica, com o
-- motivo), de qualquer médico em cuidado (quem transfere assina a sua).
CREATE OR REPLACE FUNCTION public.emitir_documento_transferencia(p_paciente uuid, p_textos jsonb,
                                                                 p_retifica uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  c record;
  v_org uuid;
  v_ant public.documentos_clinicos;
  r public.documentos_clinicos;
  v_resumo text := btrim(coalesce(p_textos ->> 'resumo_clinico', ''));
  v_condutas text := btrim(coalesce(p_textos ->> 'condutas', ''));
  v_motivo text := btrim(coalesce(p_textos ->> 'motivo', ''));
  v_conteudo text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO c FROM private.transferencia_contexto(p_paciente);
  IF c.origem IS NULL THEN
    RAISE EXCEPTION 'O paciente não está em atendimento, observação ou internação.';
  END IF;
  IF v_perfil IS NULL OR NOT private.transferencia_atuo(p_paciente, c.internacao_id) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Portaria 2.048/2002, 3.1 (d) e (f): a decisão e o documento são do médico
  IF private.tenho_papel(c.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O documento de transferência é emitido pelo médico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_resumo) < 15 THEN RAISE EXCEPTION 'Escreva o resumo clínico (mínimo de 15 letras).'; END IF;
  IF length(v_condutas) < 10 THEN RAISE EXCEPTION 'Escreva as condutas adotadas (mínimo de 10 letras).'; END IF;
  IF length(v_motivo) < 10 THEN RAISE EXCEPTION 'Escreva o motivo da transferência (mínimo de 10 letras).'; END IF;
  IF greatest(length(v_resumo), length(v_condutas), length(v_motivo)) > 4000 THEN
    RAISE EXCEPTION 'Cada texto cabe em 4000 letras.';
  END IF;

  v_ant := private.transferencia_documento_vigente(c.episodio_id, c.internacao_id);
  IF v_ant.id IS NOT NULL AND p_retifica IS NULL THEN
    RAISE EXCEPTION 'Já há documento de transferência emitido neste atendimento. Para mudar, emita uma nova versão com o motivo.';
  END IF;
  IF p_retifica IS NOT NULL THEN
    IF v_ant.id IS DISTINCT FROM p_retifica THEN
      RAISE EXCEPTION 'Só se corrige o documento de transferência em vigor deste atendimento.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo da nova versão (mínimo de 10 letras).'; END IF;
    PERFORM 1 FROM public.documentos_clinicos WHERE id = v_ant.id FOR UPDATE;
  END IF;

  v_conteudo := jsonb_build_object(
    'formato', 'transferencia',
    'fontes', jsonb_build_array(
      'Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1 (a, b, d, f, g, h, l) e 3.3 (e)',
      'Resolução CFM nº 1.672/2003, Art. 1º', 'Resolução CFM nº 2.079/2014', 'Resolução CFM nº 2.110/2014, Art. 18'),
    'aviso', 'O médico que transfere responde pelo paciente até ele ser recebido pelo médico da viatura ou do serviço que recebe (Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1 h).',
    'medico', jsonb_strip_nulls(jsonb_build_object('nome', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = v_perfil),
                                                   'registro', private.folha_registro(v_perfil))),
    'dados', private.transferencia_dados(p_paciente, c.episodio_id, c.internacao_id, c.origem, c.setor_id, c.leito_id, c.entrada_em),
    'textos', jsonb_build_object('resumo_clinico', v_resumo, 'condutas', v_condutas, 'motivo', v_motivo),
    'checklist_na_emissao', private.transferencia_checklist_json(p_paciente, c.episodio_id, c.internacao_id))::text;

  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = c.unidade_id;
  INSERT INTO public.documentos_clinicos
    (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, episodio_id, internacao_id, tipo_documento, conteudo,
     conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao, numero, emitido_em, sem_conexao)
  VALUES
    (coalesce(v_ant.documento_raiz_id, gen_random_uuid()), coalesce(v_ant.versao, 0) + 1, v_org, c.unidade_id, p_paciente,
     c.episodio_id, c.internacao_id, 'documento_transferencia', v_conteudo,
     encode(extensions.digest(convert_to(v_conteudo, 'UTF8'), 'sha256'), 'hex'), v_perfil, 'ativo',
     v_ant.id, CASE WHEN v_ant.id IS NOT NULL THEN btrim(p_motivo) END,
     private.gerar_numero_documento(c.unidade_id), now(), false)
  RETURNING * INTO r;
  IF v_ant.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = v_ant.id;
  END IF;
  -- só o tipo: nada do paciente na auditoria
  PERFORM private.registrar_auditoria(CASE WHEN v_ant.id IS NULL THEN 'emitir_documento' ELSE 'retificar_documento' END,
    'documentos_clinicos', r.id, r.unidade_id, jsonb_build_object('tipo', 'documento_transferencia'));
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'versao', r.versao);
END $$;
REVOKE ALL ON FUNCTION public.emitir_documento_transferencia(uuid, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_documento_transferencia(uuid, jsonb, uuid, text) TO authenticated;

-- ── T4/T6: marcar um item (médico os dele, enfermeiro os da enfermagem) ─────
CREATE OR REPLACE FUNCTION public.marcar_item_transferencia(p_paciente uuid, p_item text, p_situacao text,
                                                            p_detalhe text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c record;
  v_papel text;
  v_det text := nullif(btrim(coalesce(p_detalhe, '')), '');
  v_mot text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_medico boolean := p_item IN ('contato_destino', 'regulacao', 'autorizacao', 'estabilizado', 'transporte');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_item IS NULL OR p_item NOT IN ('contato_destino', 'regulacao', 'autorizacao', 'estabilizado', 'transporte',
                                      'isolamento_informado', 'incubadora', 'acompanhante_equipe') THEN
    RAISE EXCEPTION 'Item do checklist desconhecido.';
  END IF;
  IF p_situacao IS NULL OR p_situacao NOT IN ('feito', 'nao_se_aplica') THEN
    RAISE EXCEPTION 'Marque o item como feito ou como "não se aplica".';
  END IF;
  SELECT * INTO c FROM private.transferencia_contexto(p_paciente);
  IF c.origem IS NULL THEN
    RAISE EXCEPTION 'O paciente não está em atendimento, observação ou internação.';
  END IF;
  IF NOT private.transferencia_atuo(p_paciente, c.internacao_id) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_medico THEN
    IF private.tenho_papel(c.unidade_id, 'plantonista') IS NOT TRUE THEN
      RAISE EXCEPTION 'Este item é do médico que transfere.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_papel := 'plantonista';
  ELSE
    IF private.tenho_papel(c.unidade_id, 'enfermeiro') IS NOT TRUE THEN
      RAISE EXCEPTION 'Este item é do enfermeiro.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_papel := 'enfermeiro';
  END IF;
  -- Res. CFM 1.672/2003, Art. 1º, IX: a incubadora de transporte é do neonato
  IF p_item = 'incubadora' AND NOT private.transferencia_neonato(p_paciente) THEN
    RAISE EXCEPTION 'Incubadora: só no recém-nascido (até 27 dias de vida).';
  END IF;

  IF p_situacao = 'nao_se_aplica' THEN
    IF length(coalesce(v_mot, '')) < 10 THEN RAISE EXCEPTION 'Diga por que não se aplica (mínimo de 10 letras).'; END IF;
    v_det := NULL;
  ELSE
    v_mot := NULL;
    IF p_item = 'contato_destino' AND length(coalesce(v_det, '')) < 3 THEN
      RAISE EXCEPTION 'Contato com o destino: diga o nome de quem aceitou o paciente.';
    ELSIF p_item = 'regulacao' AND v_det IS NULL THEN
      RAISE EXCEPTION 'Regulação: informe o número ou o protocolo.';
    ELSIF p_item = 'autorizacao' AND coalesce(v_det, '') NOT IN ('paciente', 'responsavel') THEN
      RAISE EXCEPTION 'Autorização: diga quem assinou, o paciente ou o responsável.';
    ELSIF p_item = 'transporte' AND coalesce(v_det, '') NOT IN ('transporte_sanitario', 'ambulancia_basica', 'ambulancia_avancada',
                                                                 'aereo', 'embarcacao', 'meios_proprios') THEN
      RAISE EXCEPTION 'Transporte: escolha o tipo.';
    ELSIF p_item = 'acompanhante_equipe' AND coalesce(v_det, '') NOT IN ('medico', 'enfermagem', 'medico_e_enfermagem') THEN
      RAISE EXCEPTION 'Acompanhante: diga quem da equipe vai junto (médico, enfermagem ou os dois).';
    ELSIF p_item IN ('estabilizado', 'isolamento_informado', 'incubadora') THEN
      v_det := NULL;
    END IF;
  END IF;
  IF length(v_det) > 120 THEN RAISE EXCEPTION 'O detalhe cabe em 120 letras.'; END IF;
  IF length(v_mot) > 500 THEN RAISE EXCEPTION 'O motivo cabe em 500 letras.'; END IF;

  INSERT INTO public.transferencia_checklist (unidade_id, paciente_id, episodio_id, internacao_id, item, situacao, detalhe, motivo,
                                              registrado_por, papel)
  VALUES (c.unidade_id, p_paciente, c.episodio_id, c.internacao_id, p_item, p_situacao, v_det, v_mot, private.meu_perfil_id(), v_papel)
  ON CONFLICT ((coalesce(internacao_id, episodio_id)), item) DO UPDATE
    SET situacao = excluded.situacao, detalhe = excluded.detalhe, motivo = excluded.motivo,
        registrado_por = excluded.registrado_por, papel = excluded.papel, registrado_em = now();
  -- só códigos: o nome de quem aceitou e o motivo ficam na tabela protegida
  PERFORM private.registrar_auditoria('transferencia_checklist', 'transferencia_checklist', NULL, c.unidade_id,
    jsonb_build_object('tipo', p_item, 'situacao', p_situacao, 'papel', v_papel));
  RETURN private.transferencia_checklist_json(p_paciente, c.episodio_id, c.internacao_id);
END $$;
REVOKE ALL ON FUNCTION public.marcar_item_transferencia(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_item_transferencia(uuid, text, text, text, text) TO authenticated;

-- ── T9: a Regulação, o NIR e o destino na rede ──────────────────────────────
-- Quem vê o pedido vê o documento (private.regulacao_pode_ver: origem, central,
-- e o destino da rede depois do envio); também a enfermagem de plantão no
-- destino, enquanto o paciente chega, e quem cuida dele no destino depois da
-- chegada. Leitura registrada na auditoria (só o tipo).
CREATE OR REPLACE FUNCTION public.transferencia_da_regulacao(p_solicitacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF s.id IS NULL OR NOT (
       coalesce(private.regulacao_pode_ver(s), false)
       OR (s.destino_unidade_id IS NOT NULL AND s.status IN ('autorizada', 'agendada', 'em_transito', 'realizada')
           AND coalesce(private.sou_enfermagem(s.destino_unidade_id), false) AND coalesce(private.na_escala_agora(s.destino_unidade_id), false))
       OR (s.destino_paciente_id IS NOT NULL AND coalesce(private.pode_atuar_no_paciente(s.destino_paciente_id), false))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT x.* INTO d FROM public.documentos_clinicos x
   WHERE x.paciente_id = s.paciente_id AND x.tipo_documento = 'documento_transferencia' AND x.estado IN ('ativo', 'assinado')
     AND ((s.internacao_id IS NOT NULL AND x.internacao_id = s.internacao_id) OR (s.episodio_id IS NOT NULL AND x.episodio_id = s.episodio_id))
   ORDER BY x.created_at DESC LIMIT 1;
  IF d.id IS NULL THEN RETURN jsonb_build_object('documento', NULL); END IF;
  PERFORM private.registrar_auditoria('ler_documento_transferencia', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', 'documento_transferencia'));
  RETURN jsonb_build_object(
    'documento', private.transferencia_documento_json(d) - 'meu',
    'checklist', private.transferencia_checklist_json(d.paciente_id, d.episodio_id, d.internacao_id));
END $$;
REVOKE ALL ON FUNCTION public.transferencia_da_regulacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferencia_da_regulacao(uuid) TO authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
CREATE OR REPLACE FUNCTION pg_temp.trocar_transferencia(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
    v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- registrar_desfecho (porta): T5
SELECT pg_temp.trocar_transferencia('public.registrar_desfecho(uuid, text, text, jsonb)'::regprocedure, ARRAY[
  $a$  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
$a$,
  $b$  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  -- lacuna 7 (T5): sem documento de transferência emitido, não transfere
  -- (Portaria GM/MS 2.048/2002, Anexo, Cap. VI, item 3.1 f)
  IF p_desfecho = 'transferencia' AND NOT private.transferencia_documento_emitido(e.id, NULL) THEN
    RAISE EXCEPTION 'Emita o documento de transferência antes de transferir (Portaria GM/MS 2.048/2002, Anexo, Cap. VI, item 3.1 f).';
  END IF;
$b$]);

-- dar_alta (internação e, pela finalizar_observacao, observação): T5
SELECT pg_temp.trocar_transferencia('public.dar_alta(uuid, text, text, timestamptz, text, text, jsonb)'::regprocedure, ARRAY[
  $a$  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
$a$,
  $b$  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  -- lacuna 7 (T5): sem documento de transferência emitido, não transfere
  -- (Portaria GM/MS 2.048/2002, Anexo, Cap. VI, item 3.1 f)
  IF p_tipo = 'transferencia_externa' AND NOT private.transferencia_documento_emitido(i.episodio_id, i.id) THEN
    RAISE EXCEPTION 'Emita o documento de transferência antes de transferir (Portaria GM/MS 2.048/2002, Anexo, Cap. VI, item 3.1 f).';
  END IF;
$b$]);

-- cancelar_documento: o autor cancela o documento de transferência com o motivo
SELECT pg_temp.trocar_transferencia('public.cancelar_documento(uuid, text)'::regprocedure, ARRAY[
  $a$                              'admissao_anamnese') THEN$a$,
  $b$                              'admissao_anamnese', 'documento_transferencia') THEN$b$]);

-- folha_documento: o checklist do momento da impressão (T4, T8)
SELECT pg_temp.trocar_transferencia('public.folha_documento(uuid, text)'::regprocedure, ARRAY[
  $a$  -- cancelamento do documento emitido (porte, 20261005000003), quando existe
$a$,
  $b$  -- lacuna 7 (T4, T8): o checklist da transferência como está na impressão
  IF d.tipo_documento = 'documento_transferencia' THEN
    v_ficha := jsonb_build_object('checklist_atual', private.transferencia_checklist_json(d.paciente_id, d.episodio_id, d.internacao_id));
  END IF;
  -- cancelamento do documento emitido (porte, 20261005000003), quando existe
$b$]);

DROP FUNCTION pg_temp.trocar_transferencia(regprocedure, text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_transferencia(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN EXECUTE def; END IF;
-- END $$;
-- -- as quatro chamadas pg_temp.trocar_transferencia acima, iguais, com o nome
-- -- pg_temp.desfazer_transferencia (os mesmos pares: ele troca o novo pelo antigo)
-- DROP FUNCTION IF EXISTS public.transferencia_da_regulacao(uuid), public.marcar_item_transferencia(uuid, text, text, text, text),
--   public.emitir_documento_transferencia(uuid, jsonb, uuid, text), public.dados_transferencia(uuid),
--   private.transferencia_documento_json(public.documentos_clinicos), private.transferencia_checklist_json(uuid, uuid, uuid),
--   private.transferencia_documento_emitido(uuid, uuid), private.transferencia_documento_vigente(uuid, uuid),
--   private.transferencia_dados(uuid, uuid, uuid, text, uuid, uuid, timestamptz), private.transferencia_regulacao(uuid, uuid, uuid),
--   private.transferencia_neonato(uuid), private.transferencia_atuo(uuid, uuid), private.transferencia_contexto(uuid);
-- -- tabela, índices e a CHECK maior de documentos_clinicos: ficam (dado clínico)
-- -- até uma janela declarada (contract), enquanto houver documento de transferência.
-- ════════════════════════════════════════════════════════════════════════════
