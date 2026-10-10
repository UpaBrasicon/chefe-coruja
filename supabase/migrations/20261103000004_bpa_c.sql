-- Fase 3, tarefa 4: BPA consolidado (BPA-C), com as decisões do RT de
-- 10/10/2026 registradas no BACKLOG.
--
-- • SIGTAP completo:
--   - terminologia.sigtap_procedimento_registro: instrumento de registro
--     (01 BPA-C, 02 BPA-I...; DATASUS tb_registro).
--   - terminologia.sigtap_procedimento_ocupacao: CBO aceitos por
--     procedimento.
--   - sigtap_procedimento.qt_maxima: quantidade máxima; 9999 no arquivo vira
--     NULL, sem limite.
--   Carregados por scripts/terminologia/gerar-sigtap-sql.ts.
-- • Críticas novas, que valem nos dois instrumentos e só quando a tabela
--   correspondente está carregada:
--   - procedimento sem BPA no SIGTAP;
--   - CBO não aceito pelo procedimento;
--   - quantidade acima do máximo.
-- • Destino de cada linha:
--   - BPA-I é o padrão.
--   - Vai para o BPA-C só o que não fecha no BPA-I e que o procedimento aceita
--     em BPA-C: o código só aceita BPA-C no SIGTAP; o código foi marcado pela
--     unidade como "sempre BPA-C"; ou o BPA-I falha só por identificação
--     (paciente sem CNS/CPF, raça/cor, etnia ou sexo; profissional sem CNS).
--     O BPA-C não leva nada disso.
--   - O resto com crítica fica fora.
-- • Arquivo: um só, com as linhas "02" (BPA-C) e "03" (BPA-I).
--   - O BPA-C soma a quantidade por CBO, procedimento e idade, em folhas de
--     20 linhas.
--   - O cabeçalho conta as duas e o campo de controle soma as duas.
--
-- Só aditiva (expand):
-- - funções novas private.bpa_linhas e private.bpa_arquivo;
-- - as RPCs públicas são recriadas com a mesma assinatura;
-- - bpa_i_linhas e bpa_i_arquivo ficam sem uso até o contract.

-- ── SIGTAP: instrumento, CBO e quantidade máxima ────────────────────────────
ALTER TABLE terminologia.sigtap_procedimento ADD COLUMN IF NOT EXISTS qt_maxima integer;

CREATE TABLE IF NOT EXISTS terminologia.sigtap_procedimento_registro (
  procedimento text NOT NULL,
  registro     text NOT NULL CHECK (registro ~ '^[0-9]{2}$'),
  competencia  text NOT NULL,
  PRIMARY KEY (procedimento, registro)
);
CREATE TABLE IF NOT EXISTS terminologia.sigtap_procedimento_ocupacao (
  procedimento text NOT NULL,
  cbo          text NOT NULL,
  competencia  text NOT NULL,
  PRIMARY KEY (procedimento, cbo)
);
ALTER TABLE terminologia.sigtap_procedimento_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminologia.sigtap_procedimento_ocupacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON terminologia.sigtap_procedimento_registro, terminologia.sigtap_procedimento_ocupacao FROM anon;
GRANT SELECT ON terminologia.sigtap_procedimento_registro, terminologia.sigtap_procedimento_ocupacao TO authenticated;
DROP POLICY IF EXISTS sigtap_registro_leitura ON terminologia.sigtap_procedimento_registro;
CREATE POLICY sigtap_registro_leitura ON terminologia.sigtap_procedimento_registro FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sigtap_ocupacao_leitura ON terminologia.sigtap_procedimento_ocupacao;
CREATE POLICY sigtap_ocupacao_leitura ON terminologia.sigtap_procedimento_ocupacao FOR SELECT TO authenticated USING (true);

