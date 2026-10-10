-- Fase 3, tarefa 3: BPA individualizado (BPA-I), com as decisões do RT de
-- 09/10/2026 registradas no BACKLOG.
--
-- • Leiaute: BPA Magnético 05.00 (DATASUS, 09/07/2026), transcrito em
--   produto/docs/pesquisa/bpa-leiaute-oficial/leiaute-bpa-0500.md.
--   - Cabeçalho "01": 132 posições.
--   - Linha de BPA-I "03": 353 posições, as duas com CR+LF.
--   - Campo de controle: (soma dos códigos de procedimento + quantidades)
--     mod 1111 + 1111.
--   - O paciente vai com um documento só, o CNS ou o CPF.
-- • O que entra na competência (o mês em que foi feito, horário de Brasília):
--   - Atendimento médico: o médico que assumiu o episódio, uma linha por
--     episódio.
--   - Acolhimento com classificação de risco: a primeira classificação do
--     episódio, autor enfermeiro.
--   - Medicação: as administrações "feito" da Checagem, por quem checou,
--     somadas por paciente, profissional e dia. A prescrição de internação
--     fica fora, porque vai na AIH.
--   - Procedimentos registrados à mão: por quem fez, ou pelo faturamento em
--     nome de quem fez.
--   Cada fonte usa o código SIGTAP que a unidade associou. O código é sempre
--   conferido na tabela carregada.
-- • CNS do profissional: perfis.cns, conferido pelo dígito. O CBO vem do
--   perfil (tarefa 2).
-- • Endereço do paciente para o SUS: campos estruturados que não travam a
--   porta. O que faltar vira aviso na conferência.
-- • Papel faturamento:
--   - configura o cabeçalho e os códigos da unidade;
--   - lança procedimentos;
--   - fecha e reabre a competência, com motivo.
--   O fechamento congela o arquivo gerado. A linha com crítica bloqueante fica
--   de fora e aparece na conferência para corrigir.
--
-- Só aditiva (expand): colunas, tabelas e funções novas.

-- ── colunas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cns text;
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_cns_formato;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_cns_formato CHECK (cns IS NULL OR cns ~ '^[0-9]{15}$');
COMMENT ON COLUMN public.perfis.cns IS 'CNS do profissional (BPA-I, posições 16–30), conferido por private.cns_valido.';

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS municipio_ibge text,
  ADD COLUMN IF NOT EXISTS tipo_logradouro text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS nacionalidade text,
  ADD COLUMN IF NOT EXISTS etnia text,
  ADD COLUMN IF NOT EXISTS situacao_rua boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sem_documento boolean NOT NULL DEFAULT false;
ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_endereco_sus_check;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_endereco_sus_check CHECK (
      (cep IS NULL OR cep ~ '^[0-9]{8}$')
  AND (municipio_ibge IS NULL OR municipio_ibge ~ '^[0-9]{6}$')
  AND (tipo_logradouro IS NULL OR tipo_logradouro ~ '^[0-9]{3}$')
  AND (numero_endereco IS NULL OR length(numero_endereco) BETWEEN 1 AND 5)
  AND (complemento IS NULL OR length(complemento) <= 10)
  AND (bairro IS NULL OR length(bairro) <= 30)
  AND (nacionalidade IS NULL OR nacionalidade ~ '^[0-9]{3}$')
  AND (etnia IS NULL OR etnia ~ '^[0-9]{4}$'));
COMMENT ON COLUMN public.pacientes.municipio_ibge IS 'Município de residência, código IBGE de 6 dígitos (BPA-I, posições 76–81).';
COMMENT ON COLUMN public.pacientes.tipo_logradouro IS 'Código do tipo de logradouro da tabela do SIA (BPA-I, posições 200–202).';
COMMENT ON COLUMN public.pacientes.nacionalidade IS 'Código de nacionalidade da tabela do SIA (BPA-I, posições 157–159).';
COMMENT ON COLUMN public.pacientes.etnia IS 'Etnia indígena (Portaria SAS 508/2010, anexo I); só com raça/cor indígena.';
COMMENT ON COLUMN public.pacientes.sem_documento IS 'Pessoa sem CPF ou registro civil (BPA-I, posição 351, desde 07/2026).';

