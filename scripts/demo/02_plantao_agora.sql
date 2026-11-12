-- ════════════════════════════════════════════════════════════════════════════
-- Unidade de demonstração (pedido 8, J4) — 2/4: o plantão de agora.
--
-- SÓ NA HOMOLOGAÇÃO (mesma trava do 01). Rode depois do 01 e de novo antes de
-- cada captura ou apresentação: ele traz o plantão para o dia e a hora de agora.
--
-- Numa transação só (se um passo falhar, nada muda):
--   1. limpa os pacientes da UPA 24h Jardim Primavera e tudo o que aponta para
--      eles (episódios, triagens, internações, pendências, exames, acessos...),
--      seguindo as chaves estrangeiras do catálogo; os leitos voltam a livres.
--      Escala, vínculos, setores, leitos, check-ins e a auditoria ficam;
--   2. check-in dos plantões da equipe fictícia que já começaram (até 24 h
--      atrás), como scripts/e2e/03_checkin_agora.sql;
--   3. o plantão em curso, chamando as FUNÇÕES do banco como cada pessoa de
--      plantão AGORA no Pronto Socorro, com RLS (claims do JWT + role
--      authenticated, como scripts/e2e/04_framework_e2e.sql):
--        recepção    public.registrar_ficha
--        enfermagem  public.classificar_risco (a cor é a da enfermagem)
--        médico      public.iniciar_atendimento, public.registrar_soap,
--                    public.pedir_exames_atendimento, public.aguardar_reavaliacao,
--                    public.registrar_desfecho (observação, internação na Sala
--                    Vermelha e alta)
--      17 pacientes no plantão (13 adultos, 4 crianças) e 4 altas de mais cedo:
--        porta: 2 aguardando triagem, 5 aguardando médico, 1 em atendimento,
--               1 em reavaliação (exames pedidos);
--        Observação Adulto 4 de 6 leitos, Observação Pediátrica 2 de 3,
--        Sala Vermelha 2 de 2 (ocupação 8 de 11 leitos, 73%);
--   4. ajuste dos horários como postgres (passo "ajuste" dos e2e): as funções
--      gravam tudo em now(); aqui chegada, triagem, início, registro e
--      desfecho voltam para tempos plausíveis de espera.
--
-- Sem prescrição: prescrever exige dose, via e frequência escritas, e este
-- roteiro não inventa dose. Por isso o indicador "medicação pendente" fica em 0
-- e não há paciente "em medicação".
-- Nomes, sinais vitais, queixas e hipóteses são fictícios (não são referência
-- clínica). Os CIDs são os que os roteiros e2e já validaram na CID-10 da
-- homologação.
--
-- Os passos 1 e 4 usam SET LOCAL session_replication_role = replica, como
-- scripts/e2e/99_limpar_rede_e2e.sql: as tabelas clínicas são só de inserção
-- (gatilho private.so_insercao) e não se apagam nem se reescrevem de outro jeito.
-- Não usa o esquema e2e nem os utilitários do framework e2e.
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/02_plantao_agora.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── trava ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = 'd0100000-0000-4000-8000-000000000001'
                   AND organizacao_id = 'd0000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'A UPA 24h Jardim Primavera não existe: rode antes scripts/demo/01_rede_demonstracao.sql.';
  END IF;
END $$;

-- ── 1. limpeza dos pacientes da unidade de demonstração ─────────────────────
SET LOCAL session_replication_role = replica;

-- linhas a apagar (tabela + ctid). Com os gatilhos desligados, as chaves
-- estrangeiras também não agem: a função segue o catálogo (pg_constraint) e
-- marca, de pai para filho, toda linha que aponta para uma linha marcada.
-- Tabela preservada não perde a linha: a coluna que aponta vira NULL.
CREATE TEMP TABLE demo_marca (rel oid NOT NULL, linha tid NOT NULL, PRIMARY KEY (rel, linha)) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.demo_apagar_marcados(p_preservar regclass[], p_esquemas text[]) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE
  fk record; r record; n bigint; v_novas bigint; v_total bigint := 0;