-- ── unidade: código "sempre BPA-C" ──────────────────────────────────────────
ALTER TABLE public.bpa_procedimentos_unidade ADD COLUMN IF NOT EXISTS sempre_bpa_c boolean NOT NULL DEFAULT false;
ALTER TABLE public.bpa_fechamentos ADD COLUMN IF NOT EXISTS linhas_bpa_c integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.marcar_sempre_bpa_c(p_id uuid, p_sempre boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.bpa_procedimentos_unidade;
BEGIN
  SELECT * INTO b FROM public.bpa_procedimentos_unidade WHERE id = p_id AND vigente_ate IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Associação não encontrada.'; END IF;
  PERFORM private.exigir_faturamento(b.unidade_id);
  IF p_sempre AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro WHERE procedimento = b.procedimento)
     AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro WHERE procedimento = b.procedimento AND registro = '01') THEN
    RAISE EXCEPTION 'O SIGTAP não aceita este procedimento em BPA consolidado.';
  END IF;
  UPDATE public.bpa_procedimentos_unidade SET sempre_bpa_c = coalesce(p_sempre, false) WHERE id = p_id;
  PERFORM private.registrar_auditoria('bpa_procedimento_sempre_bpa_c', 'bpa_procedimentos_unidade', p_id, b.unidade_id,
    jsonb_build_object('procedimento', b.procedimento, 'sempre_bpa_c', coalesce(p_sempre, false)));
