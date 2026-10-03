-- Revisão da sessão de 03/10/2026 (bugs achados na revisão dos próprios commits):
--  1. private.folha_cabecalho devolvia 'nega' para o 4º estado "desconhece"
--     (a faixa de alergia do documento saía "NEGA ALERGIAS" para quem, na
--     verdade, não soube informar). Agora devolve 'desconhece' (migration
--     20261022000019 criou o estado).
--  2. private.faltas_documento só conferia a PRESENÇA do CID em encaminhamento
--     e laudo_aih; o pedido de exames já conferia o FORMATO. Agora os três
--     conferem o formato (CID malformado não emite).

CREATE OR REPLACE FUNCTION private.folha_cabecalho(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  u public.unidades;
  v_setor text;
  v_leito text;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO u FROM public.unidades WHERE id = pa.unidade_id;
  SELECT s.nome, l.identificador INTO v_setor, v_leito
    FROM public.internacoes i
    LEFT JOIN public.setores s ON s.id = i.setor_atual_id
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
   WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.created_at DESC LIMIT 1;
  IF v_setor IS NULL THEN
    SELECT s.nome INTO v_setor
      FROM public.episodios e JOIN public.setores s ON s.id = e.setor_id
     WHERE e.paciente_id = p_paciente AND e.encerrado_em IS NULL
     ORDER BY e.chegada_em DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'unidade', jsonb_strip_nulls(jsonb_build_object('nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf)),
    'paciente', jsonb_strip_nulls(jsonb_build_object(
      'nome', coalesce(nullif(btrim(pa.nome_social), ''), pa.nome), 'nascimento', pa.data_nascimento, 'sexo', pa.sexo,
      'prontuario', pa.prontuario, 'cns', pa.cns, 'cpf', pa.cpf, 'mae', pa.nome_mae, 'telefone', pa.telefone,
      'endereco', pa.endereco, 'municipio', pa.municipio, 'uf', pa.uf, 'raca_cor', pa.raca_cor,
      'responsavel', pa.responsavel_nome, 'responsavel_telefone', pa.responsavel_telefone,
      'setor', v_setor, 'leito', v_leito)),
    'alergias', jsonb_build_object(
      'estado', CASE
        WHEN EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL) THEN 'tem'
        ELSE coalesce((SELECT CASE WHEN n.tipo = 'desconhece' THEN 'desconhece' ELSE 'nega' END
                         FROM public.alergias_negacoes n
                        WHERE n.paciente_id = p_paciente AND n.encerrada_em IS NULL LIMIT 1), 'nao_registrada') END,
      'itens', coalesce((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('substancia', a.substancia, 'gravidade', a.gravidade, 'reacao', a.reacao))
                         ORDER BY a.registrado_em)
          FROM public.alergias_paciente a
         WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL), '[]'::jsonb)));
END $$;

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
    v_cid := split_part(btrim(coalesce(b ->> 'cid', '')), ' ', 1);
    IF v_cid = '' THEN f := array_append(f, 'CID-10');
    ELSIF v_cid !~* '^[A-Z][0-9]{2}(\.?[0-9])?$' THEN f := array_append(f, 'CID-10 fora do formato (ex.: J18.9): escolha da lista');
    END IF;
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
    v_cid := split_part(btrim(coalesce(b ->> 'cid', '')), ' ', 1);
    IF v_cid = '' THEN f := array_append(f, 'CID-10 principal');
    ELSIF v_cid !~* '^[A-Z][0-9]{2}(\.?[0-9])?$' THEN f := array_append(f, 'CID-10 principal fora do formato (ex.: J18.9): escolha da lista');
    END IF;
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
