-- Rollback da migration 20270418000094 (LG12: tecnovigilância).
-- ATENÇÃO: apaga os relatos, o andamento e as suspensões. A RDC 67/2009
-- (art. 6º) manda guardar as notificações por pelo menos 2 anos: antes de
-- rodar na produção, exportar as três tabelas para o cofre da guarda (LG4).
-- Volta situacao_ferramenta à versão do LG13 (sem suspensa_rede).
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lg12-tecnovigilancia-5-anos';
DROP FUNCTION IF EXISTS public.relatar_tecnovigilancia(text, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.fila_tecnovigilancia();
DROP FUNCTION IF EXISTS public.tecnovigilancia_da_unidade(uuid);
DROP FUNCTION IF EXISTS public.meus_relatos_tecnovigilancia();
DROP FUNCTION IF EXISTS public.andamento_tecnovigilancia(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.suspender_versao_rede(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.encerrar_suspensao_rede(uuid, text);
DROP FUNCTION IF EXISTS public.suspensoes_rede_vigentes();
DROP FUNCTION IF EXISTS public.aviso_tecnovigilancia(uuid, boolean);
DROP FUNCTION IF EXISTS private.apagar_tecnovigilancia_vencida();
DROP FUNCTION IF EXISTS private.tecnovigilancia_json(private.tecnovigilancia_relatos, boolean);
DROP FUNCTION IF EXISTS private.tecnovigilancia_situacao(uuid);
DROP FUNCTION IF EXISTS private.tem_dado_pessoal(text);
DROP FUNCTION IF EXISTS private.sou_rt_medico();
DROP TABLE IF EXISTS private.tecnovigilancia_suspensoes;
DROP TABLE IF EXISTS private.tecnovigilancia_andamento;
DROP TABLE IF EXISTS private.tecnovigilancia_relatos;
DROP FUNCTION IF EXISTS private.tecnovigilancia_so_inclusao();

-- situacao_ferramenta como na migration 20270417000090 (LG13)
CREATE OR REPLACE FUNCTION public.situacao_ferramenta(p_ferramenta text, p_versao text, p_unidade uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'registrada', v.id IS NOT NULL,
    'status', coalesce(v.status, 'nao_registrada'),
    'decidida_por', p.nome_completo,
    'decisao_registro', v.decisao_registro,
    'decidida_em', v.decidida_em,
    'decisao_nota', v.decisao_nota,
    'revisoes_exigidas', (SELECT to_jsonb(f.revisoes_exigidas) FROM public.ferramentas_clinicas f WHERE f.id = p_ferramenta),
    'revisoes_pendentes', CASE WHEN v.id IS NULL THEN NULL ELSE to_jsonb(private.revisoes_pendentes(v.id, false)) END,
    'unidade', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
      'oculta', u.oculta, 'nota_local', u.nota_local, 'definida_em', u.vigente_desde,
      'definida_por', (SELECT pp.nome_completo FROM public.perfis pp WHERE pp.id = u.definida_por)) END)
  FROM (SELECT 1) x
  LEFT JOIN public.ferramenta_versoes v ON v.ferramenta_id = p_ferramenta AND v.versao = p_versao
  LEFT JOIN public.perfis p ON p.id = v.decidida_por
  LEFT JOIN public.ferramenta_unidade u ON u.ferramenta_id = p_ferramenta AND u.unidade_id = p_unidade
        AND u.vigente_ate IS NULL
        AND EXISTS (SELECT 1 FROM public.vinculos vv WHERE vv.perfil_id = private.meu_perfil_id()
                     AND vv.unidade_id = p_unidade AND vv.ativo)
$$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20270418000094';
COMMIT;
