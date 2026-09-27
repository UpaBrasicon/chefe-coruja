-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2.5 — documentos pertencem ao EPISÓDIO; folha provisória sem conexão.
--
-- Dívida herdada (esquema-atual.md): a "versão atual" de um documento era
-- buscada por paciente + tipo, atravessando todas as vindas — o atestado de
-- hoje virava retificação do atestado do ano passado.
--
-- • emitir_documento(): cada emissão é um documento NOVO, do episódio, com
--   número da unidade (AAAA/000001). Retificar é explícito: aponta o
--   documento, exige motivo, e só vale no mesmo episódio e tipo.
-- • Receita, atestado, encaminhamento e pedido de exames da porta passam a
--   ser gravados antes de imprimir (antes só iam para o papel).
-- • salvar_documento() (evolução da internação) mantém versões, mas só dentro
--   da mesma internação.
-- • Sem conexão: a folha sai PROVISÓRIA (sem número, assinar à mão) e o
--   documento entra na fila; ao sincronizar recebe número, fica marcado
--   "sem conexão" com a hora do fato, e a impressão provisória é registrada.
--   Chegando mais de 24 h depois, vai para a revisão do gestor (fase 1).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.documentos_clinicos
  ADD COLUMN IF NOT EXISTS episodio_id uuid REFERENCES public.episodios(id),
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS emitido_em timestamptz,
  ADD COLUMN IF NOT EXISTS sem_conexao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aparelho_id text;
CREATE UNIQUE INDEX IF NOT EXISTS documentos_unidade_numero ON public.documentos_clinicos (unidade_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS documentos_episodio ON public.documentos_clinicos (episodio_id, created_at) WHERE episodio_id IS NOT NULL;

ALTER TABLE public.documentos_clinicos DROP CONSTRAINT IF EXISTS documentos_clinicos_tipo_documento_check;
ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento IN (
  'admissao_anamnese', 'evolucao', 'prescricao', 'sumario_alta', 'sumario_obito', 'atestado', 'termo_consentimento',
  'boletim_emergencia', 'partograma', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih'));

-- ── número do documento, por unidade e ano ──────────────────────────────────
CREATE TABLE IF NOT EXISTS private.documento_sequencia (
  unidade_id uuid NOT NULL,
  ano integer NOT NULL,
  ultimo integer NOT NULL,
  PRIMARY KEY (unidade_id, ano)
);
CREATE OR REPLACE FUNCTION private.gerar_numero_documento(p_unidade uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ano integer := extract(year FROM private.data_atual())::integer; v_n integer;
BEGIN
  INSERT INTO private.documento_sequencia (unidade_id, ano, ultimo) VALUES (p_unidade, v_ano, 1)
  ON CONFLICT (unidade_id, ano) DO UPDATE SET ultimo = private.documento_sequencia.ultimo + 1
  RETURNING ultimo INTO v_n;
  RETURN v_ano || '/' || lpad(v_n::text, 6, '0');
END $$;
REVOKE ALL ON FUNCTION private.gerar_numero_documento(uuid) FROM PUBLIC, anon, authenticated;

-- ── núcleo: grava um documento de episódio ──────────────────────────────────
-- Chamado por emitir_documento (com conexão) e pela sincronização (sem).
CREATE OR REPLACE FUNCTION private.gravar_documento_episodio(
  p_id uuid, p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid, p_retifica uuid, p_motivo text,
  p_autor uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text)
RETURNS public.documentos_clinicos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_org uuid; v_epi uuid := p_episodio;
  v_ant public.documentos_clinicos; r public.documentos_clinicos;
BEGIN
  IF p_tipo NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'boletim_emergencia', 'sumario_alta',
                    'sumario_obito', 'termo_consentimento', 'laudo_aih', 'evolucao', 'admissao_anamnese', 'prescricao') THEN
    RAISE EXCEPTION 'Tipo de documento desconhecido.';
  END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) = 0 THEN RAISE EXCEPTION 'Documento vazio.'; END IF;
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  -- episódio: o informado (do paciente) ou o aberto; senão o que encerrou há
  -- menos de 12 h (atestado de alta); sem nenhum, fica sem episódio (legado).
  IF v_epi IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = v_epi AND paciente_id = p_paciente) THEN
      RAISE EXCEPTION 'Episódio não é deste paciente.';
    END IF;
  ELSE
    SELECT id INTO v_epi FROM public.episodios
     WHERE paciente_id = p_paciente AND (etapa <> 'encerrado' OR encerrado_em > p_hora - interval '12 hours')
     ORDER BY (etapa <> 'encerrado') DESC, chegada_em DESC LIMIT 1;
  END IF;

  IF p_retifica IS NOT NULL THEN
    SELECT * INTO v_ant FROM public.documentos_clinicos WHERE id = p_retifica FOR UPDATE;
    IF NOT FOUND OR v_ant.paciente_id <> p_paciente OR v_ant.tipo_documento <> p_tipo OR v_ant.estado <> 'ativo'
       OR v_ant.episodio_id IS DISTINCT FROM v_epi THEN
      RAISE EXCEPTION 'Só se retifica documento ativo do mesmo episódio e tipo.';
    END IF;
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo da retificação (mínimo de 10 letras).'; END IF;
  END IF;

  INSERT INTO public.documentos_clinicos
    (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, episodio_id, tipo_documento, conteudo,
     conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao, numero, emitido_em, sem_conexao, aparelho_id)
  VALUES
    (coalesce(p_id, gen_random_uuid()), coalesce(v_ant.documento_raiz_id, gen_random_uuid()), coalesce(v_ant.versao, 0) + 1,
     v_org, v_unidade, p_paciente, v_epi, p_tipo, p_conteudo,
     encode(extensions.digest(convert_to(p_conteudo, 'UTF8'), 'sha256'), 'hex'), p_autor, 'ativo',
     v_ant.id, CASE WHEN v_ant.id IS NOT NULL THEN btrim(p_motivo) END,
     private.gerar_numero_documento(v_unidade), p_hora, p_sem_conexao, left(p_aparelho, 64))
  RETURNING * INTO r;
  IF v_ant.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = v_ant.id;
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.gravar_documento_episodio(uuid, uuid, text, text, uuid, uuid, text, uuid, timestamptz, boolean, text)
  FROM PUBLIC, anon, authenticated;