-- ── tabelas ─────────────────────────────────────────────────────────────────
-- Cabeçalho do arquivo e valores da unidade que vão em toda linha.
CREATE TABLE IF NOT EXISTS public.bpa_config_unidade (
  unidade_id          uuid PRIMARY KEY REFERENCES public.unidades(id),
  orgao_origem        text CHECK (length(orgao_origem) BETWEEN 1 AND 30),
  sigla               text CHECK (length(sigla) BETWEEN 1 AND 6),
  cnpj                text CHECK (cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  orgao_destino       text CHECK (length(orgao_destino) BETWEEN 1 AND 40),
  destino             text CHECK (destino IN ('M', 'E')),
  carater_atendimento text CHECK (carater_atendimento ~ '^[0-9]{2}$'),
  ine                 text CHECK (ine ~ '^[0-9]{10}$'),
  atualizado_por      uuid REFERENCES public.perfis(id),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);

-- Códigos SIGTAP da unidade: um por fonte automática (atendimento médico,
-- classificação, medicação) e a lista curta dos procedimentos registráveis.
-- Trocar é encerrar o vigente e criar outro, para manter o histórico.
CREATE TABLE IF NOT EXISTS public.bpa_procedimentos_unidade (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  procedimento  text NOT NULL CHECK (procedimento ~ '^[0-9]{10}$'),
  uso           text NOT NULL CHECK (uso IN ('atendimento_medico', 'classificacao', 'medicacao', 'lista')),
  definido_por  uuid NOT NULL REFERENCES public.perfis(id),
  definido_em   timestamptz NOT NULL DEFAULT now(),
  vigente_ate   timestamptz,
  encerrado_por uuid REFERENCES public.perfis(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS bpa_proc_unidade_fonte ON public.bpa_procedimentos_unidade (unidade_id, uso)
  WHERE vigente_ate IS NULL AND uso <> 'lista';
CREATE UNIQUE INDEX IF NOT EXISTS bpa_proc_unidade_lista ON public.bpa_procedimentos_unidade (unidade_id, procedimento)
  WHERE vigente_ate IS NULL AND uso = 'lista';

-- Procedimento realizado, registrado por quem fez ou pelo faturamento.
-- profissional_id é quem executou (CNS e CBO na linha); registrado_por é o
-- login que gravou.
CREATE TABLE IF NOT EXISTS public.procedimentos_realizados (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  procedimento        text NOT NULL CHECK (procedimento ~ '^[0-9]{10}$'),
  quantidade          integer NOT NULL DEFAULT 1 CHECK (quantidade BETWEEN 1 AND 999999),
  realizado_em        timestamptz NOT NULL,
  profissional_id     uuid NOT NULL REFERENCES public.perfis(id),
  cbo                 text,
  via                 text NOT NULL CHECK (via IN ('quem_fez', 'faturamento')),
  registrado_por      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em       timestamptz NOT NULL DEFAULT now(),
  cancelado_em        timestamptz,
  cancelado_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CHECK ((cancelado_em IS NULL) = (motivo_cancelamento IS NULL))
);
CREATE INDEX IF NOT EXISTS procedimentos_realizados_unidade_em ON public.procedimentos_realizados (unidade_id, realizado_em);
CREATE INDEX IF NOT EXISTS procedimentos_realizados_paciente ON public.procedimentos_realizados (paciente_id, realizado_em DESC);

-- Fechamento da competência: o arquivo gerado fica congelado. Reabrir marca
-- como reaberta (com motivo); fechar de novo cria outro registro.
CREATE TABLE IF NOT EXISTS public.bpa_fechamentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id        uuid NOT NULL REFERENCES public.unidades(id),
  competencia       text NOT NULL CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  processamento     text NOT NULL CHECK (processamento ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  situacao          text NOT NULL DEFAULT 'fechada' CHECK (situacao IN ('fechada', 'reaberta')),
  linhas            integer NOT NULL,
  folhas            integer NOT NULL,
  controle          integer NOT NULL CHECK (controle BETWEEN 1111 AND 2221),
  arquivo           text NOT NULL,
  excluidas         jsonb NOT NULL DEFAULT '[]'::jsonb,
  avisos            jsonb NOT NULL DEFAULT '[]'::jsonb,
  sigtap_competencia text,
  fechado_por       uuid NOT NULL REFERENCES public.perfis(id),
  fechado_em        timestamptz NOT NULL DEFAULT now(),
  reaberto_por      uuid REFERENCES public.perfis(id),
  reaberto_em       timestamptz,
  motivo_reabertura text,
  CHECK ((situacao = 'reaberta') = (reaberto_em IS NOT NULL AND motivo_reabertura IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bpa_fechamentos_um_fechado ON public.bpa_fechamentos (unidade_id, competencia)
  WHERE situacao = 'fechada';

ALTER TABLE public.bpa_config_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpa_procedimentos_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpa_fechamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpa_config_unidade, public.bpa_procedimentos_unidade,
              public.procedimentos_realizados, public.bpa_fechamentos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.bpa_config_unidade, public.bpa_procedimentos_unidade,
              public.procedimentos_realizados, public.bpa_fechamentos FROM authenticated;
GRANT SELECT ON public.bpa_config_unidade, public.bpa_procedimentos_unidade,
                public.procedimentos_realizados, public.bpa_fechamentos TO authenticated;

-- faturamento e gestor da unidade
CREATE OR REPLACE FUNCTION private.e_faturamento(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.tenho_papel(p_unidade, 'faturamento') OR private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()
$$;
REVOKE ALL ON FUNCTION private.e_faturamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.e_faturamento(uuid) TO authenticated;

DROP POLICY IF EXISTS bpa_config_select ON public.bpa_config_unidade;
CREATE POLICY bpa_config_select ON public.bpa_config_unidade FOR SELECT TO authenticated
  USING (private.e_faturamento(unidade_id));
DROP POLICY IF EXISTS bpa_proc_unidade_select ON public.bpa_procedimentos_unidade;
CREATE POLICY bpa_proc_unidade_select ON public.bpa_procedimentos_unidade FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS procedimentos_realizados_select ON public.procedimentos_realizados;
CREATE POLICY procedimentos_realizados_select ON public.procedimentos_realizados FOR SELECT TO authenticated
  USING (private.e_faturamento(unidade_id) OR private.pode_atuar_no_paciente(paciente_id));
DROP POLICY IF EXISTS bpa_fechamentos_select ON public.bpa_fechamentos;
CREATE POLICY bpa_fechamentos_select ON public.bpa_fechamentos FOR SELECT TO authenticated
  USING (private.e_faturamento(unidade_id));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bpa_config_unidade', 'bpa_procedimentos_unidade', 'procedimentos_realizados', 'bpa_fechamentos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_segundo_fator', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok())',
                   t || '_segundo_fator', t);
  END LOOP;
END $$;

-- ── campos do leiaute ───────────────────────────────────────────────────────
-- NUM: só dígitos, zeros à esquerda; vazio vira brancos. Valor maior que o
-- campo é erro (nunca corta número).
CREATE OR REPLACE FUNCTION private.bpa_num(p text, n integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
BEGIN
  IF d = '' THEN RETURN repeat(' ', n); END IF;
  IF length(d) > n THEN RAISE EXCEPTION 'BPA: valor % maior que o campo de % posições.', d, n; END IF;
  RETURN lpad(d, n, '0');
END $$;

-- ALFA: maiúsculas sem acento, só ASCII, brancos à direita; texto maior é
-- cortado no tamanho do campo.
CREATE OR REPLACE FUNCTION private.bpa_alfa(p text, n integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT rpad(left(regexp_replace(upper(terminologia.unaccent_text(coalesce(btrim(p), ''))), '[^A-Z0-9 .,/-]', ' ', 'g'), n), n, ' ')
$$;

CREATE OR REPLACE FUNCTION private.bpa_raca(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p WHEN 'branca' THEN '01' WHEN 'preta' THEN '02' WHEN 'parda' THEN '03'
                WHEN 'amarela' THEN '04' WHEN 'indigena' THEN '05' END
$$;

-- competência em [início, fim) no horário de Brasília
CREATE OR REPLACE FUNCTION private.competencia_limites(p_competencia text, OUT ini timestamptz, OUT fim timestamptz)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (to_date(p_competencia, 'YYYYMM')::timestamp AT TIME ZONE 'America/Sao_Paulo'),
         ((to_date(p_competencia, 'YYYYMM') + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo')
$$;

CREATE OR REPLACE FUNCTION private.competencia_de(p timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT to_char(p AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
$$;

CREATE OR REPLACE FUNCTION private.competencia_fechada(p_unidade uuid, p_competencia text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.bpa_fechamentos f
                  WHERE f.unidade_id = p_unidade AND f.competencia = p_competencia AND f.situacao = 'fechada')
$$;
REVOKE ALL ON FUNCTION private.competencia_fechada(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── linhas da competência ───────────────────────────────────────────────────
-- Cada linha com o que vai no arquivo, as críticas (bloqueiam a linha) e os
-- avisos (a linha vai, mas o campo sai vazio).
CREATE OR REPLACE FUNCTION private.bpa_i_linhas(p_unidade uuid, p_competencia text)
RETURNS TABLE (
  origem text, origem_id uuid, paciente_id uuid, episodio_id uuid, profissional_id uuid,
  em timestamptz, procedimento text, quantidade integer,
  paciente text, profissional text, prof_cns text, prof_cbo text, cid text,
  pac_cns text, pac_cpf text, sexo text, nascimento date, idade integer, raca text, etnia text,
  nacionalidade text, municipio_ibge text, cep text, tipo_logradouro text, endereco text,
  complemento text, numero text, bairro text, telefone text, situacao_rua boolean, sem_documento boolean,
  criticas jsonb, avisos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH lim AS (SELECT * FROM private.competencia_limites(p_competencia)),
  cod AS (SELECT b.uso, b.procedimento FROM public.bpa_procedimentos_unidade b
           WHERE b.unidade_id = p_unidade AND b.vigente_ate IS NULL AND b.uso <> 'lista'),
  fontes AS (
    SELECT 'atendimento'::text AS origem, e.id AS origem_id, e.paciente_id, e.id AS episodio_id,
           e.atendimento_medico_id AS prof, e.atendimento_iniciado_em AS em,
           (SELECT c.procedimento FROM cod c WHERE c.uso = 'atendimento_medico') AS proc, 1 AS qt
      FROM public.episodios e, lim
     WHERE e.unidade_id = p_unidade AND e.atendimento_medico_id IS NOT NULL
       AND e.atendimento_iniciado_em >= lim.ini AND e.atendimento_iniciado_em < lim.fim
    UNION ALL
    SELECT 'classificacao', c.id, c.paciente_id, c.episodio_id, c.autor_id, c.criado_em,
           (SELECT k.procedimento FROM cod k WHERE k.uso = 'classificacao'), 1
      FROM (SELECT DISTINCT ON (cr.episodio_id) cr.*
              FROM public.classificacoes_risco cr, lim
             WHERE cr.unidade_id = p_unidade AND cr.criado_em < lim.fim
             ORDER BY cr.episodio_id, cr.criado_em) c, lim
     WHERE c.criado_em >= lim.ini
    UNION ALL
    -- medicação: somada por paciente, profissional e dia
    SELECT 'medicacao', (array_agg(a.id ORDER BY a.registrado_em))[1], a.paciente_id,
           (array_agg(pr.episodio_id ORDER BY a.registrado_em))[1], a.registrado_por, min(a.registrado_em),
           (SELECT k.procedimento FROM cod k WHERE k.uso = 'medicacao'), count(*)::integer
      FROM public.administracoes a
      JOIN public.prescricao_itens i ON i.id = a.item_id
      JOIN public.prescricoes pr ON pr.id = i.prescricao_id, lim
     WHERE a.unidade_id = p_unidade AND a.situacao = 'feito' AND i.tipo = 'medicamento'
       AND pr.internacao_id IS NULL
       AND a.registrado_em >= lim.ini AND a.registrado_em < lim.fim
     GROUP BY a.paciente_id, a.registrado_por, (a.registrado_em AT TIME ZONE 'America/Sao_Paulo')::date
    UNION ALL
    SELECT 'registro', r.id, r.paciente_id, r.episodio_id, r.profissional_id, r.realizado_em, r.procedimento, r.quantidade
      FROM public.procedimentos_realizados r, lim
     WHERE r.unidade_id = p_unidade AND r.cancelado_em IS NULL
       AND r.realizado_em >= lim.ini AND r.realizado_em < lim.fim
  ),
  base AS (
    SELECT f.*, pa.nome AS pac_nome, pa.cns AS pcns, pa.cpf AS pcpf, pa.sexo AS psexo, pa.data_nascimento AS pnasc,
           pa.raca_cor, pa.etnia AS petnia, pa.nacionalidade AS pnac, pa.municipio_ibge AS pibge, pa.cep AS pcep,
           pa.tipo_logradouro AS plog, pa.endereco AS pend, pa.complemento AS pcompl, pa.numero_endereco AS pnum,
           pa.bairro AS pbairro, pa.telefone AS ptel, pa.situacao_rua AS prua, pa.sem_documento AS psemdoc,
           pf.nome_completo AS prof_nome, pf.cns AS pfcns, coalesce(r.cbo, pf.cbo) AS pfcbo,
           sp.codigo IS NOT NULL AS no_sigtap,
           CASE WHEN f.origem IN ('atendimento', 'registro') AND f.episodio_id IS NOT NULL THEN
             (SELECT replace(d.cid, '.', '') FROM public.diagnosticos_episodio d
               WHERE d.episodio_id = f.episodio_id AND d.tipo = 'primario' AND d.encerrado_em IS NULL
               ORDER BY d.registrado_em DESC LIMIT 1) END AS pcid
      FROM fontes f
      JOIN public.pacientes pa ON pa.id = f.paciente_id
      LEFT JOIN public.perfis pf ON pf.id = f.prof
      LEFT JOIN public.procedimentos_realizados r ON f.origem = 'registro' AND r.id = f.origem_id
      LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = f.proc
  )
  SELECT b.origem, b.origem_id, b.paciente_id, b.episodio_id, b.prof, b.em, b.proc, b.qt,
         b.pac_nome, b.prof_nome, b.pfcns, b.pfcbo, left(b.pcid, 4),
         CASE WHEN private.cns_valido(b.pcns) THEN b.pcns END,
         CASE WHEN NOT private.cns_valido(b.pcns) OR b.pcns IS NULL THEN
           CASE WHEN private.cpf_valido(b.pcpf) THEN b.pcpf END END,
         b.psexo, b.pnasc,
         CASE WHEN b.pnasc IS NOT NULL THEN extract(year FROM age((b.em AT TIME ZONE 'America/Sao_Paulo')::date, b.pnasc))::integer END,
         private.bpa_raca(b.raca_cor), CASE WHEN b.raca_cor = 'indigena' THEN b.petnia END,
         b.pnac, b.pibge, b.pcep, b.plog, b.pend, b.pcompl, b.pnum, b.pbairro,
         CASE WHEN length(private.so_digitos(b.ptel)) BETWEEN 10 AND 11 THEN private.so_digitos(b.ptel) END,
         b.prua, b.psemdoc,
         -- críticas: a linha não entra no arquivo
         (SELECT coalesce(jsonb_agg(x.c), '[]'::jsonb) FROM (VALUES
            (CASE WHEN b.proc IS NULL THEN jsonb_build_object('codigo', 'sem_codigo',
               'texto', 'A unidade não associou o código SIGTAP desta fonte (' || b.origem || ').') END),
            (CASE WHEN b.proc IS NOT NULL AND NOT b.no_sigtap THEN jsonb_build_object('codigo', 'procedimento_sigtap',
               'texto', 'Procedimento ' || b.proc || ' não existe no SIGTAP carregado.') END),
            (CASE WHEN b.prof IS NULL OR NOT private.cns_valido(b.pfcns) THEN jsonb_build_object('codigo', 'cns_profissional',
               'texto', 'Profissional sem CNS válido no perfil.') END),
            (CASE WHEN b.pfcbo IS NULL THEN jsonb_build_object('codigo', 'cbo', 'texto', 'Profissional sem CBO no perfil.') END),
            (CASE WHEN b.origem = 'medicacao' AND b.pfcbo IS NOT NULL AND left(b.pfcbo, 4) NOT IN ('2235', '3222')
               THEN jsonb_build_object('codigo', 'cbo_enfermagem',
               'texto', 'Administração de medicamentos só aceita CBO de enfermagem (SIGTAP 03.01.10.001-2).') END),
            (CASE WHEN private.bpa_raca(b.raca_cor) IS NULL THEN jsonb_build_object('codigo', 'raca',
               'texto', 'Raça/cor obrigatória no BPA-I; "sem informação" não é mais aceito (leiaute 05.00).') END),
            (CASE WHEN b.raca_cor = 'indigena' AND b.petnia IS NULL THEN jsonb_build_object('codigo', 'etnia',
               'texto', 'Raça/cor indígena pede a etnia.') END),
            (CASE WHEN b.psexo IS NULL OR b.psexo NOT IN ('M', 'F') THEN jsonb_build_object('codigo', 'sexo', 'texto', 'Sexo do paciente ausente.') END),
            (CASE WHEN b.pnasc IS NULL THEN jsonb_build_object('codigo', 'nascimento', 'texto', 'Data de nascimento ausente.') END)
          ) AS x(c) WHERE x.c IS NOT NULL),
         -- avisos: a linha vai, com o campo vazio
         (SELECT coalesce(jsonb_agg(x.c), '[]'::jsonb) FROM (VALUES
            (CASE WHEN NOT private.cns_valido(b.pcns) AND NOT private.cpf_valido(b.pcpf) THEN jsonb_build_object('codigo', 'documento',
               'texto', 'Paciente sem CNS nem CPF válido: o SIA recusa procedimento que exige CPF/CNS.') END),
            (CASE WHEN NOT b.prua AND (b.pcep IS NULL OR b.pibge IS NULL OR b.plog IS NULL OR b.pend IS NULL OR b.pnum IS NULL OR b.pbairro IS NULL)
               THEN jsonb_build_object('codigo', 'endereco', 'texto', 'Endereço incompleto (CEP, município IBGE, tipo de logradouro, endereço, número ou bairro).') END),
            (CASE WHEN b.pibge IS NULL AND b.prua THEN jsonb_build_object('codigo', 'endereco',
               'texto', 'Pessoa em situação de rua sem município IBGE.') END),
            (CASE WHEN b.pnac IS NULL THEN jsonb_build_object('codigo', 'nacionalidade', 'texto', 'Nacionalidade ausente.') END)
          ) AS x(c) WHERE x.c IS NOT NULL)
    FROM base b
$$;
REVOKE ALL ON FUNCTION private.bpa_i_linhas(uuid, text) FROM PUBLIC, anon, authenticated;

-- Problemas do arquivo inteiro: 'bloqueio' impede fechar; 'aviso' só avisa.
CREATE OR REPLACE FUNCTION private.bpa_globais(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades; c public.bpa_config_unidade;
  v_atual text := private.competencia_de(now());
  v_sigtap text := private.sigtap_competencia();
  r jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  IF u.cnes IS NULL OR u.cnes !~ '^[0-9]{7}$' THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'cnes', 'texto', 'CNES da unidade ausente ou fora do formato (7 dígitos).');
  END IF;
  IF c.orgao_origem IS NULL OR c.sigla IS NULL OR c.cnpj IS NULL OR c.orgao_destino IS NULL OR c.destino IS NULL THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'cabecalho',
      'texto', 'Cabeçalho incompleto: órgão de origem, sigla, CNPJ/CPF, órgão de destino e se é municipal ou estadual.');
  END IF;
  IF p_competencia > v_atual THEN
    r := r || jsonb_build_object('tipo', 'bloqueio', 'codigo', 'futura', 'texto', 'Competência no futuro.');
  ELSIF p_competencia = v_atual THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'em_curso', 'texto', 'Competência ainda em curso: o que for feito depois do fechamento fica para a reabertura.');
  END IF;
  IF p_competencia < to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '3 months', 'YYYYMM') THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'prazo',
      'texto', 'Fora da janela de processamento (competência atual e 3 anteriores, Portaria SAES 1.110/2021): o SIA não processa.');
  END IF;
  IF c.carater_atendimento IS NULL THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'carater', 'texto', 'Caráter do atendimento não configurado: o campo sai em branco.');
  END IF;
  IF c.ine IS NULL THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'ine',
      'texto', 'INE em branco: o leiaute marca como obrigatório; confirme com o gestor se a unidade tem equipe cadastrada.');
  END IF;
  IF v_sigtap IS NULL THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'sigtap_desatualizado', 'texto', 'Tabela SIGTAP não carregada.');
  ELSIF v_sigtap < to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM') THEN
    r := r || jsonb_build_object('tipo', 'aviso', 'codigo', 'sigtap_desatualizado',
      'texto', 'Tabela SIGTAP carregada é da competência ' || substr(v_sigtap, 5, 2) || '/' || left(v_sigtap, 4) || ': atualize a tabela.');
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.bpa_globais(uuid, text) FROM PUBLIC, anon, authenticated;

-- Arquivo do BPA Magnético: cabeçalho + linhas sem crítica, em folhas de 20
-- linhas por profissional (CNS), trocando de folha quando muda o CBO.
CREATE OR REPLACE FUNCTION private.bpa_i_arquivo(p_unidade uuid, p_competencia text, p_processamento text,
  OUT arquivo text, OUT linhas integer, OUT folhas integer, OUT controle integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades; c public.bpa_config_unidade;
  l record; v_corpo text := ''; v_soma numeric := 0;
  v_prof text; v_cbo text; v_folha integer := 0; v_seq integer := 0;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  SELECT * INTO c FROM public.bpa_config_unidade WHERE unidade_id = p_unidade;
  linhas := 0; folhas := 0;
  FOR l IN SELECT * FROM private.bpa_i_linhas(p_unidade, p_competencia) x
            WHERE jsonb_array_length(x.criticas) = 0
            ORDER BY x.prof_cns, x.prof_cbo, x.em, x.paciente, x.origem_id LOOP
    IF l.prof_cns IS DISTINCT FROM v_prof THEN
      v_prof := l.prof_cns; v_cbo := l.prof_cbo; v_folha := 1; v_seq := 0; folhas := folhas + 1;
    ELSIF l.prof_cbo IS DISTINCT FROM v_cbo OR v_seq = 20 THEN
      v_cbo := l.prof_cbo; v_folha := v_folha + 1; v_seq := 0; folhas := folhas + 1;
    END IF;
    IF v_folha > 999 THEN RAISE EXCEPTION 'BPA: mais de 999 folhas para um profissional na competência.'; END IF;
    v_seq := v_seq + 1;
    linhas := linhas + 1;
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
      || private.bpa_num(NULL, 3) || private.bpa_num(NULL, 3)        -- serviço, classificação
      || private.bpa_num(NULL, 8) || private.bpa_num(NULL, 4)        -- equipe: sequência, área
      || private.bpa_num(NULL, 14)                                    -- CNPJ de OPM
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
REVOKE ALL ON FUNCTION private.bpa_i_arquivo(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── conferência e fechamento ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.exigir_faturamento(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.e_faturamento(p_unidade) THEN
    RAISE EXCEPTION 'BPA da unidade: faturamento ou gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.exigir_faturamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.exigir_faturamento(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.conferir_competencia_texto(p text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR p !~ '^[0-9]{4}(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
END $$;

-- Resumo da competência; lista só as linhas com crítica ou aviso (até 500).
CREATE OR REPLACE FUNCTION public.bpa_conferencia(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; f public.bpa_fechamentos;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  SELECT * INTO f FROM public.bpa_fechamentos
   WHERE unidade_id = p_unidade AND competencia = p_competencia ORDER BY fechado_em DESC LIMIT 1;
  WITH l AS (SELECT * FROM private.bpa_i_linhas(p_unidade, p_competencia))
  SELECT jsonb_build_object(
    'competencia', p_competencia,
    'globais', private.bpa_globais(p_unidade, p_competencia),
    'total', (SELECT count(*) FROM l),
    'prontas', (SELECT count(*) FROM l WHERE jsonb_array_length(l.criticas) = 0),
    'com_critica', (SELECT count(*) FROM l WHERE jsonb_array_length(l.criticas) > 0),
    'com_aviso', (SELECT count(*) FROM l WHERE jsonb_array_length(l.criticas) = 0 AND jsonb_array_length(l.avisos) > 0),
    'por_origem', (SELECT coalesce(jsonb_object_agg(o.origem, o.n), '{}'::jsonb)
                     FROM (SELECT l.origem, count(*) AS n FROM l GROUP BY l.origem) o),
    'por_critica', (SELECT coalesce(jsonb_object_agg(k.codigo, k.n), '{}'::jsonb)
                      FROM (SELECT x->>'codigo' AS codigo, count(*) AS n FROM l, jsonb_array_elements(l.criticas || l.avisos) x GROUP BY 1) k),
    'linhas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'origem', p.origem, 'origem_id', p.origem_id, 'paciente_id', p.paciente_id, 'episodio_id', p.episodio_id,
                 'paciente', p.paciente, 'profissional', p.profissional, 'em', p.em,
                 'procedimento', p.procedimento, 'quantidade', p.quantidade,
                 'criticas', p.criticas, 'avisos', p.avisos) ORDER BY jsonb_array_length(p.criticas) DESC, p.em), '[]'::jsonb)
                 FROM (SELECT * FROM l WHERE jsonb_array_length(l.criticas) > 0 OR jsonb_array_length(l.avisos) > 0
                        ORDER BY jsonb_array_length(l.criticas) DESC, l.em LIMIT 500) p),
    'fechamento', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
                    'id', f.id, 'situacao', f.situacao, 'processamento', f.processamento,
                    'linhas', f.linhas, 'folhas', f.folhas, 'controle', f.controle,
                    'fechado_por', (SELECT nome_completo FROM public.perfis WHERE id = f.fechado_por), 'fechado_em', f.fechado_em,
                    'reaberto_por', (SELECT nome_completo FROM public.perfis WHERE id = f.reaberto_por), 'reaberto_em', f.reaberto_em,
                    'motivo_reabertura', f.motivo_reabertura) END)
  INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.bpa_conferencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bpa_conferencia(uuid, text) TO authenticated;

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
  SELECT * INTO a FROM private.bpa_i_arquivo(p_unidade, p_competencia, v_proc);
  IF a.linhas = 0 THEN RAISE EXCEPTION 'Nenhuma linha sem crítica nesta competência.'; END IF;
  INSERT INTO public.bpa_fechamentos (unidade_id, competencia, processamento, linhas, folhas, controle, arquivo,
                                      excluidas, avisos, sigtap_competencia, fechado_por)
  VALUES (p_unidade, p_competencia, v_proc, a.linhas, a.folhas, a.controle, a.arquivo,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('origem', l.origem, 'origem_id', l.origem_id, 'paciente', l.paciente,
                    'em', l.em, 'procedimento', l.procedimento, 'criticas', l.criticas)), '[]'::jsonb)
             FROM private.bpa_i_linhas(p_unidade, p_competencia) l WHERE jsonb_array_length(l.criticas) > 0),
          (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM jsonb_array_elements(v_glob) g WHERE g->>'tipo' = 'aviso'),
          private.sigtap_competencia(), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('bpa_competencia_fechada', 'bpa_fechamentos', v_id, p_unidade,
    jsonb_build_object('competencia', p_competencia, 'processamento', v_proc, 'linhas', a.linhas));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fechar_competencia_bpa(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_competencia_bpa(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reabrir_competencia_bpa(p_fechamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.bpa_fechamentos;
BEGIN
  SELECT * INTO f FROM public.bpa_fechamentos WHERE id = p_fechamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fechamento não encontrado.'; END IF;
  PERFORM private.exigir_faturamento(f.unidade_id);
  IF f.situacao <> 'fechada' THEN RAISE EXCEPTION 'Esta competência já foi reaberta.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.bpa_fechamentos
     SET situacao = 'reaberta', reaberto_por = private.meu_perfil_id(), reaberto_em = now(), motivo_reabertura = btrim(p_motivo)
   WHERE id = f.id;
  PERFORM private.registrar_auditoria('bpa_competencia_reaberta', 'bpa_fechamentos', f.id, f.unidade_id,
    jsonb_build_object('competencia', f.competencia));
END $$;
REVOKE ALL ON FUNCTION public.reabrir_competencia_bpa(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_competencia_bpa(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bpa_fechamentos_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'competencia', f.competencia, 'processamento', f.processamento, 'situacao', f.situacao,
      'linhas', f.linhas, 'folhas', f.folhas, 'controle', f.controle, 'excluidas', jsonb_array_length(f.excluidas),
      'fechado_por', pf.nome_completo, 'fechado_em', f.fechado_em,
      'reaberto_por', pr.nome_completo, 'reaberto_em', f.reaberto_em, 'motivo_reabertura', f.motivo_reabertura)
      ORDER BY f.competencia DESC, f.fechado_em DESC)
    FROM public.bpa_fechamentos f
    LEFT JOIN public.perfis pf ON pf.id = f.fechado_por
    LEFT JOIN public.perfis pr ON pr.id = f.reaberto_por
   WHERE f.unidade_id = p_unidade), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.bpa_fechamentos_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bpa_fechamentos_da_unidade(uuid) TO authenticated;

-- Baixar o arquivo congelado (o download fica na auditoria).
CREATE OR REPLACE FUNCTION public.arquivo_bpa(p_fechamento uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.bpa_fechamentos; v_cnes text;
BEGIN
  SELECT * INTO f FROM public.bpa_fechamentos WHERE id = p_fechamento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fechamento não encontrado.'; END IF;
  PERFORM private.exigir_faturamento(f.unidade_id);
  SELECT cnes INTO v_cnes FROM public.unidades WHERE id = f.unidade_id;
  PERFORM private.registrar_auditoria('bpa_arquivo_baixado', 'bpa_fechamentos', f.id, f.unidade_id,
    jsonb_build_object('competencia', f.competencia));
  RETURN jsonb_build_object('nome', 'BPA_' || coalesce(v_cnes, 'SEMCNES') || '_' || f.competencia || '.txt',
                            'conteudo', f.arquivo, 'situacao', f.situacao, 'excluidas', f.excluidas, 'avisos', f.avisos);
END $$;
REVOKE ALL ON FUNCTION public.arquivo_bpa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arquivo_bpa(uuid) TO authenticated;

-- ── configuração da unidade ─────────────────────────────────────────────────
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
        'definido_por', pf.nome_completo, 'definido_em', b.definido_em) ORDER BY b.uso, b.procedimento)
      FROM public.bpa_procedimentos_unidade b
      LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = b.procedimento
      LEFT JOIN public.perfis pf ON pf.id = b.definido_por
     WHERE b.unidade_id = p_unidade AND b.vigente_ate IS NULL), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.bpa_config(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bpa_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_bpa_config(p_unidade uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cnpj text := private.so_digitos(p_dados->>'cnpj');
  v_destino text := nullif(upper(btrim(p_dados->>'destino')), '');
  v_carater text := private.so_digitos(p_dados->>'carater_atendimento');
  v_ine text := private.so_digitos(p_dados->>'ine');
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  IF v_cnpj IS NOT NULL AND NOT (private.cpf_valido(v_cnpj) OR length(v_cnpj) = 14) THEN
    RAISE EXCEPTION 'CNPJ com 14 dígitos ou CPF válido.';
  END IF;
  IF v_destino IS NOT NULL AND v_destino NOT IN ('M', 'E') THEN RAISE EXCEPTION 'Destino: M (municipal) ou E (estadual).'; END IF;
  IF v_carater IS NOT NULL AND length(v_carater) <> 2 THEN RAISE EXCEPTION 'Caráter do atendimento: código de 2 dígitos.'; END IF;
  IF v_ine IS NOT NULL AND length(v_ine) <> 10 THEN RAISE EXCEPTION 'INE: 10 dígitos.'; END IF;
  INSERT INTO public.bpa_config_unidade AS c (unidade_id, orgao_origem, sigla, cnpj, orgao_destino, destino,
                                              carater_atendimento, ine, atualizado_por, atualizado_em)
  VALUES (p_unidade, nullif(btrim(p_dados->>'orgao_origem'), ''), nullif(upper(btrim(p_dados->>'sigla')), ''), v_cnpj,
          nullif(btrim(p_dados->>'orgao_destino'), ''), v_destino, v_carater, v_ine, private.meu_perfil_id(), now())
  ON CONFLICT (unidade_id) DO UPDATE SET
    orgao_origem = EXCLUDED.orgao_origem, sigla = EXCLUDED.sigla, cnpj = EXCLUDED.cnpj,
    orgao_destino = EXCLUDED.orgao_destino, destino = EXCLUDED.destino,
    carater_atendimento = EXCLUDED.carater_atendimento, ine = EXCLUDED.ine,
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = EXCLUDED.atualizado_em;
  PERFORM private.registrar_auditoria('bpa_config_alterada', 'bpa_config_unidade', NULL, p_unidade, p_dados);
END $$;
REVOKE ALL ON FUNCTION public.definir_bpa_config(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_bpa_config(uuid, jsonb) TO authenticated;

-- Associa um código SIGTAP: numa fonte automática troca o vigente; na lista,
-- acrescenta.
CREATE OR REPLACE FUNCTION public.associar_procedimento_bpa(p_unidade uuid, p_procedimento text, p_uso text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := private.so_digitos(p_procedimento); v_id uuid;
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  IF p_uso NOT IN ('atendimento_medico', 'classificacao', 'medicacao', 'lista') THEN RAISE EXCEPTION 'Uso desconhecido.'; END IF;
  IF v IS NULL OR length(v) <> 10 THEN RAISE EXCEPTION 'Código SIGTAP com 10 dígitos.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v) THEN
    RAISE EXCEPTION 'Procedimento % não existe no SIGTAP carregado.', v;
  END IF;
  IF p_uso = 'lista' THEN
    IF EXISTS (SELECT 1 FROM public.bpa_procedimentos_unidade
                WHERE unidade_id = p_unidade AND uso = 'lista' AND procedimento = v AND vigente_ate IS NULL) THEN
      RAISE EXCEPTION 'Este procedimento já está na lista da unidade.';
    END IF;
  ELSE
    UPDATE public.bpa_procedimentos_unidade SET vigente_ate = now(), encerrado_por = private.meu_perfil_id()
     WHERE unidade_id = p_unidade AND uso = p_uso AND vigente_ate IS NULL;
  END IF;
  INSERT INTO public.bpa_procedimentos_unidade (unidade_id, procedimento, uso, definido_por)
  VALUES (p_unidade, v, p_uso, private.meu_perfil_id()) RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('bpa_procedimento_associado', 'bpa_procedimentos_unidade', v_id, p_unidade,
    jsonb_build_object('procedimento', v, 'uso', p_uso));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.associar_procedimento_bpa(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.associar_procedimento_bpa(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_procedimento_bpa(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.bpa_procedimentos_unidade;
BEGIN
  SELECT * INTO b FROM public.bpa_procedimentos_unidade WHERE id = p_id AND vigente_ate IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Associação não encontrada.'; END IF;
  PERFORM private.exigir_faturamento(b.unidade_id);
  UPDATE public.bpa_procedimentos_unidade SET vigente_ate = now(), encerrado_por = private.meu_perfil_id() WHERE id = p_id;
  PERFORM private.registrar_auditoria('bpa_procedimento_retirado', 'bpa_procedimentos_unidade', p_id, b.unidade_id,
    jsonb_build_object('procedimento', b.procedimento, 'uso', b.uso));
END $$;
REVOKE ALL ON FUNCTION public.retirar_procedimento_bpa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_procedimento_bpa(uuid) TO authenticated;

-- busca no SIGTAP carregado (código ou nome), para associar
CREATE OR REPLACE FUNCTION public.buscar_sigtap(p_termo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome)), '[]'::jsonb) FROM (
    SELECT sp.codigo, sp.nome FROM terminologia.sigtap_procedimento sp
     WHERE private.meu_perfil_id() IS NOT NULL AND length(btrim(coalesce(p_termo, ''))) >= 3
       AND ((private.so_digitos(p_termo) IS NOT NULL AND sp.codigo LIKE private.so_digitos(p_termo) || '%')
            OR upper(terminologia.unaccent_text(sp.nome)) LIKE '%' || upper(terminologia.unaccent_text(btrim(p_termo))) || '%')
     ORDER BY sp.codigo LIMIT 20) x
$$;
REVOKE ALL ON FUNCTION public.buscar_sigtap(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_sigtap(text) TO authenticated;

-- ── procedimentos realizados ────────────────────────────────────────────────
-- Lista da unidade para quem registra (qualquer vínculo ativo).
CREATE OR REPLACE FUNCTION public.procedimentos_registraveis(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo)
          OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('procedimento', b.procedimento, 'nome', sp.nome) ORDER BY sp.nome)
    FROM public.bpa_procedimentos_unidade b
    JOIN terminologia.sigtap_procedimento sp ON sp.codigo = b.procedimento
   WHERE b.unidade_id = p_unidade AND b.uso = 'lista' AND b.vigente_ate IS NULL), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.procedimentos_registraveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procedimentos_registraveis(uuid) TO authenticated;

-- Quem fez registra (p_profissional vazio). O faturamento lança em nome de
-- quem fez (p_profissional = o executante, com vínculo ativo na unidade).
CREATE OR REPLACE FUNCTION public.registrar_procedimento(
  p_paciente uuid, p_procedimento text, p_quantidade integer DEFAULT 1, p_episodio uuid DEFAULT NULL,
  p_realizado_em timestamptz DEFAULT NULL, p_profissional uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_unidade uuid; v_prof uuid := coalesce(p_profissional, private.meu_perfil_id());
  v_via text; v_em timestamptz := coalesce(p_realizado_em, now());
  v text := private.so_digitos(p_procedimento); v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF v_prof = v_eu THEN
    v_via := 'quem_fez';
    IF NOT private.pode_atuar_no_paciente(p_paciente) THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    v_via := 'faturamento';
    IF NOT private.e_faturamento(v_unidade) THEN
      RAISE EXCEPTION 'Só o faturamento lança procedimento em nome de outro profissional.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = v_prof AND unidade_id = v_unidade AND ativo) THEN
      RAISE EXCEPTION 'O profissional não tem vínculo ativo na unidade.';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bpa_procedimentos_unidade
                  WHERE unidade_id = v_unidade AND uso = 'lista' AND procedimento = v AND vigente_ate IS NULL) THEN
    RAISE EXCEPTION 'Procedimento fora da lista da unidade.';
  END IF;
  IF coalesce(p_quantidade, 0) < 1 OR p_quantidade > 999999 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  IF v_em > now() + interval '5 minutes' THEN RAISE EXCEPTION 'Data do procedimento no futuro.'; END IF;
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'O atendimento não é deste paciente.';
  END IF;
  IF private.competencia_fechada(v_unidade, private.competencia_de(v_em)) THEN
    RAISE EXCEPTION 'A competência % já foi fechada pelo faturamento; peça a reabertura.', private.competencia_de(v_em);
  END IF;
  INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
                                               profissional_id, cbo, via, registrado_por)
  VALUES (v_unidade, p_paciente, p_episodio, v, p_quantidade, v_em, v_prof,
          (SELECT cbo FROM public.perfis WHERE id = v_prof), v_via, v_eu)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('procedimento_registrado', 'procedimentos_realizados', v_id, v_unidade,
    jsonb_build_object('procedimento', v, 'via', v_via));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_procedimento(uuid, text, integer, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_procedimento(uuid, text, integer, uuid, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_procedimento_realizado(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.procedimentos_realizados;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.procedimentos_realizados WHERE id = p_id AND cancelado_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  IF NOT (r.registrado_por = private.meu_perfil_id() OR private.e_faturamento(r.unidade_id)) THEN
    RAISE EXCEPTION 'Cancela quem registrou ou o faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  IF private.competencia_fechada(r.unidade_id, private.competencia_de(r.realizado_em)) THEN
    RAISE EXCEPTION 'A competência % já foi fechada pelo faturamento; peça a reabertura.', private.competencia_de(r.realizado_em);
  END IF;
  UPDATE public.procedimentos_realizados
     SET cancelado_em = now(), cancelado_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('procedimento_cancelado', 'procedimentos_realizados', p_id, r.unidade_id,
    jsonb_build_object('procedimento', r.procedimento));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_procedimento_realizado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_procedimento_realizado(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.procedimentos_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.pode_atuar_no_paciente(p_paciente) OR private.e_faturamento(v_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'procedimento', r.procedimento, 'nome', sp.nome, 'quantidade', r.quantidade,
      'realizado_em', r.realizado_em, 'episodio_id', r.episodio_id, 'via', r.via,
      'profissional', pf.nome_completo, 'registrado_por', pr.nome_completo,
      'meu', r.registrado_por = private.meu_perfil_id(),
      'cancelado_em', r.cancelado_em, 'motivo_cancelamento', r.motivo_cancelamento,
      'fechada', private.competencia_fechada(r.unidade_id, private.competencia_de(r.realizado_em)))
      ORDER BY r.realizado_em DESC)
    FROM public.procedimentos_realizados r
    LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = r.procedimento
    LEFT JOIN public.perfis pf ON pf.id = r.profissional_id
    LEFT JOIN public.perfis pr ON pr.id = r.registrado_por
   WHERE r.paciente_id = p_paciente), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.procedimentos_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procedimentos_do_paciente(uuid) TO authenticated;

-- Para o faturamento lançar a partir do prontuário: atendimentos da
-- competência (busca por nome) e os profissionais da unidade.
CREATE OR REPLACE FUNCTION public.atendimentos_para_faturar(p_unidade uuid, p_competencia text, p_busca text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  PERFORM private.conferir_competencia_texto(p_competencia);
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'chegada_em' DESC) FROM (
    SELECT jsonb_build_object('episodio_id', e.id, 'paciente_id', e.paciente_id, 'paciente', coalesce(pa.nome_social, pa.nome),
             'chegada_em', e.chegada_em, 'medico', pf.nome_completo, 'medico_id', e.atendimento_medico_id) AS x
      FROM public.episodios e
      JOIN public.pacientes pa ON pa.id = e.paciente_id
      LEFT JOIN public.perfis pf ON pf.id = e.atendimento_medico_id,
      private.competencia_limites(p_competencia) lim
     WHERE e.unidade_id = p_unidade AND e.chegada_em >= lim.ini AND e.chegada_em < lim.fim
       AND (nullif(btrim(p_busca), '') IS NULL
            OR upper(terminologia.unaccent_text(coalesce(pa.nome_social, '') || ' ' || pa.nome))
               LIKE '%' || upper(terminologia.unaccent_text(btrim(p_busca))) || '%')
     ORDER BY e.chegada_em DESC LIMIT 100) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.atendimentos_para_faturar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atendimentos_para_faturar(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.profissionais_para_faturar(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_faturamento(p_unidade);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome_completo, 'cbo', x.cbo,
                                                       'cns_ok', private.cns_valido(x.cns), 'papeis', x.papeis) ORDER BY x.nome_completo)
    FROM (SELECT pf.id, pf.nome_completo, pf.cbo, pf.cns, array_agg(DISTINCT v.papel::text) AS papeis
            FROM public.vinculos v JOIN public.perfis pf ON pf.id = v.perfil_id
           WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel::text NOT IN ('admin', 'faturamento', 'recepcao')
           GROUP BY pf.id) x), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.profissionais_para_faturar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profissionais_para_faturar(uuid) TO authenticated;

-- ── perfil e cadastro ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.definir_meu_cns(p_cns text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text := private.so_digitos(p_cns);
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v IS NOT NULL AND NOT private.cns_valido(v) THEN
    RAISE EXCEPTION 'Cartão SUS inválido: são 15 dígitos e o número não confere.';
  END IF;
  UPDATE public.perfis SET cns = v WHERE id = private.meu_perfil_id();
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.definir_meu_cns(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meu_cns(text) TO authenticated;

-- Endereço e dados do SUS do paciente, fora da ficha (não trava a porta).
-- Pode quem atua no paciente e o faturamento. Chave ausente não mexe; chave
-- com valor vazio apaga.
CREATE OR REPLACE FUNCTION public.salvar_endereco_sus(p_paciente uuid, p_dados jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_ibge text := private.so_digitos(d->>'municipio_ibge');
  v_cep text := private.so_digitos(d->>'cep');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente AND ativo FOR UPDATE;
  IF NOT FOUND OR NOT (private.pode_atuar_no_paciente(p_paciente) OR private.e_faturamento(pa.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- o código IBGE de 7 dígitos traz o verificador no fim; o BPA usa os 6 primeiros
  IF v_ibge IS NOT NULL AND length(v_ibge) = 7 THEN v_ibge := left(v_ibge, 6); END IF;
  IF v_ibge IS NOT NULL AND length(v_ibge) <> 6 THEN RAISE EXCEPTION 'Município: código IBGE com 6 ou 7 dígitos.'; END IF;
  IF v_cep IS NOT NULL AND length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP com 8 dígitos.'; END IF;
  UPDATE public.pacientes SET
    cep             = CASE WHEN d ? 'cep' THEN v_cep ELSE cep END,
    municipio_ibge  = CASE WHEN d ? 'municipio_ibge' THEN v_ibge ELSE municipio_ibge END,
    tipo_logradouro = CASE WHEN d ? 'tipo_logradouro' THEN private.so_digitos(d->>'tipo_logradouro') ELSE tipo_logradouro END,
    endereco        = CASE WHEN d ? 'endereco' THEN nullif(btrim(d->>'endereco'), '') ELSE endereco END,
    numero_endereco = CASE WHEN d ? 'numero_endereco' THEN nullif(upper(btrim(d->>'numero_endereco')), '') ELSE numero_endereco END,
    complemento     = CASE WHEN d ? 'complemento' THEN nullif(btrim(d->>'complemento'), '') ELSE complemento END,
    bairro          = CASE WHEN d ? 'bairro' THEN nullif(btrim(d->>'bairro'), '') ELSE bairro END,
    nacionalidade   = CASE WHEN d ? 'nacionalidade' THEN private.so_digitos(d->>'nacionalidade') ELSE nacionalidade END,
    etnia           = CASE WHEN d ? 'etnia' THEN private.so_digitos(d->>'etnia') ELSE etnia END,
    situacao_rua    = CASE WHEN d ? 'situacao_rua' THEN coalesce((d->>'situacao_rua')::boolean, false) ELSE situacao_rua END,
    sem_documento   = CASE WHEN d ? 'sem_documento' THEN coalesce((d->>'sem_documento')::boolean, false) ELSE sem_documento END,
    updated_at      = now()
  WHERE id = p_paciente;
  PERFORM private.registrar_auditoria('endereco_sus_salvo', 'pacientes', p_paciente, pa.unidade_id,
    jsonb_build_object('campos', (SELECT jsonb_agg(k) FROM jsonb_object_keys(d) k)));
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'Confira os campos: CEP 8 dígitos, tipo de logradouro 3, nacionalidade 3, etnia 4, número até 5 letras, complemento até 10, bairro até 30.';
END $$;
REVOKE ALL ON FUNCTION public.salvar_endereco_sus(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_endereco_sus(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.endereco_sus(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND OR NOT (private.pode_atuar_no_paciente(p_paciente) OR private.e_faturamento(pa.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object('cep', pa.cep, 'municipio_ibge', pa.municipio_ibge, 'municipio', pa.municipio, 'uf', pa.uf,
    'tipo_logradouro', pa.tipo_logradouro, 'endereco', pa.endereco, 'numero_endereco', pa.numero_endereco,
    'complemento', pa.complemento, 'bairro', pa.bairro, 'nacionalidade', pa.nacionalidade, 'etnia', pa.etnia,
    'raca_cor', pa.raca_cor, 'situacao_rua', pa.situacao_rua, 'sem_documento', pa.sem_documento);
END $$;
REVOKE ALL ON FUNCTION public.endereco_sus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.endereco_sus(uuid) TO authenticated;
