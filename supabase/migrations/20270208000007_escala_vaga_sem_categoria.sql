-- ════════════════════════════════════════════════════════════════════════════
-- Bug médio M1 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- a vaga sem categoria aparecia em vagas_abertas para todos os papéis, mas
-- candidatar_vaga (20270202000004) a trata como vaga de plantonista e recusava
-- a enfermeira, o técnico e os outros ("Esta vaga é de plantonista").
--
-- Correção: vagas_abertas usa a mesma regra (sem categoria = plantonista).
-- Corpo de 20270202000003; muda só o filtro da categoria. Mesma assinatura e
-- mesmo retorno (CREATE OR REPLACE, as permissões ficam). Idempotente.
-- Teste: supabase/tests/escala_vaga_sem_categoria.sql
--
-- Rollback: reaplicar public.vagas_abertas de 20270202000003_escala_gestor_categorias.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.vagas_abertas()
RETURNS TABLE(id uuid, unidade_id uuid, unidade_nome text, latitude double precision, longitude double precision, setor_id uuid,
              setor_nome text, especialidade text, data date, turno text, inicio timestamp with time zone, fim timestamp with time zone,
              parte smallint, partes smallint, observacao text, minha_candidatura text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT v.id, v.unidade_id, u.nome, u.latitude, u.longitude, v.setor_id, s.nome, s.especialidade, v.data, v.turno,
         j.ini, j.fim, v.parte, v.partes, v.observacao,
         (SELECT c.status FROM public.candidaturas_escala c
           WHERE c.perfil_id = private.meu_perfil_id()
             AND (c.vaga_id = v.id
                  OR (c.vaga_id IS NULL AND v.plantao_origem_id IS NULL
                      AND c.setor_id = v.setor_id AND c.data = v.data AND c.turno = v.turno))
           ORDER BY c.created_at DESC LIMIT 1)
    FROM public.escala_vagas v
    JOIN public.unidades u ON u.id = v.unidade_id
    JOIN public.setores s ON s.id = v.setor_id AND s.ativo
    CROSS JOIN LATERAL (
      SELECT coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno)) AS ini,
             coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno))
               + make_interval(mins => coalesce(v.duracao_min, CASE v.turno WHEN 'noite' THEN 720 ELSE 360 END)) AS fim) j
   WHERE v.fechada_em IS NULL
     AND private.membro_da_unidade(v.unidade_id)
     -- a vaga só aparece para quem tem o papel dela na unidade; sem categoria, é do
     -- plantonista, como em candidatar_vaga (M1)
     AND EXISTS (SELECT 1 FROM public.vinculos vi
                  WHERE vi.perfil_id = private.meu_perfil_id() AND vi.unidade_id = v.unidade_id
                    AND vi.ativo AND vi.papel = coalesce(v.papel, 'plantonista'))
     AND j.fim > now()
     -- a faixa marcada que já tem alguém da categoria escalado não é mais vaga
     AND (v.plantao_origem_id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM public.escala_plantao e
                          WHERE e.setor_id = v.setor_id AND e.ativo
                            AND (v.papel IS NULL OR e.papel = v.papel)
                            AND e.inicio < j.fim AND e.inicio + make_interval(mins => e.duracao_min) > j.ini))
   ORDER BY j.ini, s.nome
$function$;
