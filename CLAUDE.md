# Instruções do projeto — Chefe Coruja (app)

Leia também `AGENTS.md` (regras de encoding: nunca editar arquivo do projeto pelo PowerShell).

## Rota do projeto (decisão do responsável, 05/10/2026)

**`BACKLOG.md` (nesta pasta) é o plano do projeto daqui para a frente.** Ele define o papel, as regras globais, as regras de backend, os princípios de resiliência e o backlog por fases (Fase 0 → Fase 5, Trilha Hermes, backlog comercial).

- **Não mudar de rota até finalizar.** Pedido fora do backlog (nova funcionalidade, outra frente, "aproveita e faz X") não é executado: registrar o pedido, lembrar em que fase/tarefa estamos e perguntar se é para incluí-lo no backlog — com prioridade e fase — antes de qualquer código. Correção de bug crítico em produção é a única exceção, e mesmo assim vai em branch própria.
- **Uma tarefa por vez**, dentro da fase atual. Não avançar de fase antes de fechar os P0 da fase com **evidência registrada** (teste, log ou documento), nunca por declaração.
- **Ordem de execução = "Ordem técnica" da fase**, não a numeração da tabela. Fase 0 começa por: homologação (tarefa 2) → borda (3) → HMAC e `search_path` (4 e 5) → 2FA (1) → leito (6 e 7) → PITR/guarda (8 e 9) → acessos (10) → P1.
- **Nada direto em produção.** O alvo padrão é homologação. Isso substitui a autorização antiga de "aplicar direto na produção": a partir de 05/10/2026 toda migration e todo deploy passa antes por homologação.
- **Cada tarefa em branch própria e PR próprio** (prefixo `fase<N>/<tarefa>`); nada de acumular mudanças sem revisão. Integração de infraestrutura deixa `infra/<nome>.md` (o que cobre, o que não cobre, chaves envolvidas, como reverter).
- **Migrations expand/contract**, idempotentes, com rollback escrito e testado em homologação. Proibido DROP/RENAME de coluna em uso e `ALTER TYPE` destrutivo sem janela declarada.
- **Entrega de cada tarefa** segue o formato do "Plano de Trabalho — comando por tarefa" do `BACKLOG.md` (diagnóstico → subtarefas → banco → RPC → frontend → permissões/auditoria → testes → critérios de aceite com evidência → riscos → ordem → demonstração comercial).
- Estado de cada tarefa fica em `produto/docs/fase0/` (diagnóstico e evidências) e no `BACKLOG.md` quando concluída.

## Regras clínicas

As regras clínicas continuam valendo (pediatria até 13a 11m 29d; dose só de fonte citada, nunca adulto→criança; cor da classificação é da enfermagem; autor = login; vitais impressos crus). Ver o `CLAUDE.md` da pasta `projetofrontend/Chefe Coruja_ sete melhorias`.