-- ── emitir (com conexão) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emitir_documento(
  p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid DEFAULT NULL,
  p_retifica uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.documentos_clinicos; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
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

-- ── salvar_documento (evolução da internação): versões só na mesma internação
DO $$
DECLARE def text := pg_get_functiondef('public.salvar_documento(uuid,uuid,text,text,uuid,text)'::regprocedure);
BEGIN
  IF def NOT LIKE '%internacao_id IS NOT DISTINCT FROM p_internacao%' THEN
    IF position('WHERE paciente_id = p_paciente AND tipo_documento = p_tipo' IN def) = 0 THEN
      RAISE EXCEPTION 'salvar_documento: trecho esperado não encontrado';
    END IF;
    def := replace(def, 'WHERE paciente_id = p_paciente AND tipo_documento = p_tipo',
                        'WHERE paciente_id = p_paciente AND tipo_documento = p_tipo AND internacao_id IS NOT DISTINCT FROM p_internacao');
    EXECUTE def;
  END IF;
END $$;

-- ── sincronização: tipo 'documento' ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sincronizar_documento(
  p_id uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text, d jsonb, p_revisao boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_paciente uuid := (d ->> 'paciente_id')::uuid;
  v_dono uuid;
  r public.documentos_clinicos;
BEGIN
  SELECT autor_id INTO v_dono FROM public.documentos_clinicos WHERE id = p_id;
  IF NOT FOUND THEN SELECT autor_id INTO v_dono FROM public.sincronizacao_revisao WHERE id = p_id; END IF;
  IF FOUND THEN
    IF v_dono IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'SYNC_ID_EM_USO: identificador já usado por outro registro.'; END IF;
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE id = p_id) THEN 'ja_recebido' ELSE 'em_revisao' END;
  END IF;
  IF private.podia_atuar_no_paciente_em(v_paciente, p_hora) IS NOT TRUE THEN
    RAISE EXCEPTION 'SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente.';
  END IF;

  IF p_revisao THEN
    INSERT INTO public.sincronizacao_revisao (id, unidade_id, paciente_id, autor_id, tipo, hora_fato, aparelho_id, dados)
    SELECT p_id, p.unidade_id, p.id, v_perfil, 'documento', p_hora, left(p_aparelho, 64), d FROM public.pacientes p WHERE p.id = v_paciente;
    RETURN 'em_revisao';
  END IF;

  r := private.gravar_documento_episodio(p_id, v_paciente, d ->> 'tipo', d ->> 'conteudo',
         nullif(d ->> 'episodio_id', '')::uuid, NULL, NULL, v_perfil, p_hora, p_sem_conexao, p_aparelho);
  -- a folha provisória JÁ foi impressa no papel: registra a impressão agora
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, documento_id, documento_tipo)
  VALUES (r.organizacao_id, r.unidade_id, r.paciente_id, v_perfil, nullif(private.papel_na_unidade(r.unidade_id), ''),
          'impressao', r.id, 'Folha provisória (sem conexão)');
  RETURN 'gravado';
