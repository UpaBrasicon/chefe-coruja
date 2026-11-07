-- ════════════════════════════════════════════════════════════════════════════
-- Prontuário completo em linha do tempo (achado guardado de 08/10/2026, item 6;
-- docs/clinico/PRONTUARIO-COMPLETO-DIAGNOSTICO.md). Decisão do RT em
-- 06/11/2026: A em P1 a P7, direção visual A.
--
-- public.prontuario_leitura(p_paciente, p_antes, p_limite): os atendimentos do
-- paciente (cadastros unificados juntos), do mais recente para o mais antigo,
-- p_limite por vez (5 por padrão; "Ver mais atendimentos" passa em p_antes a
-- chegada do último já mostrado), com tudo o que é de cada um: internação,
-- classificação e reclassificação, registro do atendimento (SOAP), exames,
-- documentos, prescrições e sinais vitais. Na primeira página vêm também os
-- registros sem atendimento ligado (ou de atendimento que quem lê não vê).
--
-- Por que existe (P2): as tabelas clínicas já aceitam o pedido de acesso
-- vigente (policies *_pedido_acesso com private.acesso_encerrado_vigente), mas
-- os nomes que o cabeçalho do atendimento pede não: perfis (médico, autor) só
-- lê o próprio perfil e o administrador; unidades, setores e leitos só os da
-- unidade de quem lê; e exame_resultados não tem leitura direta (só por
-- exame_detalhe, que não aceita o pedido).
--
-- Como protege:
-- • public.prontuario_leitura é SECURITY INVOKER: cada linha clínica passa
--   pelo RLS de quem chama, igual à leitura direta que a tela fazia. Quem lê
--   pelo pedido vê exatamente o que o pedido libera; o gestor e quem está na
--   escala, o que já viam. Nada de acesso novo a linha clínica.
-- • Antes de ler, confere o acesso ao paciente como cadastros_do_paciente
--   (gestor da unidade, escala, pedido vigente ou teleinterconsulta) e exige o
--   segundo fator. Sem acesso, recusa com a frase que a tela já mostrava.
-- • Os nomes e o resultado vigente dos exames vêm de
--   private.prontuario_complemento (SECURITY DEFINER), que repete a conferência
--   de acesso e só devolve nome de quem/onde aparece nos registros do próprio
--   paciente e resultado de exame do próprio paciente. As ids que ela recebe
--   saem das linhas que o RLS já deixou passar. Fica no schema private, que a
--   API não expõe.
-- • Só leitura: não grava nada. Abrir a tela continua chamando
--   abrir_prontuario, que grava o acesso, antes desta leitura.
--
-- Só expande: três funções novas.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   DROP FUNCTION IF EXISTS public.prontuario_leitura(uuid, timestamptz, integer);
--   DROP FUNCTION IF EXISTS private.prontuario_complemento(uuid, uuid[], uuid[]);
--   DROP FUNCTION IF EXISTS private.pode_ler_prontuario(uuid);
-- A tela anterior (leitura direta) não depende destas funções.
-- Teste: supabase/tests/depois_prontuario_leitura.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Acesso ao paciente para a leitura do prontuário: o mesmo de
-- cadastros_do_paciente e de alergias_do_paciente.
CREATE OR REPLACE FUNCTION private.pode_ler_prontuario(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
     WHERE pa.id = p_paciente
       AND (   private.gestor_da_unidade(pa.unidade_id)
            OR private.pode_atuar_no_paciente(p_paciente)
            OR private.acesso_encerrado_vigente(p_paciente)
            OR private.teleinterconsulta_vigente(p_paciente)));
$$;
REVOKE ALL ON FUNCTION private.pode_ler_prontuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_ler_prontuario(uuid) TO authenticated;