END $$;
REVOKE ALL ON FUNCTION public.marcar_sempre_bpa_c(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_sempre_bpa_c(uuid, boolean) TO authenticated;

-- ── linhas com destino ──────────────────────────────────────────────────────
-- Críticas de identificação: barram o BPA-I, não o BPA-C.
CREATE OR REPLACE FUNCTION private.critica_de_identificacao(p_codigo text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_codigo IN ('raca', 'etnia', 'sexo', 'cns_profissional')
$$;

CREATE OR REPLACE FUNCTION private.bpa_linhas(p_unidade uuid, p_competencia text)
RETURNS TABLE (
  origem text, origem_id uuid, paciente_id uuid, episodio_id uuid, profissional_id uuid,
  em timestamptz, procedimento text, quantidade integer,
  paciente text, profissional text, prof_cns text, prof_cbo text, cid text,
  pac_cns text, pac_cpf text, sexo text, nascimento date, idade integer, raca text, etnia text,
  nacionalidade text, municipio_ibge text, cep text, tipo_logradouro text, endereco text,
  complemento text, numero text, bairro text, telefone text, situacao_rua boolean, sem_documento boolean,
  criticas jsonb, avisos jsonb, destino text, motivo_c text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tem_registro boolean := EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro);
  l record; extra jsonb; aceita_i boolean; aceita_c boolean; sempre_c boolean;
  ident jsonb; outras jsonb; sem_doc boolean; v_crit jsonb; v_destino text; v_motivo text;
BEGIN
  FOR l IN SELECT * FROM private.bpa_i_linhas(p_unidade, p_competencia) LOOP
    extra := '[]'::jsonb;
    IF l.procedimento IS NOT NULL THEN
      IF tem_registro AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro r
                                       WHERE r.procedimento = l.procedimento AND r.registro IN ('01', '02')) THEN
        extra := extra || jsonb_build_object('codigo', 'instrumento', 'texto', 'O SIGTAP não registra este procedimento em BPA.');
      END IF;
      IF l.prof_cbo IS NOT NULL AND EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao o WHERE o.procedimento = l.procedimento)
         AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao o WHERE o.procedimento = l.procedimento AND o.cbo = l.prof_cbo) THEN
        extra := extra || jsonb_build_object('codigo', 'cbo_nao_aceito',
          'texto', 'O CBO ' || l.prof_cbo || ' não está entre os aceitos pelo procedimento no SIGTAP.');
      END IF;
      IF (SELECT sp.qt_maxima FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = l.procedimento) < l.quantidade THEN
        extra := extra || jsonb_build_object('codigo', 'quantidade_maxima', 'texto',
          'Quantidade ' || l.quantidade || ' acima do máximo do SIGTAP (' ||
          (SELECT sp.qt_maxima FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = l.procedimento) || ').');
      END IF;
    END IF;
    -- a lista de CBO carregada substitui a regra fixa da medicação
    v_crit := l.criticas;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_ocupacao o WHERE o.procedimento = l.procedimento) THEN
      v_crit := (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(v_crit) x WHERE x->>'codigo' <> 'cbo_enfermagem');
    END IF;
    v_crit := v_crit || extra;

    aceita_i := NOT tem_registro OR EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro r
                                             WHERE r.procedimento = l.procedimento AND r.registro = '02');
    aceita_c := EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento_registro r
                         WHERE r.procedimento = l.procedimento AND r.registro = '01');
    sempre_c := EXISTS (SELECT 1 FROM public.bpa_procedimentos_unidade b
                         WHERE b.unidade_id = p_unidade AND b.procedimento = l.procedimento AND b.vigente_ate IS NULL AND b.sempre_bpa_c);
    ident  := (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(v_crit) x WHERE private.critica_de_identificacao(x->>'codigo'));
    outras := (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(v_crit) x WHERE NOT private.critica_de_identificacao(x->>'codigo'));
    sem_doc := EXISTS (SELECT 1 FROM jsonb_array_elements(l.avisos) x WHERE x->>'codigo' = 'documento');

    v_motivo := NULL;
    IF jsonb_array_length(outras) > 0 THEN
      v_destino := 'fora';
    ELSIF sempre_c AND (aceita_c OR NOT tem_registro) THEN
      v_destino := 'bpa_c'; v_motivo := 'Código marcado pela unidade como "sempre BPA-C".';
    ELSIF NOT aceita_i AND aceita_c THEN
      v_destino := 'bpa_c'; v_motivo := 'O SIGTAP só aceita este procedimento em BPA consolidado.';
    ELSIF (jsonb_array_length(ident) > 0 OR sem_doc) AND aceita_c THEN
      v_destino := 'bpa_c';
      v_motivo := 'Não fecha no BPA-I (' ||
        (SELECT string_agg(x->>'texto', ' ') FROM jsonb_array_elements(ident || CASE WHEN sem_doc
           THEN jsonb_build_array(jsonb_build_object('texto', 'Paciente sem CNS nem CPF.')) ELSE '[]'::jsonb END) x) || ')';
    ELSIF jsonb_array_length(ident) > 0 THEN
      v_destino := 'fora';
    ELSE
      v_destino := 'bpa_i';
    END IF;

    origem := l.origem; origem_id := l.origem_id; paciente_id := l.paciente_id; episodio_id := l.episodio_id;
    profissional_id := l.profissional_id; em := l.em; procedimento := l.procedimento; quantidade := l.quantidade;
    paciente := l.paciente; profissional := l.profissional; prof_cns := l.prof_cns; prof_cbo := l.prof_cbo; cid := l.cid;
    pac_cns := l.pac_cns; pac_cpf := l.pac_cpf; sexo := l.sexo; nascimento := l.nascimento; idade := l.idade;
    raca := l.raca; etnia := l.etnia; nacionalidade := l.nacionalidade; municipio_ibge := l.municipio_ibge; cep := l.cep;
    tipo_logradouro := l.tipo_logradouro; endereco := l.endereco; complemento := l.complemento; numero := l.numero;
    bairro := l.bairro; telefone := l.telefone; situacao_rua := l.situacao_rua; sem_documento := l.sem_documento;
    criticas := v_crit; avisos := l.avisos; destino := v_destino; motivo_c := v_motivo;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.bpa_linhas(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── arquivo com BPA-C e BPA-I ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.bpa_arquivo(p_unidade uuid, p_competencia text, p_processamento text,
  OUT arquivo text, OUT linhas integer, OUT folhas integer, OUT controle integer, OUT linhas_c integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades; c public.bpa_config_unidade;
  l record; v_corpo text := ''; v_soma numeric := 0;
  v_prof text; v_cbo text; v_folha integer := 0; v_seq integer := 0;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  linhas := 0; folhas := 0; linhas_c := 0;

  -- BPA-C: soma por CBO, procedimento e idade
  FOR l IN SELECT t.prof_cbo, t.procedimento, t.idade, sum(t.quantidade)::integer AS qt
             FROM private.bpa_linhas(p_unidade, p_competencia) t WHERE t.destino = 'bpa_c'
            GROUP BY 1, 2, 3 ORDER BY 1, 2, 3 LOOP
    IF v_seq = 0 OR v_seq = 20 THEN v_folha := v_folha + 1; v_seq := 0; folhas := folhas + 1; END IF;
    IF v_folha > 999 THEN RAISE EXCEPTION 'BPA: mais de 999 folhas de BPA consolidado na competência.'; END IF;
    v_seq := v_seq + 1; linhas := linhas + 1; linhas_c := linhas_c + 1;
    v_soma := v_soma + l.procedimento::numeric + l.qt;
    v_corpo := v_corpo || '02'
      || private.bpa_num(u.cnes, 7) || private.bpa_num(p_competencia, 6) || private.bpa_alfa(l.prof_cbo, 6)
      || private.bpa_num(v_folha::text, 3) || private.bpa_num(v_seq::text, 2)
      || private.bpa_num(l.procedimento, 10) || private.bpa_num(l.idade::text, 3) || private.bpa_num(l.qt::text, 6)
      || 'BPA' || E'\r\n';
  END LOOP;

  -- BPA-I: folhas por profissional (CNS), trocando quando muda o CBO
  v_folha := 0; v_seq := 0;
  FOR l IN SELECT * FROM private.bpa_linhas(p_unidade, p_competencia) t WHERE t.destino = 'bpa_i'
            ORDER BY t.prof_cns, t.prof_cbo, t.em, t.paciente, t.origem_id LOOP
    IF l.prof_cns IS DISTINCT FROM v_prof THEN
      v_prof := l.prof_cns; v_cbo := l.prof_cbo; v_folha := 1; v_seq := 0; folhas := folhas + 1;
    ELSIF l.prof_cbo IS DISTINCT FROM v_cbo OR v_seq = 20 THEN
      v_cbo := l.prof_cbo; v_folha := v_folha + 1; v_seq := 0; folhas := folhas + 1;
    END IF;
    IF v_folha > 999 THEN RAISE EXCEPTION 'BPA: mais de 999 folhas para um profissional na competência.'; END IF;
    v_seq := v_seq + 1; linhas := linhas + 1;
    v_soma := v_soma + l.procedimento::numeric + l.quantidade;
    v_corpo := v_corpo || '03'
      || private.bpa_num(u.cnes, 7) || private.bpa_num(p_competencia, 6)
      || private.bpa_num(l.prof_cns, 15) || private.bpa_alfa(l.prof_cbo, 6)
      || private.bpa_num(to_char(l.em AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD'), 8)
      || private.bpa_num(v_folha::text, 3) || private.bpa_num(v_seq::text, 2)
      || private.bpa_num(l.procedimento, 10) || private.bpa_num(l.pac_cns, 15)
      || private.bpa_alfa(l.sexo, 1) || private.bpa_num(l.municipio_ibge, 6)
      || private.bpa_alfa(l.cid, 4) || private.bpa_num(l.idade::text, 3)
      || private.bpa_num(l.quantidade::text, 6) || private.bpa_num(c.carater_atendimento, 2)
      || private.bpa_num(NULL, 13) || 'BPA'
      || private.bpa_alfa(l.paciente, 30) || private.bpa_num(to_char(l.nascimento, 'YYYYMMDD'), 8)
      || private.bpa_num(l.raca, 2) || private.bpa_num(l.etnia, 4) || private.bpa_num(l.nacionalidade, 3)
      || private.bpa_num(NULL, 3) || private.bpa_num(NULL, 3)
      || private.bpa_num(NULL, 8) || private.bpa_num(NULL, 4)
      || private.bpa_num(NULL, 14)
      || private.bpa_num(l.cep, 8) || private.bpa_num(l.tipo_logradouro, 3)
      || private.bpa_alfa(l.endereco, 30) || private.bpa_alfa(l.complemento, 10)
      || private.bpa_alfa(l.numero, 5) || private.bpa_alfa(l.bairro, 30)
      || private.bpa_num(l.telefone, 11) || private.bpa_alfa(NULL, 40)
      || private.bpa_num(c.ine, 10) || private.bpa_num(l.pac_cpf, 11)
      || CASE WHEN l.situacao_rua THEN 'S' ELSE 'N' END
      || CASE WHEN l.sem_documento THEN 'S' ELSE 'N' END
      || E'\r\n';
  END LOOP;

  controle := (v_soma % 1111)::integer + 1111;
  arquivo := '01#BPA#' || private.bpa_num(p_processamento, 6) || private.bpa_num(linhas::text, 6)
    || private.bpa_num(folhas::text, 6) || controle::text
    || private.bpa_alfa(c.orgao_origem, 30) || private.bpa_alfa(c.sigla, 6) || private.bpa_num(c.cnpj, 14)
    || private.bpa_alfa(c.orgao_destino, 40) || coalesce(c.destino, ' ') || private.bpa_alfa('CORUJA 1.0', 10)
    || E'\r\n' || v_corpo;
END $$;
REVOKE ALL ON FUNCTION private.bpa_arquivo(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── conferência e fechamento (mesmas assinaturas) ───────────────────────────
CREATE OR REPLACE FUNCTION public.bpa_conferencia(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; f public.bpa_fechamentos;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  SELECT * INTO f FROM public.bpa_fechamentos
   WHERE unidade_id = p_unidade AND competencia = p_competencia ORDER BY fechado_em DESC LIMIT 1;
  WITH l AS (SELECT * FROM private.bpa_linhas(p_unidade, p_competencia))
  SELECT jsonb_build_object(
    'competencia', p_competencia,
    'globais', private.bpa_globais(p_unidade, p_competencia),
    'total', (SELECT count(*) FROM l),
    'prontas', (SELECT count(*) FROM l WHERE l.destino IN ('bpa_i', 'bpa_c')),
    'bpa_i', (SELECT count(*) FROM l WHERE l.destino = 'bpa_i'),
    'bpa_c', (SELECT count(*) FROM l WHERE l.destino = 'bpa_c'),
    'com_critica', (SELECT count(*) FROM l WHERE l.destino = 'fora'),
    'com_aviso', (SELECT count(*) FROM l WHERE l.destino = 'bpa_i' AND jsonb_array_length(l.avisos) > 0),
    'por_origem', (SELECT coalesce(jsonb_object_agg(o.origem, o.n), '{}'::jsonb)
                     FROM (SELECT l.origem, count(*) AS n FROM l GROUP BY l.origem) o),
    'por_critica', (SELECT coalesce(jsonb_object_agg(k.codigo, k.n), '{}'::jsonb)
                      FROM (SELECT x->>'codigo' AS codigo, count(*) AS n FROM l, jsonb_array_elements(l.criticas || l.avisos) x GROUP BY 1) k),
    'linhas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'origem', p.origem, 'origem_id', p.origem_id, 'paciente_id', p.paciente_id, 'episodio_id', p.episodio_id,
                 'paciente', p.paciente, 'profissional', p.profissional, 'em', p.em,
                 'procedimento', p.procedimento, 'quantidade', p.quantidade,
                 'criticas', p.criticas, 'avisos', p.avisos, 'destino', p.destino, 'motivo_c', p.motivo_c)
                 ORDER BY (p.destino = 'fora') DESC, p.em), '[]'::jsonb)
                 FROM (SELECT * FROM l WHERE l.destino IN ('fora', 'bpa_c') OR jsonb_array_length(l.avisos) > 0
                        ORDER BY (l.destino = 'fora') DESC, l.em LIMIT 500) p),
    'fechamento', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
                    'id', f.id, 'situacao', f.situacao, 'processamento', f.processamento,
                    'linhas', f.linhas, 'linhas_bpa_c', f.linhas_bpa_c, 'folhas', f.folhas, 'controle', f.controle,
                    'fechado_por', (SELECT nome_completo FROM public.perfis WHERE id = f.fechado_por), 'fechado_em', f.fechado_em,
                    'reaberto_por', (SELECT nome_completo FROM public.perfis WHERE id = f.reaberto_por), 'reaberto_em', f.reaberto_em,
                    'motivo_reabertura', f.motivo_reabertura) END)
  INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.fechar_competencia_bpa(p_unidade uuid, p_competencia text, p_processamento text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_proc text := coalesce(p_processamento, private.competencia_de(now()));
  v_glob jsonb; v_bloq text; a record; v_id uuid;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  PERFORM private.conferir_competencia_texto(v_proc);
  IF v_proc < p_competencia THEN RAISE EXCEPTION 'O processamento não pode ser antes da competência de realização.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bpa:' || p_unidade::text || ':' || p_competencia));
  IF private.competencia_fechada(p_unidade, p_competencia) THEN
    RAISE EXCEPTION 'Competência já fechada. Reabra com motivo para gerar de novo.';
  END IF;
  v_glob := private.bpa_globais(p_unidade, p_competencia);
  SELECT string_agg(g->>'texto', ' ') INTO v_bloq FROM jsonb_array_elements(v_glob) g WHERE g->>'tipo' = 'bloqueio';
  IF v_bloq IS NOT NULL THEN RAISE EXCEPTION 'Não dá para fechar: %', v_bloq; END IF;
  SELECT * INTO a FROM private.bpa_arquivo(p_unidade, p_competencia, v_proc);
  IF a.linhas = 0 THEN RAISE EXCEPTION 'Nenhuma linha sem crítica nesta competência.'; END IF;
  INSERT INTO public.bpa_fechamentos (unidade_id, competencia, processamento, linhas, linhas_bpa_c, folhas, controle, arquivo,
                                      excluidas, avisos, sigtap_competencia, fechado_por)
  VALUES (p_unidade, p_competencia, v_proc, a.linhas, a.linhas_c, a.folhas, a.controle, a.arquivo,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('origem', l.origem, 'origem_id', l.origem_id, 'paciente', l.paciente,
                    'em', l.em, 'procedimento', l.procedimento, 'criticas', l.criticas)), '[]'::jsonb)
             FROM private.bpa_linhas(p_unidade, p_competencia) l WHERE l.destino = 'fora'),
          (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM jsonb_array_elements(v_glob) g WHERE g->>'tipo' = 'aviso'),
          private.sigtap_competencia(), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('bpa_competencia_fechada', 'bpa_fechamentos', v_id, p_unidade,
    jsonb_build_object('competencia', p_competencia, 'processamento', v_proc, 'linhas', a.linhas, 'linhas_bpa_c', a.linhas_c));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.bpa_fechamentos_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'competencia', f.competencia, 'processamento', f.processamento, 'situacao', f.situacao,
      'linhas', f.linhas, 'linhas_bpa_c', f.linhas_bpa_c, 'folhas', f.folhas, 'controle', f.controle,
      'excluidas', jsonb_array_length(f.excluidas),
      'fechado_por', pf.nome_completo, 'fechado_em', f.fechado_em,
      'reaberto_por', pr.nome_completo, 'reaberto_em', f.reaberto_em, 'motivo_reabertura', f.motivo_reabertura)
      ORDER BY f.competencia DESC, f.fechado_em DESC)
    FROM public.bpa_fechamentos f
    LEFT JOIN public.perfis pf ON pf.id = f.fechado_por
    LEFT JOIN public.perfis pr ON pr.id = f.reaberto_por
   WHERE f.unidade_id = p_unidade), '[]'::jsonb);
