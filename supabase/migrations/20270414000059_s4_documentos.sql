-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S4: documentos e reenvio offline.
-- Decisões do RT D1–D5 = A, 15/11/2026 (docs/seguranca/S4-DOCUMENTOS-DIAGNOSTICO.md).
-- (D1, a impressão, fica no frontend e na folha da edge function.)
--
-- D2. Termo de consentimento, sumário de óbito, parecer e teleinterconsulta
--     saem só pelo fluxo próprio: emitir_documento, salvar_rascunho,
--     emitir_rascunho e a sincronização offline recusam esses tipos.
-- D3. faltas_documento em todos os caminhos e tipos: emitir_documento (antes,
--     só laudo de AIH) e sincronização offline (antes, nunca).
-- D4. O "sem conexão" declarado pelo aparelho é conferido com o histórico de
--     renovação da sessão (auth.refresh_tokens): se a sessão foi renovada entre
--     o "último contato" declarado (+5 min) e a hora do registro, a pessoa
--     estava conectada e o registro vai para a revisão do gestor. E o momento
--     do registro passa a exigir vínculo ativo com a unidade do paciente.
--
-- Expand puro: só redefine funções (mesmas assinaturas). Reaplicável.
-- Rollback: as definições anteriores, em 20261102000002 (emitir_documento),
-- 20261022000013 (emitir_rascunho), 20260929000001 (salvar_rascunho, com
-- 'termo_consentimento' na lista), 20260927000009 (sincronizar_documento,
-- sincronizar_registros) e 20261119000001 (podia_atuar_no_paciente_em).
-- ════════════════════════════════════════════════════════════════════════════

