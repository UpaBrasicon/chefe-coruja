# Item 18: "Finalizados no plantão" para quem abriu a observação

**Achado:** achado 3 da conferência das telas de 07/11 (`CONFERENCIA-TELAS.md`). Rosa foi encerrada por "Observações que você abriu", mas não apareceu em "Finalizados no plantão", porque essa lista só mostra os setores de observação da escala de agora.

**Decisão do RT (08/11/2026):** **A**. A observação aparece para quem a abriu pela porta, nas 24 h depois do encerramento.

Na mesma resposta, o RT decidiu também:
- **CID x idade:** **C**, fica como está;
- **sepse adulto:** **adiada** até haver fonte.

**Branch:** `correcoes/finalizados-quem-abriu`.

## Feito
- **Migration `20270308000009_finalizados_quem_abriu.sql`:** trocas de texto reaplicáveis em `painel_observacao`, com o rollback no cabeçalho.
  - Para quem não é gestor e não tem setor de observação na escala, o painel não sai mais vazio na hora.
  - O painel inclui a observação que a pessoa abriu pela porta (autora do desfecho "observação") e que terminou nas últimas 24 h. Inclui só a finalizada: a aberta continua em "Observações que você abriu".
  - O médico escalado na observação e o gestor não mudam.
- **Tela:** não muda. A aba "Finalizados no plantão" já existe para o médico da porta.
- **Teste `supabase/tests/fix_finalizados_quem_abriu.sql`:** falhou antes da migration, no passo 2, e passou depois, na homologação. Confere:
  - com a observação aberta, o autor não vê nada no painel;
  - terminada, vê nos finalizados, com o desfecho;
  - outro médico da porta não vê;
  - passadas 24 h, some;
  - o médico da observação continua vendo, sem linha repetida.
- **Testes vizinhos:** `fix_porta_encerra_observacao` e `fix_observacao_quem_abriu_parecer` passaram com a migration. `porte_observacao` depende do seed e só roda no CI.

## Homologação
- A migration foi aplicada em 08/11/2026, com a versão registrada.
- **Conferência pela conta de `medico.upa.f5`** (JWT simulado, sem gravar): `painel_observacao` da UPA F5 trouxe 5 finalizadas que ele abriu.
  - Gestante A01 Teste: transferência;
  - Rosa Teste Arquivo: alta médica;
  - Tela Chegada Teste: transferência;
  - Chegada Enfermagem Teste: transferência;
  - Observacao Tela Teste: alta médica.
- A tela não foi aberta no navegador.