END $$;

-- configuração devolve também o "sempre BPA-C" e os instrumentos do SIGTAP
CREATE OR REPLACE FUNCTION public.bpa_config(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.bpa_config_unidade;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  RETURN jsonb_build_object(
    'cnes', (SELECT cnes FROM public.unidades WHERE id = p_unidade),
    'orgao_origem', c.orgao_origem, 'sigla', c.sigla, 'cnpj', c.cnpj, 'orgao_destino', c.orgao_destino,
    'destino', c.destino, 'carater_atendimento', c.carater_atendimento, 'ine', c.ine,
    'atualizado_por', (SELECT nome_completo FROM public.perfis WHERE id = c.atualizado_por), 'atualizado_em', c.atualizado_em,
    'sigtap_competencia', private.sigtap_competencia(),
    'procedimentos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'procedimento', b.procedimento, 'uso', b.uso, 'nome', sp.nome, 'no_sigtap', sp.codigo IS NOT NULL,
        'sempre_bpa_c', b.sempre_bpa_c,
        'instrumentos', (SELECT coalesce(jsonb_agg(r.registro ORDER BY r.registro), '[]'::jsonb)
                           FROM terminologia.sigtap_procedimento_registro r WHERE r.procedimento = b.procedimento),
        'definido_por', pf.nome_completo, 'definido_em', b.definido_em) ORDER BY b.uso, b.procedimento)
      FROM public.bpa_procedimentos_unidade b
      LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = b.procedimento
      LEFT JOIN public.perfis pf ON pf.id = b.definido_por
     WHERE b.unidade_id = p_unidade AND b.vigente_ate IS NULL), '[]'::jsonb));
END $$;
