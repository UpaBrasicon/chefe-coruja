# Criação de conta pela administração: diagnóstico (CA1 e CA2)

Fase 1, item 16 (P2), achado na tarefa 2 da Fase 0 (05/10/2026). O RT pediu este item em 23/11/2026, na reta final do projeto. Lido na master (2e7be8d7) e no banco da produção. Nada foi programado.

## Como está hoje

- **Conta nova só com convite ou contrato** (`20261003000009`): o gatilho `private.primeiro_acesso_estacionar` recusa o signUp público sem código de convite ou de contrato. A exceção prevista era a conta criada pela administração (`raw_app_meta_data.origem = 'admin'`, que só a chave de serviço escreve).
- **O achado da Fase 0:** o servidor de Auth grava a linha em `auth.users` antes de pôr o `app_metadata`, então o gatilho não vê o `origem = 'admin'` e recusa também o "Add user" do painel do Supabase e a criação pela API de administração. Na prática, hoje **toda** conta nasce de um convite ou de um contrato. A definição na produção é a mesma da migration (conferido em 23/11/2026).
- **Depois disso vieram S1 e S2 (15/11/2026, na produção):** vínculo novo só por convite ou pelas regras de `gerar_convite`; adesão ao contrato só depois do e-mail confirmado; limite de tentativas no convite. Uma conta criada pela administração nasceria **sem vínculo** e continuaria precisando de convite para entrar numa unidade.
- **Como o gestor traz alguém hoje:** tela Convites, um convite por vez (papel, setor, "para quem", primeiro plantão, validade); o código é entregue à pessoa, que cria a própria conta.

## Decisões

### CA1. O item 16 (conta criada pelo painel ou pela API)

**A (recomendo).** Não abrir esse caminho. Fechar o item 16 como "não fazer", com o motivo registrado: o convite já cobre a entrada de qualquer pessoa, a conta criada pela administração nasceria sem vínculo (S1) e um segundo caminho de criação fora do convite aumenta a superfície de ataque que S1 e S2 fecharam. Sem código.

**B.** Fazer como o item foi escrito: trocar a checagem por um gatilho de restrição `DEFERRABLE INITIALLY DEFERRED`, que olha o `origem = 'admin'` no fim da transação do Auth (validar antes se o Auth grava o metadado na mesma transação). Migration expand com rollback; testes: signUp sem código recusado, criação pela administração aceita. Serve para a equipe criar conta de teste ou de quem não tem e-mail próprio, mas a conta continua sem vínculo até um convite.

### CA2. Convites em lote (só se CA1 = A)

O motivo real de querer "criar conta pela administração" costuma ser a implantação: uma unidade nova com 30 ou 40 pessoas.

**A (recomendo).** Na tela Convites, o gestor cola ou digita uma lista (nome de quem recebe e papel) e gera todos os convites de uma vez, com a mesma validade; baixa a lista com os códigos (PDF ou CSV) para entregar. Usa a mesma `gerar_convite` por pessoa, com as regras de S1 e S2, e sem tocar no Auth. Só tela, ou uma RPC fina por cima da `gerar_convite`. P2.

**B.** Não fazer agora; seguir com um convite por vez.

## Decisões do RT

23/11/2026, nas palavras dele: "Sim, todas A". CA1 = A: o item 16 fecha sem código, com o motivo acima. CA2 = A: convites em lote na tela Convites, P2.