END $$;
REVOKE ALL ON FUNCTION private.sincronizar_documento(uuid, timestamptz, boolean, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- a porta de sincronização passa a aceitar 'documento'
DO $$
DECLARE def text := pg_get_functiondef('public.sincronizar_registros(jsonb)'::regprocedure);
BEGIN
  IF def NOT LIKE '%sincronizar_documento%' THEN
    IF position('        ELSE
          RAISE EXCEPTION ''SYNC_TIPO' IN def) = 0 THEN
      RAISE EXCEPTION 'sincronizar_registros: trecho esperado não encontrado';
    END IF;
    def := replace(def, '        ELSE
          RAISE EXCEPTION ''SYNC_TIPO', '        WHEN ''documento'' THEN
          v_status := private.sincronizar_documento(v_id, v_hora, v_sem, item ->> ''aparelho_id'', item -> ''dados'',
                                                    v_sem AND now() - v_hora > private.limite_chegada_direta());
        ELSE
          RAISE EXCEPTION ''SYNC_TIPO');
    EXECUTE def;
  END IF;
END $$;

-- a revisão do gestor sabe aceitar documento
DO $$
DECLARE def text := pg_get_functiondef('public.decidir_revisao_sincronizacao(uuid,boolean,text)'::regprocedure);
BEGIN
  IF def NOT LIKE '%gravar_documento_episodio%' THEN
    IF position('    PERFORM private.inserir_observacao_sincronizada(r.id, r.unidade_id, r.autor_id, r.hora_fato, true, r.aparelho_id, r.dados);' IN def) = 0 THEN
      RAISE EXCEPTION 'decidir_revisao_sincronizacao: trecho esperado não encontrado';
    END IF;
    def := replace(def,
      '    PERFORM private.inserir_observacao_sincronizada(r.id, r.unidade_id, r.autor_id, r.hora_fato, true, r.aparelho_id, r.dados);',
      '    IF r.tipo = ''documento'' THEN
      PERFORM private.gravar_documento_episodio(r.id, r.paciente_id, r.dados ->> ''tipo'', r.dados ->> ''conteudo'',
        nullif(r.dados ->> ''episodio_id'', '''')::uuid, NULL, NULL, r.autor_id, r.hora_fato, true, r.aparelho_id);
    ELSE
      PERFORM private.inserir_observacao_sincronizada(r.id, r.unidade_id, r.autor_id, r.hora_fato, true, r.aparelho_id, r.dados);
    END IF;');
    EXECUTE def;
  END IF;
END $$;