-- Nomes (unidade, setor, leito, profissional) e resultado vigente dos exames
-- para a leitura do prontuário. Só o que pertence ao paciente pedido.
CREATE OR REPLACE FUNCTION private.prontuario_complemento(p_paciente uuid, p_ids uuid[], p_exames uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fam    uuid[];
  v_nomes  jsonb;
  v_result jsonb;
BEGIN
  IF private.pode_ler_prontuario(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_fam := ARRAY(SELECT private.familia_paciente(p_paciente));

  WITH ref(id) AS (
    SELECT unnest(ARRAY[e.atendimento_medico_id, e.unidade_id, e.setor_id]) FROM public.episodios e WHERE e.paciente_id = ANY (v_fam)
    UNION SELECT unnest(ARRAY[i.unidade_id, i.setor_atual_id, i.leito_atual_id]) FROM public.internacoes i WHERE i.paciente_id = ANY (v_fam)
    UNION SELECT r.autor_id FROM public.atendimento_registros r WHERE r.paciente_id = ANY (v_fam)
    UNION SELECT p.medico_id FROM public.prescricoes p WHERE p.paciente_id = ANY (v_fam)
    UNION SELECT d.autor_id FROM public.documentos_clinicos d WHERE d.paciente_id = ANY (v_fam)
    UNION SELECT x.pedido_por FROM public.exames_pedidos x WHERE x.paciente_id = ANY (v_fam)
  ), alvo(id) AS (
    SELECT id FROM ref WHERE id = ANY (p_ids)
  )
  SELECT coalesce(jsonb_object_agg(n.id, n.nome), '{}'::jsonb) INTO v_nomes
    FROM (
      SELECT pf.id, pf.nome_completo AS nome FROM public.perfis pf JOIN alvo USING (id)
      UNION ALL SELECT u.id, u.nome FROM public.unidades u JOIN alvo USING (id)
      UNION ALL SELECT s.id, s.nome FROM public.setores s JOIN alvo USING (id)
      UNION ALL SELECT l.id, l.identificador FROM public.leitos l JOIN alvo USING (id)
    ) n
   WHERE n.nome IS NOT NULL;

  SELECT coalesce(jsonb_object_agg(r.exame_id, jsonb_build_object(
           'versao', r.versao, 'texto', r.texto, 'liberado_em', r.liberado_em,
           'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('analito', i.analito, 'valor', i.valor_texto, 'valor_num', i.valor_num,
                                                                 'unidade', i.unidade, 'referencia', i.referencia) ORDER BY i.ordem)
                                FROM public.exame_resultado_itens i WHERE i.resultado_id = r.id), '[]'::jsonb))), '{}'::jsonb)
    INTO v_result
    FROM public.exame_resultados r
    JOIN public.exames_pedidos x ON x.id = r.exame_id
   WHERE r.exame_id = ANY (p_exames) AND r.vigente AND x.paciente_id = ANY (v_fam);

  RETURN jsonb_build_object('nomes', v_nomes, 'resultados', v_result);
