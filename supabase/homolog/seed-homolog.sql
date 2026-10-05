-- ════════════════════════════════════════════════════════════════════════════
-- Seed da HOMOLOGAÇÃO (Fase 0, tarefa 2). Só dados fictícios de estrutura.
--
-- Diferente do supabase/seed.sql (banco local), este arquivo NÃO cria usuário
-- nenhum: a homologação fica na internet, e um usuário com senha conhecida
-- seria porta aberta. Contas de homologação nascem pelo painel do Supabase
-- (Authentication → Add user) ou por convite, com senha de quem opera; o
-- primeiro super admin sai de supabase/homolog/promover-super-admin.sql.
--
-- Rodar no SQL Editor do projeto de homologação. ANTES, confira que a URL do
-- painel contém kswurfyxxvfydpjfrivy (homologação), nunca saqjrjtrkzkswsxxvdxn.
-- Idempotente (ON CONFLICT / NOT EXISTS): pode rodar de novo.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- trava: este seed só roda num banco sem organização "real" cadastrada
  IF EXISTS (SELECT 1 FROM public.organizacoes WHERE id <> '30000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco já tem outra organização: o seed de homologação só roda em banco recém-reconstruído.';
  END IF;
END $$;

-- ── Organização, unidade, setores e leitos ─────────────────────────────────
INSERT INTO public.organizacoes (id, nome) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Rede de Homologação (fictícia)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, latitude, longitude, raio_metros) VALUES
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'UPA Homologação', 'upa', -16.6869, -49.2648, 500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Pronto Socorro', 'emergencia', 1),
  ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Observação', 'observacao', 2),
  ('32000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', 'Clínica Médica', 'internacao', 3),
  ('32000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'Sala Vermelha', 'uti', 4)
ON CONFLICT (id) DO NOTHING;

-- todos livres: a ocupação nasce pelos fluxos do sistema (internação, observação)
INSERT INTO public.leitos (setor_id, identificador, status)
SELECT s.setor, s.prefixo || n, 'livre'::public.status_leito
FROM (VALUES
  ('32000000-0000-4000-8000-000000000002'::uuid, 'OBS-', 6),
  ('32000000-0000-4000-8000-000000000003'::uuid, 'CM-', 8),
  ('32000000-0000-4000-8000-000000000004'::uuid, 'SV-', 2)
) AS s(setor, prefixo, qtd)
CROSS JOIN LATERAL generate_series(1, s.qtd) n
WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.setor);

-- ── Pacientes fictícios (adulto, idoso, criança, lactente) ─────────────────
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, prontuario) VALUES
  ('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Paciente Fictício Homologação Um',   '1979-04-18', 'M', 'HML.000001'),
  ('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Paciente Fictícia Homologação Dois', '1948-09-02', 'F', 'HML.000002'),
  ('33000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', 'Criança Fictícia Homologação Três', '2018-01-25', 'F', 'HML.000003'),
  ('33000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'Lactente Fictício Homologação Quatro', '2026-03-10', 'M', 'HML.000004')
ON CONFLICT (id) DO NOTHING;