BEGIN
  LOOP
    v_novas := 0;
    FOR fk IN
      SELECT c.conrelid::regclass AS filho, c.confrelid::regclass AS pai, c.confrelid AS pai_oid,
             (SELECT string_agg(format('f.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS cols_f,
             (SELECT string_agg(format('%I = NULL', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS anular,
             (SELECT string_agg(format('p.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.confkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num) AS cols_p
        FROM pg_constraint c
        JOIN pg_class cf ON cf.oid = c.conrelid
        JOIN pg_namespace nf ON nf.oid = cf.relnamespace
       WHERE c.contype = 'f' AND cf.relkind = 'r' AND nf.nspname = ANY (p_esquemas)
         AND c.confrelid IN (SELECT DISTINCT m.rel FROM demo_marca m)
    LOOP
      IF fk.filho = ANY (p_preservar) THEN
        EXECUTE format('UPDATE %s f SET %s WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1))',
                       fk.filho, fk.anular, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
      ELSE
        EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, f.ctid FROM %s f WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1)) ON CONFLICT DO NOTHING',
                       fk.filho::oid, fk.filho, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
        GET DIAGNOSTICS n = ROW_COUNT;
        v_novas := v_novas + n;
      END IF;
    END LOOP;
    EXIT WHEN v_novas = 0;
  END LOOP;
  FOR r IN SELECT m.rel, array_agg(m.linha) AS linhas FROM demo_marca m GROUP BY m.rel LOOP
    EXECUTE format('DELETE FROM %s WHERE ctid = ANY ($1)', r.rel::regclass) USING r.linhas;
    GET DIAGNOSTICS n = ROW_COUNT;
    v_total := v_total + n;
  END LOOP;
  RETURN v_total;
END $f$;

DO $$
DECLARE
  v_unidade constant uuid := 'd0100000-0000-4000-8000-000000000001';
  v_preservar regclass[] := ARRAY['public.organizacoes', 'public.unidades', 'public.setores', 'public.leitos', 'public.perfis',
                                  'public.vinculos', 'public.escala_plantao', 'public.presenca_plantonista',
                                  'public.escala_publicacoes', 'public.historico_escala', 'public.log_auditoria']::regclass[];
  v_pac uuid[];
  v_ep uuid[];
  v_int uuid[];
  t record;
  v_ids uuid[];
  v_apagadas bigint;
BEGIN
  v_pac := ARRAY(SELECT id FROM public.pacientes WHERE unidade_id = v_unidade);
  v_ep  := ARRAY(SELECT id FROM public.episodios WHERE unidade_id = v_unidade OR paciente_id = ANY (v_pac));
  v_int := ARRAY(SELECT id FROM public.internacoes WHERE unidade_id = v_unidade OR paciente_id = ANY (v_pac));

  INSERT INTO demo_marca SELECT 'public.pacientes'::regclass::oid, ctid FROM public.pacientes WHERE id = ANY (v_pac);
  INSERT INTO demo_marca SELECT 'public.episodios'::regclass::oid, ctid FROM public.episodios WHERE id = ANY (v_ep) ON CONFLICT DO NOTHING;
  INSERT INTO demo_marca SELECT 'public.internacoes'::regclass::oid, ctid FROM public.internacoes WHERE id = ANY (v_int) ON CONFLICT DO NOTHING;
  -- e o que guarda paciente, episódio ou internação sem chave estrangeira
  FOR t IN SELECT c.table_schema, c.table_name, c.column_name
             FROM information_schema.columns c
             JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
                                              AND tb.table_type = 'BASE TABLE'
            WHERE c.table_schema IN ('public', 'private') AND c.data_type = 'uuid'
              AND c.column_name IN ('paciente_id', 'episodio_id', 'internacao_id') LOOP
    CONTINUE WHEN format('%I.%I', t.table_schema, t.table_name)::regclass = ANY (v_preservar);
    v_ids := CASE t.column_name WHEN 'paciente_id' THEN v_pac WHEN 'episodio_id' THEN v_ep ELSE v_int END;
    CONTINUE WHEN cardinality(v_ids) = 0;
    EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, ctid FROM %I.%I WHERE %I = ANY ($1) ON CONFLICT DO NOTHING',
                   format('%I.%I', t.table_schema, t.table_name)::regclass::oid, t.table_schema, t.table_name, t.column_name)
      USING v_ids;
  END LOOP;

  v_apagadas := pg_temp.demo_apagar_marcados(v_preservar, ARRAY['public', 'private']);

  -- leitos da unidade livres de novo (o gatilho de histórico está desligado)
  UPDATE public.leitos l SET status = 'livre', obito_aguardando_id = NULL
    FROM public.setores s
   WHERE s.id = l.setor_id AND s.unidade_id = v_unidade
     AND (l.status <> 'livre' OR l.obito_aguardando_id IS NOT NULL);

  RAISE NOTICE 'Limpeza: % paciente(s) e % linha(s) apagadas no total.', cardinality(v_pac), v_apagadas;
END $$;

SET LOCAL session_replication_role = origin;

-- ── 2. check-in dos plantões que já começaram ───────────────────────────────
-- chegou entre 0 e 7 min depois do início (dentro da tolerância de 30 min)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno,
       least(e.inicio + make_interval(mins => hashtext(e.id::text) & 7), now())
  FROM public.escala_plantao e
 WHERE e.ativo AND e.unidade_id = 'd0100000-0000-4000-8000-000000000001' AND e.perfil_id::text LIKE 'd0300000%'
   AND e.inicio <= now() AND e.inicio > now() - interval '24 hours'
ON CONFLICT DO NOTHING;

-- ── 3. o plantão em curso ───────────────────────────────────────────────────
-- destino: triagem | aguardando | atendimento | reavaliacao | observacao | sala_vermelha | alta
-- m_*: minutos antes de agora (chegada, classificação, início, registro, desfecho)
CREATE TEMP TABLE demo_pac (
  n int PRIMARY KEY, nome text, anos int, meses int, sexo text, resp_nome text, resp_parentesco text,
  queixa text, cor text, fluxograma text, publico text, vitais jsonb, destino text, hipotese text, cid text,
  m_chegada int, m_class int, m_inicio int, m_registro int, m_desfecho int,
  ep uuid, pac uuid
) ON COMMIT DROP;

INSERT INTO demo_pac (n, nome, anos, meses, sexo, resp_nome, resp_parentesco, queixa, cor, fluxograma, publico, vitais, destino, hipotese, cid,
                      m_chegada, m_class, m_inicio, m_registro, m_desfecho) VALUES
  -- porta: aguardando triagem
  (1,  'Sebastião Ribeiro Nunes',      67, 0, 'M', NULL, NULL, 'Tontura desde a manhã', NULL, NULL, 'adulto', NULL, 'triagem', NULL, NULL,
       9, NULL, NULL, NULL, NULL),
  (2,  'Helena Martins Costa',          5, 3, 'F', 'Carla Martins Costa', 'mãe', 'Febre desde ontem', NULL, NULL, 'pediatrico', NULL, 'triagem', NULL, NULL,
       4, NULL, NULL, NULL, NULL),
  -- porta: aguardando médico
  (3,  'Rosângela Pereira da Silva',   58, 0, 'F', NULL, NULL, 'Dor no peito em aperto há duas horas', 'laranja', 'Dor torácica', 'adulto',
       '{"frequencia-cardiaca":104,"frequencia-respiratoria":20,"temperatura":36.6,"saturacao-o2":96,"escala-dor":8,"pressao-arterial-sistolica":152,"pressao-arterial-diastolica":94}',
       'aguardando', NULL, NULL, 14, 6, NULL, NULL, NULL),
  (4,  'José Carlos Antunes',          45, 0, 'M', NULL, NULL, 'Dor na barriga há dois dias', 'amarelo', 'Dor abdominal', 'adulto',
       '{"frequencia-cardiaca":92,"frequencia-respiratoria":18,"temperatura":37.6,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":128,"pressao-arterial-diastolica":82}',
       'aguardando', NULL, NULL, 47, 38, NULL, NULL, NULL),
  (5,  'Luana Dantas Ferreira',        24, 0, 'F', NULL, NULL, 'Dor de garganta e febre', 'verde', 'Dor de garganta', 'adulto',
       '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":37.9,"saturacao-o2":99,"escala-dor":4,"pressao-arterial-sistolica":116,"pressao-arterial-diastolica":74}',
       'aguardando', NULL, NULL, 139, 128, NULL, NULL, NULL),
  (6,  'Pedro Henrique Alves',          8, 5, 'M', 'Marcelo Alves', 'pai', 'Tosse há três dias', 'verde', 'Alterações respiratórias', 'pediatrico',
       '{"frequencia-cardiaca":102,"frequencia-respiratoria":24,"temperatura":37.4,"saturacao-o2":97,"escala-dor":1}',
       'aguardando', NULL, NULL, 61, 51, NULL, NULL, NULL),
  (7,  'Cristiane Lopes Martins',      36, 0, 'F', NULL, NULL, 'Dor nas costas há um mês', 'azul', 'Dor na coluna', 'adulto',
       '{"frequencia-cardiaca":76,"frequencia-respiratoria":14,"temperatura":36.4,"saturacao-o2":99,"escala-dor":3,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76}',
       'aguardando', NULL, NULL, 118, 104, NULL, NULL, NULL),
  -- porta: em atendimento e em reavaliação
  (8,  'Antônio Marcos Pires',         52, 0, 'M', NULL, NULL, 'Dor de cabeça forte desde ontem', 'amarelo', 'Dor de cabeça', 'adulto',
       '{"frequencia-cardiaca":86,"frequencia-respiratoria":16,"temperatura":36.7,"saturacao-o2":98,"escala-dor":7,"pressao-arterial-sistolica":148,"pressao-arterial-diastolica":92}',
       'atendimento', NULL, NULL, 66, 57, 14, NULL, NULL),
  (9,  'Maria Aparecida Gonçalves',    71, 0, 'F', NULL, NULL, 'Ardor ao urinar e febre', 'amarelo', 'Queixas urinárias', 'adulto',
       '{"frequencia-cardiaca":98,"frequencia-respiratoria":18,"temperatura":38.2,"saturacao-o2":96,"escala-dor":4,"pressao-arterial-sistolica":132,"pressao-arterial-diastolica":78}',
       'reavaliacao', 'Hipótese: infecção urinária. Aguarda exames.', 'N39.0', 112, 101, 63, 55, NULL),
  -- Observação Adulto
  (10, 'Francisco das Chagas Moreira', 63, 0, 'M', NULL, NULL, 'Falta de ar desde a madrugada', 'laranja', 'Queixas respiratórias', 'adulto',
       '{"frequencia-cardiaca":112,"frequencia-respiratoria":26,"temperatura":37.8,"saturacao-o2":91,"escala-dor":3,"pressao-arterial-sistolica":138,"pressao-arterial-diastolica":84}',
       'observacao', 'Hipótese: dispneia a esclarecer.', 'R06.0', 245, 238, 228, 220, 212),
  (11, 'Valéria Cristina Rocha',       41, 0, 'F', NULL, NULL, 'Vômitos e diarreia desde ontem', 'amarelo', 'Diarreia e vômitos', 'adulto',
       '{"frequencia-cardiaca":102,"frequencia-respiratoria":18,"temperatura":37.5,"saturacao-o2":98,"escala-dor":5,"pressao-arterial-sistolica":104,"pressao-arterial-diastolica":66}',
       'observacao', 'Hipótese: gastroenterite aguda.', NULL, 190, 178, 150, 140, 133),
  (12, 'Osvaldo Bezerra Lima',         74, 0, 'M', NULL, NULL, 'Desmaio em casa', 'laranja', 'Desmaio, vertigem', 'adulto',
       '{"frequencia-cardiaca":58,"frequencia-respiratoria":16,"temperatura":36.3,"saturacao-o2":96,"escala-dor":2,"pressao-arterial-sistolica":96,"pressao-arterial-diastolica":58}',
       'observacao', 'Hipótese: síncope a esclarecer.', NULL, 330, 322, 314, 306, 298),
  (13, 'Eliane Barbosa Santos',        49, 0, 'F', NULL, NULL, 'Dor na barriga e vômitos', 'amarelo', 'Dor abdominal', 'adulto',
       '{"frequencia-cardiaca":94,"frequencia-respiratoria":18,"temperatura":37.2,"saturacao-o2":98,"escala-dor":7,"pressao-arterial-sistolica":124,"pressao-arterial-diastolica":80}',
       'observacao', 'Hipótese: dor abdominal a esclarecer.', 'R10.4', 120, 109, 92, 84, 77),
  -- Observação Pediátrica
  (14, 'Laura Beatriz Oliveira',        3, 2, 'F', 'Tatiane Oliveira', 'mãe', 'Chiado no peito', 'amarelo', 'Alterações respiratórias', 'pediatrico',
       '{"frequencia-cardiaca":132,"frequencia-respiratoria":38,"temperatura":37.3,"saturacao-o2":93,"escala-dor":2}',
       'observacao', 'Hipótese: broncoespasmo.', 'J45.9', 165, 156, 140, 131, 124),
  (15, 'Miguel Santos Pereira',         1, 6, 'M', 'Jaqueline Santos Pereira', 'mãe', 'Febre e vômitos', 'laranja', 'Alterações gastrointestinais', 'pediatrico',
       '{"frequencia-cardiaca":148,"frequencia-respiratoria":34,"temperatura":38.9,"saturacao-o2":97,"escala-dor":3}',
       'observacao', 'Hipótese: febre a esclarecer.', 'R50.9', 210, 204, 196, 188, 181),
  -- Sala Vermelha
  (16, 'Geraldo Ferreira Campos',      69, 0, 'M', NULL, NULL, 'Dor no peito há uma hora', 'vermelho', 'Dor torácica', 'adulto',
       '{"frequencia-cardiaca":118,"frequencia-respiratoria":26,"temperatura":36.5,"saturacao-o2":90,"escala-dor":9,"pressao-arterial-sistolica":88,"pressao-arterial-diastolica":54}',
       'sala_vermelha', 'Hipótese: dor torácica a esclarecer.', 'R07.4', 58, 57, 56, 50, 47),
  (17, 'Neusa Maria de Oliveira',      77, 0, 'F', NULL, NULL, 'Fraqueza súbita de um lado do corpo', 'vermelho', 'Mal-estar geral', 'adulto',
       '{"frequencia-cardiaca":92,"frequencia-respiratoria":20,"temperatura":36.6,"saturacao-o2":95,"escala-dor":0,"pressao-arterial-sistolica":186,"pressao-arterial-diastolica":102}',
       'sala_vermelha', 'Hipótese: déficit neurológico agudo.', 'I63.9', 101, 100, 98, 90, 86),
  -- altas de mais cedo (atendimentos e altas de hoje no painel)
  (18, 'Carlos Eduardo Lima',          29, 0, 'M', NULL, NULL, 'Dor de garganta', 'verde', 'Dor de garganta', 'adulto',
       '{"frequencia-cardiaca":84,"frequencia-respiratoria":16,"temperatura":37.8,"saturacao-o2":99,"escala-dor":5,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":78}',
       'alta', 'Hipótese: faringite aguda.', 'J02.9', 290, 280, 205, 195, 188),
  (19, 'Patrícia Gomes Ribeiro',       35, 0, 'F', NULL, NULL, 'Dor de cabeça', 'verde', 'Dor de cabeça', 'adulto',
       '{"frequencia-cardiaca":78,"frequencia-respiratoria":14,"temperatura":36.5,"saturacao-o2":99,"escala-dor":5,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":80}',
       'alta', 'Hipótese: cefaleia tensional.', 'G44.2', 240, 229, 160, 150, 146),
  (20, 'Wellington Souza Dias',        42, 0, 'M', NULL, NULL, 'Dor nas costas', 'azul', 'Dor na coluna', 'adulto',
       '{"frequencia-cardiaca":74,"frequencia-respiratoria":14,"temperatura":36.4,"saturacao-o2":99,"escala-dor":4,"pressao-arterial-sistolica":126,"pressao-arterial-diastolica":82}',
       'alta', 'Hipótese: lombalgia.', 'M54.5', 200, 186, 105, 98, 95),
  (21, 'Jéssica Almeida Moura',        27, 0, 'F', NULL, NULL, 'Ardor ao urinar', 'verde', 'Queixas urinárias', 'adulto',
       '{"frequencia-cardiaca":86,"frequencia-respiratoria":16,"temperatura":37.3,"saturacao-o2":99,"escala-dor":3,"pressao-arterial-sistolica":114,"pressao-arterial-diastolica":72}',
       'alta', 'Hipótese: infecção urinária.', 'N39.0', 150, 141, 70, 62, 58);

-- roda a função do banco como a conta: claims do JWT + role authenticated,
-- como e2e.passo (scripts/e2e/04_framework_e2e.sql), mas parando no erro
CREATE OR REPLACE FUNCTION pg_temp.demo_como(p_perfil uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_perfil, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE p_sql INTO v;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END $f$;

-- fluxograma do protocolo da unidade e o 1º discriminador da cor (os que valem
-- NA UNIDADE); se o fluxograma preferido não tiver a cor, o primeiro que tiver
CREATE OR REPLACE FUNCTION pg_temp.demo_fluxograma(p_unidade uuid, p_nome text, p_publico text, p_cor text,
  OUT fluxograma_id uuid, OUT discriminador text, OUT nome text) LANGUAGE sql STABLE AS $f$
  SELECT f.id, private.discriminadores_efetivos(p_unidade, f.id) -> p_cor -> 0 ->> 0, f.nome
    FROM public.protocolo_fluxogramas f
    JOIN public.unidades u ON u.id = p_unidade AND u.protocolo_classificacao_id = f.protocolo_id
   WHERE f.publico = p_publico
     AND jsonb_typeof(private.discriminadores_efetivos(p_unidade, f.id) -> p_cor) = 'array'
     AND (private.discriminadores_efetivos(p_unidade, f.id) -> p_cor -> 0 ->> 0) IS NOT NULL
   ORDER BY (f.nome = p_nome) DESC, f.ordem
   LIMIT 1
$f$;

DO $$
DECLARE
  v_unidade constant uuid := 'd0100000-0000-4000-8000-000000000001';
  v_ps      constant uuid := 'd0200000-0000-4000-8000-000000000001';
  v_sv      constant uuid := 'd0200000-0000-4000-8000-000000000004';
  v_rec uuid; v_enf uuid; v_med uuid;
  c record; fl record;
  v_dados jsonb; v_ficha jsonb; v_ep uuid; v_leito uuid;
BEGIN
  -- quem está de plantão AGORA no Pronto Socorro (escala do 01, check-in do passo 2)
  SELECT e.perfil_id INTO v_rec FROM public.escala_plantao e
   WHERE e.setor_id = v_ps AND e.ativo AND e.papel = 'recepcao' AND e.perfil_id::text LIKE 'd0300000%'
     AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min) ORDER BY e.inicio LIMIT 1;
  SELECT e.perfil_id INTO v_enf FROM public.escala_plantao e
   WHERE e.setor_id = v_ps AND e.ativo AND e.papel = 'enfermeiro' AND e.perfil_id::text LIKE 'd0300000%'
     AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min) ORDER BY e.inicio LIMIT 1;
  SELECT e.perfil_id INTO v_med FROM public.escala_plantao e
   WHERE e.setor_id = v_ps AND e.ativo AND e.papel = 'plantonista' AND e.perfil_id::text LIKE 'd0300000%'
     AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min) ORDER BY e.inicio LIMIT 1;
  IF v_rec IS NULL OR v_enf IS NULL OR v_med IS NULL THEN
    RAISE EXCEPTION 'Sem a equipe de agora no Pronto Socorro (recepção, enfermagem e médico): rode de novo o 01, que gera a escala do mês, e depois este.';
  END IF;

  FOR c IN SELECT * FROM demo_pac ORDER BY n LOOP
    -- recepção: ficha
    v_dados := jsonb_strip_nulls(jsonb_build_object(
      'nome', c.nome, 'sexo', c.sexo, 'categoria', 'sus', 'municipio', 'Santa Aurora', 'uf', 'SP',
      'data_nascimento', (private.data_atual() - make_interval(years => c.anos, months => c.meses) - (17 * c.n % 150) * interval '1 day')::date,
      'responsavel_nome', c.resp_nome, 'responsavel_parentesco', c.resp_parentesco));
    v_ficha := pg_temp.demo_como(v_rec, format('SELECT public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb)::text', v_ps, c.queixa, v_dados))::jsonb;
    v_ep := (v_ficha ->> 'episodio_id')::uuid;
    UPDATE demo_pac SET ep = v_ep, pac = (v_ficha ->> 'paciente_id')::uuid WHERE n = c.n;
    CONTINUE WHEN c.destino = 'triagem';

    -- enfermagem: classificação de risco (a cor é a da enfermagem)
    SELECT * INTO fl FROM pg_temp.demo_fluxograma(v_unidade, c.fluxograma, c.publico, c.cor);
    IF fl.fluxograma_id IS NULL THEN
      RAISE EXCEPTION 'O protocolo da unidade não tem fluxograma % com discriminador %.', c.publico, c.cor;
    END IF;
    IF fl.nome <> c.fluxograma THEN
      RAISE NOTICE 'Paciente %: o fluxograma "%" não tem discriminador %; usado "%".', c.n, c.fluxograma, c.cor, fl.nome;
    END IF;
    PERFORM pg_temp.demo_como(v_enf, format('SELECT public.classificar_risco(%L::uuid, %L, %L::jsonb, %L::uuid, %L)::text',
                                            v_ep, c.cor, c.vitais, fl.fluxograma_id, fl.discriminador));
    CONTINUE WHEN c.destino = 'aguardando';

    -- médico: atendimento
    PERFORM pg_temp.demo_como(v_med, format('SELECT public.iniciar_atendimento(%L::uuid)::text', v_ep));
    CONTINUE WHEN c.destino = 'atendimento';
    PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_soap(%L::uuid, %L, %L, %L, %L, %L)::text', v_ep,
      'Refere: ' || lower(left(c.queixa, 1)) || substr(c.queixa, 2) || '.', 'Sinais vitais da triagem conferidos.',
      c.hipotese, 'Conduta conforme protocolo da unidade.', c.cid));

    IF c.destino = 'reavaliacao' THEN
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.pedir_exames_atendimento(%L::uuid, %L::text[])::text', v_ep, ARRAY['Hemograma', 'Urina tipo I']));
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.aguardar_reavaliacao(%L::uuid, %L::timestamptz)::text', v_ep, now() + interval '25 minutes'));
    ELSIF c.destino = 'observacao' THEN
      -- o leito sai do box livre da observação do público do paciente (private.box_livre)
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_desfecho(%L::uuid, %L)::text', v_ep, 'observacao'));
    ELSIF c.destino = 'sala_vermelha' THEN
      SELECT l.id INTO v_leito FROM public.leitos l
       WHERE l.setor_id = v_sv AND l.ativo AND l.status = 'livre' ORDER BY l.identificador LIMIT 1;
      IF v_leito IS NULL THEN RAISE EXCEPTION 'Sala Vermelha sem leito livre.'; END IF;
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_desfecho(%L::uuid, %L, NULL, %L::jsonb)::text', v_ep, 'internacao',
                                              jsonb_build_object('setor_id', v_sv, 'leito_id', v_leito)));
    ELSIF c.destino = 'alta' THEN
      -- CID da alta: o do último registro do atendimento
      PERFORM pg_temp.demo_como(v_med, format('SELECT public.registrar_desfecho(%L::uuid, %L)::text', v_ep, 'alta'));
    END IF;
  END LOOP;
  RAISE NOTICE 'Plantão criado por: recepção %, enfermagem %, médico %.',
    (SELECT nome_completo FROM public.perfis WHERE id = v_rec), (SELECT nome_completo FROM public.perfis WHERE id = v_enf),
    (SELECT nome_completo FROM public.perfis WHERE id = v_med);
END $$;

-- ── 4. ajuste dos horários (como postgres) ──────────────────────────────────
SET LOCAL session_replication_role = replica;
DO $$
DECLARE
  c record;
  v_agora constant timestamptz := now();
BEGIN
  FOR c IN SELECT * FROM demo_pac WHERE ep IS NOT NULL LOOP
    UPDATE public.episodios
       SET chegada_em              = v_agora - make_interval(mins => c.m_chegada),
           classificado_em         = CASE WHEN classificado_em IS NOT NULL THEN v_agora - make_interval(mins => c.m_class) END,
           atendimento_iniciado_em = CASE WHEN atendimento_iniciado_em IS NOT NULL THEN v_agora - make_interval(mins => c.m_inicio) END,
           desfecho_em             = CASE WHEN desfecho_em IS NOT NULL THEN v_agora - make_interval(mins => c.m_desfecho) END,
           encerrado_em            = CASE WHEN encerrado_em IS NOT NULL THEN v_agora - make_interval(mins => c.m_desfecho) END
     WHERE id = c.ep;
    CONTINUE WHEN c.m_class IS NULL;
    UPDATE public.classificacoes_risco SET criado_em = v_agora - make_interval(mins => c.m_class) WHERE episodio_id = c.ep;
    UPDATE public.observacao SET aferido_em = v_agora - make_interval(mins => c.m_class) WHERE episodio_id = c.ep;
    CONTINUE WHEN c.m_registro IS NULL;
    UPDATE public.atendimento_registros SET criado_em = v_agora - make_interval(mins => c.m_registro) WHERE episodio_id = c.ep;
    UPDATE public.exames_pedidos SET pedido_em = v_agora - make_interval(mins => c.m_registro - 1) WHERE episodio_id = c.ep;
    UPDATE public.atendimento_reavaliacoes SET criado_em = v_agora - make_interval(mins => c.m_registro - 2) WHERE episodio_id = c.ep;
    CONTINUE WHEN c.m_desfecho IS NULL;
    UPDATE public.internacoes
       SET data_admissao = v_agora - make_interval(mins => c.m_desfecho),
           data_entrada_setor = v_agora - make_interval(mins => c.m_desfecho)
     WHERE episodio_id = c.ep;
    -- prazo de 6 h da observação a partir da entrada
    UPDATE public.pendencias
       SET criada_em = v_agora - make_interval(mins => c.m_desfecho),
           prazo = v_agora - make_interval(mins => c.m_desfecho) + interval '6 hours'
     WHERE tipo = 'observacao' AND internacao_id IN (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = c.ep);
  END LOOP;
END $$;
SET LOCAL session_replication_role = origin;

COMMIT;

-- ── conferência: o que a porta e o painel do gestor vão mostrar ─────────────
SELECT 'plantão de agora pronto' AS situacao,
       (SELECT count(*) FROM public.episodios WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND etapa = 'triagem') AS aguardando_triagem,
       (SELECT count(*) FROM public.episodios WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND etapa = 'atendimento'
           AND atendimento_iniciado_em IS NULL) AS aguardando_medico,
       (SELECT count(*) FROM public.episodios WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND etapa = 'atendimento'
           AND atendimento_iniciado_em IS NOT NULL) AS em_atendimento,
       (SELECT count(*) FROM public.episodios WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND reavaliar_em IS NOT NULL
           AND etapa = 'atendimento') AS em_reavaliacao,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = 'd0100000-0000-4000-8000-000000000001' AND l.status = 'ocupado') AS leitos_ocupados,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = 'd0100000-0000-4000-8000-000000000001') AS leitos,
       (SELECT count(*) FROM public.episodios WHERE unidade_id = 'd0100000-0000-4000-8000-000000000001' AND desfecho = 'alta') AS altas;