END $$;
REVOKE ALL ON FUNCTION private.prontuario_complemento(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.prontuario_complemento(uuid, uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.prontuario_leitura(p_paciente uuid, p_antes timestamptz DEFAULT NULL, p_limite integer DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_limite  integer := least(greatest(coalesce(p_limite, 5), 1), 50);
  v_avulsos boolean := p_antes IS NULL;  -- registros sem atendimento: só na primeira página
  v_fam     uuid[];
  v_vis     uuid[];   -- atendimentos do paciente que quem lê vê (RLS)
  v_int_ep  jsonb;    -- internação -> atendimento visível
  v_eps     uuid[];   -- atendimentos desta página
  v_ints    uuid[];   -- internações destes atendimentos
  v_mais    boolean;
  v_dados   jsonb;
  v_ids     uuid[];
  v_exames  uuid[];
  v_extra   jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_ler_prontuario(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem acesso a este paciente. O pedido pode ter vencido ou ainda não foi aprovado.';
  END IF;
  v_fam := ARRAY(SELECT private.familia_paciente(p_paciente));

  SELECT coalesce(array_agg(e.id), '{}') INTO v_vis FROM public.episodios e WHERE e.paciente_id = ANY (v_fam);
  SELECT coalesce(jsonb_object_agg(i.id, i.episodio_id), '{}'::jsonb) INTO v_int_ep
    FROM public.internacoes i WHERE i.paciente_id = ANY (v_fam) AND i.episodio_id = ANY (v_vis);

  SELECT coalesce(array_agg(x.id ORDER BY x.chegada_em DESC, x.id DESC), '{}') INTO v_eps
    FROM (SELECT e.id, e.chegada_em FROM public.episodios e
           WHERE e.paciente_id = ANY (v_fam) AND (p_antes IS NULL OR e.chegada_em < p_antes)
           ORDER BY e.chegada_em DESC, e.id DESC
           LIMIT v_limite + 1) x;
  v_mais := cardinality(v_eps) > v_limite;
  v_eps := v_eps[1:v_limite];
  SELECT coalesce(array_agg(i.id), '{}') INTO v_ints FROM public.internacoes i WHERE i.episodio_id = ANY (v_eps);

  SELECT jsonb_build_object(
    'atendimentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id, 'paciente_id', e.paciente_id, 'unidade_id', e.unidade_id, 'setor_id', e.setor_id,
               'etapa', e.etapa, 'queixa', e.queixa, 'chegada_em', e.chegada_em, 'encerrado_em', e.encerrado_em,
               'desfecho', e.desfecho, 'desfecho_em', e.desfecho_em, 'cor_atual', e.cor_atual,
               'medico_id', e.atendimento_medico_id, 'cid_aps', to_jsonb(e.cid_aps),
               'cid_desfecho', nullif(e.desfecho_detalhes ->> 'cid_alta', ''))
             ORDER BY e.chegada_em DESC, e.id DESC)
        FROM public.episodios e WHERE e.id = ANY (v_eps)), '[]'::jsonb),

    -- as dos atendimentos da página e, na primeira, as sem atendimento visível
    'internacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'episodio_id', i.episodio_id, 'status', i.status, 'tipo_internacao', i.tipo_internacao,
               'unidade_id', i.unidade_id, 'setor_id', i.setor_atual_id, 'leito_id', i.leito_atual_id,
               'data_admissao', i.data_admissao, 'internado_em', i.internado_em, 'data_alta', i.data_alta,
               'cid_principal', i.cid_principal, 'cid_alta', i.cid_alta, 'motivo_alta', i.motivo_alta)
             ORDER BY i.data_admissao)
        FROM public.internacoes i
       WHERE i.paciente_id = ANY (v_fam)
         AND (i.id = ANY (v_ints) OR (v_avulsos AND NOT v_int_ep ? i.id::text))), '[]'::jsonb),

    'classificacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id, 'episodio_id', c.episodio_id, 'cor', c.cor, 'reclassificacao', c.reclassificacao,
               'criado_em', c.criado_em, 'discriminador', c.discriminador, 'fluxograma_nome', c.fluxograma_nome)
             ORDER BY c.criado_em)
        FROM public.classificacoes_risco c WHERE c.episodio_id = ANY (v_eps)), '[]'::jsonb),

    'registros', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'episodio_id', r.episodio_id, 'criado_em', r.criado_em, 'subjetivo', r.subjetivo,
               'objetivo', r.objetivo, 'avaliacao', r.avaliacao, 'cid', r.cid, 'plano', r.plano, 'autor_id', r.autor_id)
             ORDER BY r.criado_em)
        FROM (
          SELECT r.* FROM public.atendimento_registros r WHERE r.episodio_id = ANY (v_eps)
          UNION ALL
          (SELECT r.* FROM public.atendimento_registros r
            WHERE v_avulsos AND r.paciente_id = ANY (v_fam) AND NOT coalesce(r.episodio_id = ANY (v_vis), false)
            ORDER BY r.criado_em DESC LIMIT 100)
        ) r), '[]'::jsonb),

    'exames', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', x.id, 'episodio_id', x.episodio_id, 'internacao_id', x.internacao_id, 'exame', x.exame,
               'situacao', x.situacao, 'urgencia', x.urgencia, 'resultado', x.resultado, 'pedido_em', x.pedido_em,
               'resolvido_em', x.resolvido_em, 'pedido_por', x.pedido_por)
             ORDER BY x.pedido_em)
        FROM (
          SELECT x.* FROM public.exames_pedidos x
           WHERE x.paciente_id = ANY (v_fam)
             AND (x.episodio_id = ANY (v_eps) OR (x.episodio_id IS NULL AND x.internacao_id = ANY (v_ints)))
          UNION ALL
          (SELECT x.* FROM public.exames_pedidos x
            WHERE v_avulsos AND x.paciente_id = ANY (v_fam)
              AND NOT (coalesce(x.episodio_id = ANY (v_vis), false)
                       OR (x.episodio_id IS NULL AND v_int_ep ? coalesce(x.internacao_id::text, '')))
            ORDER BY x.pedido_em DESC LIMIT 100)
        ) x), '[]'::jsonb),

    'documentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'documento_raiz_id', d.documento_raiz_id, 'versao', d.versao, 'tipo_documento', d.tipo_documento,
               'conteudo', d.conteudo, 'estado', d.estado, 'created_at', d.created_at, 'episodio_id', d.episodio_id,
               'internacao_id', d.internacao_id, 'autor_id', d.autor_id)
             ORDER BY d.created_at)
        FROM (
          SELECT d.* FROM public.documentos_clinicos d
           WHERE d.paciente_id = ANY (v_fam) AND d.estado <> 'rascunho'
             AND (d.episodio_id = ANY (v_eps) OR (d.episodio_id IS NULL AND d.internacao_id = ANY (v_ints)))
          UNION ALL
          (SELECT d.* FROM public.documentos_clinicos d
            WHERE v_avulsos AND d.paciente_id = ANY (v_fam) AND d.estado <> 'rascunho'
              AND NOT (coalesce(d.episodio_id = ANY (v_vis), false)
                       OR (d.episodio_id IS NULL AND v_int_ep ? coalesce(d.internacao_id::text, '')))
            ORDER BY d.created_at DESC LIMIT 100)
        ) d), '[]'::jsonb),

    'prescricoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'episodio_id', p.episodio_id, 'internacao_id', p.internacao_id, 'status', p.status,
               'created_at', p.created_at, 'assinada_em', p.assinada_em, 'medico_id', p.medico_id,
               'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                           'id', it.id, 'descricao', it.descricao, 'dose', it.dose, 'posologia', it.posologia,
                                           'via', it.via, 'suspenso_em', it.suspenso_em) ORDER BY it.ordem, it.created_at, it.id)
                                    FROM public.prescricao_itens it WHERE it.prescricao_id = p.id), '[]'::jsonb))
             ORDER BY p.created_at)
        FROM (
          SELECT p.* FROM public.prescricoes p
           WHERE p.paciente_id = ANY (v_fam)
             AND (p.episodio_id = ANY (v_eps) OR (p.episodio_id IS NULL AND p.internacao_id = ANY (v_ints)))
          UNION ALL
          (SELECT p.* FROM public.prescricoes p
            WHERE v_avulsos AND p.paciente_id = ANY (v_fam)
              AND NOT (coalesce(p.episodio_id = ANY (v_vis), false)
                       OR (p.episodio_id IS NULL AND v_int_ep ? coalesce(p.internacao_id::text, '')))
            ORDER BY p.created_at DESC LIMIT 100)
        ) p), '[]'::jsonb),

    'observacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', o.id, 'episodio_id', o.episodio_id, 'internacao_id', o.internacao_id, 'aferido_em', o.aferido_em,
               'conceito', c.nome, 'unidade_padrao', c.unidade_padrao, 'valor_num', o.valor_num,
               'valor_texto', o.valor_texto, 'unidade', o.unidade)
             ORDER BY o.aferido_em DESC)
        FROM (
          SELECT o.* FROM public.observacao o
           WHERE o.paciente_id = ANY (v_fam)
             AND (o.episodio_id = ANY (v_eps) OR (o.episodio_id IS NULL AND o.internacao_id = ANY (v_ints)))
          UNION ALL
          (SELECT o.* FROM public.observacao o
            WHERE v_avulsos AND o.paciente_id = ANY (v_fam)
              AND NOT (coalesce(o.episodio_id = ANY (v_vis), false)
                       OR (o.episodio_id IS NULL AND v_int_ep ? coalesce(o.internacao_id::text, '')))
            ORDER BY o.aferido_em DESC LIMIT 300)
        ) o
        LEFT JOIN public.conceito c ON c.id = o.conceito_id), '[]'::jsonb)
  ) INTO v_dados;

  -- nomes e resultados das linhas que o RLS deixou passar
  v_ids := ARRAY(
    SELECT DISTINCT (j #>> '{}')::uuid
      FROM unnest(ARRAY['$.*[*].medico_id', '$.*[*].autor_id', '$.*[*].pedido_por',
                        '$.*[*].unidade_id', '$.*[*].setor_id', '$.*[*].leito_id']) AS caminho,
           jsonb_path_query(v_dados, caminho::jsonpath) AS j
     WHERE jsonb_typeof(j) = 'string');
  v_exames := ARRAY(SELECT (j #>> '{}')::uuid FROM jsonb_path_query(v_dados, '$.exames[*].id') AS j);
  v_extra := private.prontuario_complemento(p_paciente, v_ids, v_exames);

  RETURN v_dados || jsonb_build_object(
    'nomes', v_extra -> 'nomes',
    'resultados', v_extra -> 'resultados',
    'mais', v_mais,
    'proximo_antes', (SELECT e.chegada_em FROM public.episodios e WHERE e.id = v_eps[cardinality(v_eps)]),
    'resumo', jsonb_build_object(
      'atendimentos', cardinality(v_vis),
      'internacoes', (SELECT count(*) FROM public.internacoes i WHERE i.paciente_id = ANY (v_fam)),
      'ultimo_em', (SELECT max(e.chegada_em) FROM public.episodios e WHERE e.id = ANY (v_vis)),
      'anos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('ano', a.ano, 'atendimentos', a.n) ORDER BY a.ano DESC)
          FROM (SELECT extract(year FROM e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::int AS ano, count(*) AS n
                  FROM public.episodios e WHERE e.id = ANY (v_vis) GROUP BY 1) a), '[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.prontuario_leitura(uuid, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prontuario_leitura(uuid, timestamptz, integer) TO authenticated;
