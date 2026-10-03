-- Emissão de rascunho confere os campos obrigatórios no servidor (auditoria
-- do frontend 03/10/2026, risco R5).
--
-- A emissão em lote das Pendências do PEP emitia qualquer rascunho, como
-- estava, e emitir_rascunho não conferia nada. As regras abaixo ESPELHAM as
-- pendências que cada tela já cobra antes de emitir (nada inventado):
--   atestado       AtestadoMedico.tsx (pendencias) e porta/AbaAtestadoReceita
--   receita        ReceituarioMedico.tsx (pendencias) e porta (receita sem itens)
--   encaminhamento Encaminhamento.tsx (pendencias)
--   pedido_exames  PedidoExames.tsx (pendencias) e internacao/ExamesTab (texto)
--   laudo_aih      documentosInternacao.ts pendenciasAih + identificacao.ts
--                  cadastroFaltaAih
--   prescricao     PrescricaoEstruturada (não imprime sem item)
-- Regra que a tela confere com dado que não vai no conteúdo fica fora (CID do
-- atestado "a pedido", ciência dos avisos do SIGTAP). Campo que só existe no
-- formulário avulso (horário do atestado, controle especial da receita, bloco
-- `pedido` do pedido de exames) só é cobrado quando o conteúdo é desse
-- formulário: o atestado e a receita da porta e o pedido da internação
-- seguem com as próprias pendências. sumario_alta, termo_consentimento e
-- boletim_emergencia não têm pendência de tela: nada a conferir aqui.
--
-- 1. private.faltas_documento(tipo, conteudo, paciente, autor) → text[]
-- 2. public.faltas_rascunho(rascunho) → jsonb (só o autor), para a tela listar
-- 3. emitir_rascunho recusa com "Falta para emitir: …" quando há falta
-- 4. pendencias_pep devolve `faltas` em cada rascunho
--
-- SECURITY DEFINER com search_path vazio; segundo fator nas públicas; REVOKE
-- de PUBLIC e anon. Reaplicável.

