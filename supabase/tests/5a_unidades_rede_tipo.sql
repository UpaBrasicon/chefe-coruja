-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270221000001_unidades_rede_tipo.sql (pendência da 5A,
-- tarefa 5). Tudo em transação com ROLLBACK.
--
-- 1. cada item de unidades_rede traz o tipo da unidade;
-- 2. id e nome continuam lá (expand: nada sai);
-- 3. a lista continua sem a central e só com unidades ativas da mesma rede.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000065b1', 'rede.tipo@teste.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('00000000-0000-4000-8000-0000000065b1', 'Pessoa da rede')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES ('00000000-0000-4000-8000-0000000065a1', 'Rede do tipo');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, ativo) VALUES
  ('00000000-0000-4000-8000-0000000065a2', '00000000-0000-4000-8000-0000000065a1', 'UBS daqui', 'ubs', true),
  ('00000000-0000-4000-8000-0000000065a3', '00000000-0000-4000-8000-0000000065a1', 'UBS vizinha', 'ubs', true),
  ('00000000-0000-4000-8000-0000000065a4', '00000000-0000-4000-8000-0000000065a1', 'UPA da rede', 'upa', true),
  ('00000000-0000-4000-8000-0000000065a5', '00000000-0000-4000-8000-0000000065a1', 'Hospital da rede', 'hospital', true),
  ('00000000-0000-4000-8000-0000000065a6', '00000000-0000-4000-8000-0000000065a1', 'UPA fechada', 'upa', false);
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('00000000-0000-4000-8000-0000000065b1', '00000000-0000-4000-8000-0000000065a2', 'plantonista');

SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000065b1', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  r jsonb := public.regulacao_contexto('00000000-0000-4000-8000-0000000065a2') -> 'unidades_rede';
  esperado jsonb := '[
    {"id": "00000000-0000-4000-8000-0000000065a5", "nome": "Hospital da rede", "tipo": "hospital"},
    {"id": "00000000-0000-4000-8000-0000000065a2", "nome": "UBS daqui", "tipo": "ubs"},
    {"id": "00000000-0000-4000-8000-0000000065a3", "nome": "UBS vizinha", "tipo": "ubs"},
    {"id": "00000000-0000-4000-8000-0000000065a4", "nome": "UPA da rede", "tipo": "upa"}]';
BEGIN
  IF r IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'FALHOU: unidades_rede veio %', r;
  END IF;
  RAISE NOTICE 'OK  unidades_rede com id, nome e tipo, só as ativas da rede';
END $$;

ROLLBACK;