-- Tipos com fluxo próprio (tela e regras próprias): não saem pelos caminhos genéricos.
CREATE OR REPLACE FUNCTION private.tipo_documento_fluxo_proprio(p_tipo text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_tipo IN ('termo_consentimento', 'sumario_obito', 'parecer', 'teleinterconsulta');
$$;
REVOKE ALL ON FUNCTION private.tipo_documento_fluxo_proprio(text) FROM PUBLIC, anon, authenticated;

-- ── D2/D3. emitir_documento ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emitir_documento(p_paciente uuid, p_tipo text, p_conteudo text, p_episodio uuid DEFAULT NULL::uuid, p_retifica uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.documentos_clinicos; v_perfil uuid := private.meu_perfil_id(); v_faltas text[];
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  -- S4 (D2): tipo com fluxo próprio sai pela tela dele
  IF private.tipo_documento_fluxo_proprio(p_tipo) THEN
    RAISE EXCEPTION 'Este documento tem tela própria: emita por ela.';
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
    -- S4 (D3): as mesmas faltas do caminho do rascunho, para todo tipo. Confere
    -- depois da gravação, para os erros de permissão e de estado (retificação)
    -- virem antes; o erro aqui desfaz a gravação inteira.
    v_faltas := private.faltas_documento(p_tipo, p_conteudo, p_paciente, v_perfil);
    IF cardinality(v_faltas) > 0 THEN
      RAISE EXCEPTION 'Falta para emitir: %.', array_to_string(v_faltas, '; ');
    END IF;
    PERFORM private.registrar_auditoria(CASE WHEN p_retifica IS NULL THEN 'emitir_documento' ELSE 'retificar_documento' END,
      'documentos_clinicos', r.id, r.unidade_id, jsonb_build_object('tipo', p_tipo));
  END IF;
  RETURN jsonb_build_object('id', r.id, 'numero', r.numero, 'episodio_id', r.episodio_id, 'versao', r.versao);
END $function$;

-- ── D2. salvar_rascunho: o termo sai da lista (resto igual) ──────────────────
DO $$
DECLARE v_def text; v_novo text;
BEGIN
  v_def := pg_get_functiondef('public.salvar_rascunho(uuid, text, text, uuid)'::regprocedure);
  IF v_def LIKE '%''termo_consentimento''%' THEN
    v_novo := replace(v_def, '''sumario_alta'', ''termo_consentimento'', ''boletim_emergencia''', '''sumario_alta'', ''boletim_emergencia''');
    IF v_novo = v_def THEN RAISE EXCEPTION 'S4: lista de tipos de salvar_rascunho não encontrada.'; END IF;
    EXECUTE v_novo;
  END IF;
END $$;

-- ── D2. emitir_rascunho: rascunho antigo de tipo com fluxo próprio não sai ───
CREATE OR REPLACE FUNCTION public.emitir_rascunho(p_rascunho uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.documentos_clinicos; v_perfil uuid := private.meu_perfil_id(); v_faltas text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_rascunho FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado.'; END IF;
  IF d.estado = 'ativo' AND d.autor_id = v_perfil THEN   -- duplo clique: já emitido
    RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'episodio_id', d.episodio_id, 'versao', d.versao);
  END IF;
  IF d.estado <> 'rascunho' THEN RAISE EXCEPTION 'Este rascunho não está mais aberto.'; END IF;
  IF d.autor_id <> v_perfil THEN RAISE EXCEPTION 'Só o autor emite o próprio rascunho.'; END IF;
  IF private.pode_atuar_no_paciente(d.paciente_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  -- S4 (D2)
  IF private.tipo_documento_fluxo_proprio(d.tipo_documento) THEN
    RAISE EXCEPTION 'Este documento tem tela própria: emita por ela.';
  END IF;
  v_faltas := private.faltas_documento(d.tipo_documento, d.conteudo, d.paciente_id, d.autor_id);
  IF cardinality(v_faltas) > 0 THEN
    RAISE EXCEPTION 'Falta para emitir: %.', array_to_string(v_faltas, '; ');
  END IF;
  UPDATE public.documentos_clinicos
     SET estado = 'ativo', numero = private.gerar_numero_documento(d.unidade_id), emitido_em = now(), updated_at = now()
   WHERE id = d.id
  RETURNING * INTO d;
  PERFORM private.registrar_auditoria('emitir_documento', 'documentos_clinicos', d.id, d.unidade_id,
    jsonb_build_object('tipo', d.tipo_documento, 'de_rascunho', true));
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'episodio_id', d.episodio_id, 'versao', d.versao);
END $function$;

-- ── D2/D3. sincronizar_documento ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sincronizar_documento(p_id uuid, p_hora timestamp with time zone, p_sem_conexao boolean, p_aparelho text, d jsonb, p_revisao boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_paciente uuid := (d ->> 'paciente_id')::uuid;
  v_dono uuid;
  v_faltas text[];
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
  -- S4 (D2): tipo com fluxo próprio não sai pela fila do aparelho
  IF private.tipo_documento_fluxo_proprio(d ->> 'tipo') THEN
    RAISE EXCEPTION 'SYNC_TIPO_PROPRIO: este documento tem tela própria; emita por ela com conexão.';
  END IF;
  -- S4 (D3): as mesmas faltas da emissão com conexão
  v_faltas := private.faltas_documento(d ->> 'tipo', d ->> 'conteudo', v_paciente, v_perfil);
  IF cardinality(v_faltas) > 0 THEN
    RAISE EXCEPTION 'SYNC_FALTAS: falta para emitir: %.', array_to_string(v_faltas, '; ');
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
END $function$;

-- ── D4. Momento do registro com vínculo ativo ────────────────────────────────
CREATE OR REPLACE FUNCTION private.podia_atuar_no_paciente_em(p_paciente uuid, p_momento timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND (   private.eh_super_admin()
           OR (-- S4 (D4): só quem tem vínculo ativo com a unidade do paciente
               coalesce(private.papel_na_unidade(pa.unidade_id), '') <> ''
               AND (   private.papel_na_unidade(pa.unidade_id) = 'gestor'
                    OR pa.setor_id IN (SELECT private.setores_em_plantao_em(p_momento))
                    OR EXISTS (SELECT 1 FROM public.internacoes i
                               WHERE i.paciente_id = pa.id
                                 AND i.data_admissao <= p_momento
                                 AND (i.data_alta IS NULL OR i.data_alta > p_momento)
                                 AND i.setor_atual_id IN (SELECT private.setores_em_plantao_em(p_momento))))))
  );
$function$;

-- ── D4. Prova do "sem conexão" ───────────────────────────────────────────────
-- A sessão renova o token a cada ~15 min enquanto há conexão; cada renovação
-- deixa uma linha em auth.refresh_tokens. Renovação entre o último contato
-- declarado (+5 min) e a hora do registro desmente o "sem conexão".
CREATE OR REPLACE FUNCTION private.estava_conectado_entre(p_de timestamptz, p_ate timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.refresh_tokens rt
     WHERE rt.user_id = auth.uid()::text
       AND rt.created_at > p_de + interval '5 minutes'
       AND rt.created_at < p_ate);
$$;
REVOKE ALL ON FUNCTION private.estava_conectado_entre(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sincronizar_registros(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  item jsonb;
  v_id uuid;
  v_hora timestamptz;
  v_contato timestamptz;
  v_sem boolean;
  v_revisao boolean;
  v_status text;
  saida jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) > 200 THEN
    RAISE EXCEPTION 'Envie de 1 a 200 registros por vez.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULL;
    BEGIN
      v_id := (item ->> 'id')::uuid;
      v_hora := (item ->> 'hora')::timestamptz;
      v_sem := coalesce((item ->> 'sem_conexao')::boolean, false);
      v_contato := (item ->> 'ultimo_contato')::timestamptz;
      IF v_id IS NULL OR v_hora IS NULL THEN
        RAISE EXCEPTION 'SYNC_INVALIDO: id e hora são obrigatórios.';
      END IF;
      IF v_hora > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'SYNC_HORA_FUTURA: hora do registro no futuro.';
      END IF;
      IF v_sem THEN
        IF v_contato IS NULL OR v_contato > now() OR v_contato > v_hora + interval '1 minute' THEN
          RAISE EXCEPTION 'SYNC_CONTATO: último contato com o servidor ausente ou inconsistente.';
        END IF;
        IF v_hora - v_contato > private.limite_sem_conexao() THEN
          RAISE EXCEPTION 'SYNC_LIMITE: registro feito depois de 2 h sem conexão.';
        END IF;
      ELSIF v_hora < now() - interval '5 minutes' THEN
        RAISE EXCEPTION 'SYNC_HORA: registro com conexão precisa ter a hora atual.';
      END IF;

      -- revisão do gestor: chegou tarde, ou (S4, D4) a sessão foi renovada no
      -- período que o aparelho declarou estar sem conexão
      v_revisao := v_sem AND (now() - v_hora > private.limite_chegada_direta()
                              OR private.estava_conectado_entre(v_contato, v_hora));

      CASE item ->> 'tipo'
        WHEN 'observacao' THEN
          v_status := private.sincronizar_observacao(v_id, v_hora, v_sem, item ->> 'aparelho_id', item -> 'dados', v_revisao);
        WHEN 'documento' THEN
          v_status := private.sincronizar_documento(v_id, v_hora, v_sem, item ->> 'aparelho_id', item -> 'dados', v_revisao);
        ELSE
          RAISE EXCEPTION 'SYNC_TIPO: tipo de registro não aceito (%).', item ->> 'tipo';
      END CASE;
      saida := saida || jsonb_build_object('id', v_id, 'status', v_status);
    EXCEPTION WHEN others THEN
      saida := saida || jsonb_build_object('id', coalesce(v_id::text, item ->> 'id'), 'status', 'recusado', 'motivo', SQLERRM);
    END;
  END LOOP;
  RETURN saida;
END $function$;