-- ── 1. o que falta, por tipo ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.faltas_documento(p_tipo text, p_conteudo text, p_paciente uuid, p_autor uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  j jsonb;
  b jsonb;
  it jsonb;
  pa public.pacientes;
  f text[] := '{}';
  v_tipo text;
  v_ini date;
  v_med text;
  v_trava text;
  v_controle boolean := false;
  v_cid text;
  v_cad text[] := '{}';
BEGIN
  IF p_tipo NOT IN ('atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'prescricao') THEN
    RETURN f;
  END IF;
  BEGIN
    j := p_conteudo::jsonb;
  EXCEPTION WHEN OTHERS THEN
    j := NULL;
  END;
  IF j IS NULL OR jsonb_typeof(j) <> 'object' THEN
    RETURN ARRAY['Conteúdo do documento ilegível: abra e preencha pelo formulário'];
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;

  IF p_tipo = 'atestado' THEN
    b := CASE WHEN jsonb_typeof(j -> 'atestado') = 'object' THEN j -> 'atestado' ELSE '{}'::jsonb END;
    v_tipo := coalesce(b ->> 'tipo', '');
    IF NOT (v_tipo IN ('afastamento', 'comparecimento', 'acompanhante')) THEN f := array_append(f, 'Tipo de atestado'); END IF;
    IF btrim(coalesce(pa.cpf, '')) <> '' AND NOT private.cpf_valido(pa.cpf) THEN
      f := array_append(f, 'CPF do paciente inválido (corrigir no cadastro)');
    END IF;
    IF v_tipo = 'afastamento' AND NOT (coalesce(b ->> 'dias', '') ~ '^\s*\d+(\.\d+)?\s*$' AND (b ->> 'dias')::numeric > 0) THEN
      f := array_append(f, 'Dias de afastamento');
    END IF;
    IF btrim(coalesce(b ->> 'inicio', '')) <> '' THEN
      BEGIN
        IF b ->> 'inicio' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'data'; END IF;
        v_ini := (b ->> 'inicio')::date;
      EXCEPTION WHEN OTHERS THEN
        v_ini := NULL;
        f := array_append(f, 'Data de início inválida');
      END;
      IF v_ini IS NOT NULL AND v_ini < private.data_atual() THEN
        f := array_append(f, 'Data de início anterior ao atendimento (atestado retroativo)');
      END IF;
    END IF;
    -- horário: só no formulário avulso (a porta não pergunta horário)
    IF v_tipo IN ('comparecimento', 'acompanhante') AND b ? 'hentrada' THEN
      IF btrim(coalesce(b ->> 'hentrada', '')) = '' OR btrim(coalesce(b ->> 'hsaida', '')) = '' THEN
        f := array_append(f, 'Horário de entrada e saída');
      ELSIF (b ->> 'hsaida') <= (b ->> 'hentrada') THEN
        f := array_append(f, 'Hora de saída igual ou anterior à de entrada');
      END IF;
    END IF;
    IF v_tipo = 'acompanhante' AND btrim(coalesce(b ->> 'acompanhante', '')) = '' THEN
      f := array_append(f, 'Nome do acompanhante');
    END IF;

  ELSIF p_tipo = 'receita' THEN
    b := CASE WHEN jsonb_typeof(j -> 'receita') = 'object' THEN j -> 'receita' ELSE '{}'::jsonb END;
    -- alergia (tem ou nega): o formulário avulso cobra; a porta não
    IF b ? 'controle_especial'
       AND NOT EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL)
       AND NOT EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = p_paciente AND encerrada_em IS NULL) THEN
      f := array_append(f, 'Registrar a alergia do paciente (tem ou nega)');
    END IF;
    IF jsonb_typeof(b -> 'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(b -> 'itens') = 0 THEN
      f := array_append(f, 'Ao menos um medicamento');
    ELSE
      FOR it IN SELECT x FROM jsonb_array_elements(b -> 'itens') x LOOP
        v_med := coalesce(nullif(btrim(CASE WHEN jsonb_typeof(it) = 'object' THEN it ->> 'medicamento' ELSE it #>> '{}' END), ''), 'medicamento');
        IF jsonb_typeof(it) = 'object' AND coalesce(it ->> 'medicamento_id', '') ~ '^[0-9a-fA-F-]{36}$' THEN
          v_trava := private.alergia_que_trava(p_paciente, (it ->> 'medicamento_id')::uuid);
          IF v_trava IS NOT NULL THEN
            f := array_append(f, (v_med || ': bloqueado pela alergia a ' || v_trava || ' — remova o item'));
          END IF;
        END IF;
        IF jsonb_typeof(it) IS DISTINCT FROM 'object' OR btrim(coalesce(it ->> 'posologia', '')) = '' THEN
          f := array_append(f, ('Como tomar ' || v_med));
        END IF;
        IF jsonb_typeof(it) = 'object'
           AND ((b -> 'controle_especial') = 'true'::jsonb OR (it -> 'controle_especial') = 'true'::jsonb) THEN
          v_controle := true;
          IF btrim(coalesce(it ->> 'quantidade', '')) = '' THEN
            f := array_append(f, ('Quantidade de ' || v_med || ' (controle especial)'));
          END IF;
        END IF;
      END LOOP;
    END IF;
    IF v_controle AND private.folha_registro(p_autor) IS NULL THEN
      f := array_append(f, 'Seu registro no conselho no perfil (vai na receita de controle especial)');
    END IF;
    IF v_controle AND btrim(coalesce(pa.endereco, '')) = '' THEN
      f := array_append(f, 'Endereço do paciente no cadastro (vai na receita de controle especial)');
    END IF;

  ELSIF p_tipo = 'encaminhamento' THEN
    b := CASE WHEN jsonb_typeof(j -> 'encaminhamento') = 'object' THEN j -> 'encaminhamento' ELSE '{}'::jsonb END;
    IF btrim(coalesce(b ->> 'especialidade', '')) = '' THEN f := array_append(f, 'Especialidade encaminhada'); END IF;
    IF btrim(coalesce(b ->> 'cid', '')) = '' THEN f := array_append(f, 'CID-10'); END IF;
    IF btrim(coalesce(b ->> 'motivo', b ->> 'resumo', '')) = '' THEN f := array_append(f, 'Motivo do encaminhamento'); END IF;

  ELSIF p_tipo = 'pedido_exames' THEN
    IF jsonb_typeof(j -> 'pedido') = 'object' THEN          -- formulário avulso (PedidoExames)
      b := j -> 'pedido';
      IF jsonb_typeof(b -> 'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(b -> 'itens') = 0 THEN
        f := array_append(f, 'Marcar ao menos um exame');
      END IF;
      IF btrim(coalesce(b ->> 'indicacao', '')) = '' THEN f := array_append(f, 'Indicação clínica'); END IF;
      v_cid := split_part(btrim(coalesce(b ->> 'cid', '')), ' ', 1);
      IF v_cid <> '' AND v_cid !~* '^[A-Z][0-9]{2}(\.?[0-9])?$' THEN
        f := array_append(f, 'CID-10 fora do formato (ex.: J18.9): escolha da lista');
      END IF;
      IF private.folha_registro(p_autor) IS NULL THEN
        f := array_append(f, 'Registro no conselho do solicitante não cadastrado no login');
      END IF;
    ELSIF btrim(coalesce(j #>> '{exames,texto}', '')) = '' THEN   -- aba Exames da internação
      f := array_append(f, 'Ao menos um exame');
    END IF;

  ELSIF p_tipo = 'laudo_aih' THEN
    b := CASE WHEN jsonb_typeof(j -> 'aih') = 'object' THEN j -> 'aih' ELSE '{}'::jsonb END;
    IF btrim(coalesce(b ->> 'sinais', '')) = '' THEN f := array_append(f, 'Principais sinais e sintomas clínicos'); END IF;
    IF btrim(coalesce(b ->> 'condicoes', '')) = '' THEN f := array_append(f, 'Condições que justificam a internação'); END IF;
    IF btrim(coalesce(b ->> 'diagnostico', '')) = '' THEN f := array_append(f, 'Diagnóstico inicial'); END IF;
    IF btrim(coalesce(b ->> 'cid', '')) = '' THEN f := array_append(f, 'CID-10 principal'); END IF;
    IF btrim(coalesce(b ->> 'procDesc', '')) = '' OR btrim(coalesce(b ->> 'procCod', '')) = '' THEN
      f := array_append(f, 'Procedimento com código SIGTAP');
    END IF;
    IF btrim(coalesce(b ->> 'clinica', '')) = '' THEN f := array_append(f, 'Clínica'); END IF;
    IF pa.id IS NULL THEN
      v_cad := ARRAY['paciente sem cadastro'];
    ELSE
      IF btrim(coalesce(pa.prontuario, '')) = '' THEN v_cad := array_append(v_cad, 'prontuário'); END IF;
      IF btrim(coalesce(pa.cns, '')) = '' THEN v_cad := array_append(v_cad, 'CNS'); END IF;
      IF pa.data_nascimento IS NULL THEN v_cad := array_append(v_cad, 'data de nascimento'); END IF;
      IF btrim(coalesce(pa.sexo::text, '')) = '' THEN v_cad := array_append(v_cad, 'sexo'); END IF;
      IF btrim(coalesce(pa.raca_cor::text, '')) = '' THEN v_cad := array_append(v_cad, 'raça/cor'); END IF;
      IF btrim(coalesce(pa.nome_mae, '')) = '' THEN v_cad := array_append(v_cad, 'nome da mãe'); END IF;
      IF btrim(coalesce(pa.endereco, '')) = '' THEN v_cad := array_append(v_cad, 'endereço'); END IF;
      IF btrim(coalesce(pa.municipio, '')) = '' THEN v_cad := array_append(v_cad, 'município'); END IF;
      IF btrim(coalesce(pa.uf, '')) = '' THEN v_cad := array_append(v_cad, 'UF'); END IF;
    END IF;
    IF cardinality(v_cad) > 0 THEN f := array_append(f, ('Completar o cadastro: ' || array_to_string(v_cad, ', '))); END IF;

  ELSIF p_tipo = 'prescricao' THEN
    IF jsonb_typeof(j -> 'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(j -> 'itens') = 0 THEN
      f := array_append(f, 'Ao menos um item prescrito');
    END IF;
  END IF;
  RETURN f;
END $$;
REVOKE ALL ON FUNCTION private.faltas_documento(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. o que falta no meu rascunho (para a tela listar) ─────────────────────
CREATE OR REPLACE FUNCTION public.faltas_rascunho(p_rascunho uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_rascunho;
  IF NOT FOUND OR d.estado <> 'rascunho' THEN RAISE EXCEPTION 'Rascunho não encontrado.'; END IF;
  IF d.autor_id IS DISTINCT FROM private.meu_perfil_id() THEN RAISE EXCEPTION 'Só o autor confere o próprio rascunho.'; END IF;
  RETURN to_jsonb(private.faltas_documento(d.tipo_documento, d.conteudo, d.paciente_id, d.autor_id));
END $$;
REVOKE ALL ON FUNCTION public.faltas_rascunho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faltas_rascunho(uuid) TO authenticated;

-- ── 3. emitir confere antes de numerar ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emitir_rascunho(p_rascunho uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.emitir_rascunho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_rascunho(uuid) TO authenticated;

-- ── 4. Pendências do PEP: cada rascunho diz o que falta ─────────────────────
CREATE OR REPLACE FUNCTION public.pendencias_pep(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_rasc jsonb; v_imp jsonb; v_comb jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) IS NOT NULL) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'tipo', d.tipo_documento, 'paciente_id', d.paciente_id, 'paciente', p.nome,
      'episodio_id', d.episodio_id, 'internacao_id', d.internacao_id,
      'leito', (SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = d.internacao_id),
      'criado_em', d.created_at, 'atualizado_em', d.updated_at, 'copia_de', d.copia_de,
      'faltas', to_jsonb(private.faltas_documento(d.tipo_documento, d.conteudo, d.paciente_id, d.autor_id)))
      ORDER BY d.updated_at), '[]'::jsonb)
    INTO v_rasc
    FROM public.documentos_clinicos d JOIN public.pacientes p ON p.id = d.paciente_id
   WHERE d.autor_id = v_perfil AND d.unidade_id = p_unidade AND d.estado = 'rascunho';

  WITH meus AS (
    SELECT i.id, i.paciente_id, p.nome, l.identificador AS leito
      FROM public.internacoes i
      JOIN public.pacientes p ON p.id = i.paciente_id
      LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND private.cuido_da_internacao(i)
  ), imp AS (
    SELECT m.*, (SELECT coalesce(jsonb_agg(x), '[]'::jsonb)
                   FROM jsonb_array_elements(private.impeditivos_alta(m.id)) x
                  -- meu rascunho já aparece em "para emitir"
                  WHERE NOT (x ->> 'tipo' = 'documento' AND x ->> 'autor_id' = v_perfil::text)) AS itens
      FROM meus m
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('internacao_id', imp.id, 'paciente_id', imp.paciente_id, 'paciente', imp.nome,
                                               'leito', imp.leito, 'itens', imp.itens) ORDER BY imp.leito NULLS LAST, imp.nome), '[]'::jsonb),
         (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', pe.id, 'tipo', pe.tipo, 'descricao', pe.descricao, 'prazo', pe.prazo, 'impeditiva', pe.impeditiva,
             'criada_em', pe.criada_em, 'origem', pe.origem, 'meu', pe.autor_id = v_perfil,
             'autor', (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pe.autor_id),
             'internacao_id', m.id, 'paciente_id', m.paciente_id, 'paciente', m.nome, 'leito', m.leito)
             ORDER BY pe.prazo NULLS LAST, pe.criada_em), '[]'::jsonb)
            FROM public.pendencias pe JOIN meus m ON m.id = pe.internacao_id
           WHERE pe.situacao = 'aberta' AND pe.tipo <> 'observacao')
    INTO v_imp, v_comb
    FROM imp WHERE jsonb_array_length(imp.itens) > 0;

  RETURN jsonb_build_object('rascunhos', v_rasc, 'impeditivos', coalesce(v_imp, '[]'::jsonb), 'combinadas', coalesce(v_comb, '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.pendencias_pep(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_pep(uuid) TO authenticated;
