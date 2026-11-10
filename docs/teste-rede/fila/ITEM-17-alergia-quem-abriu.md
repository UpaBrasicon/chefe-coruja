# Item 17: quem abriu a observação registra alergia

Achado: na conferência do item 16 (08/11/2026), `registrar_alergia` voltou "Acesso negado" para o médico da porta que tinha aberto a observação.

Investigação: não era defeito. Registrar alergia exigia estar escalado no setor onde o paciente está (`pode_atuar_no_paciente`). O paciente estava na Observação Adulto: a equipe da observação gravava, e a da porta, não.

Decisão do RT (08/11/2026, "Sim"): quem abriu a observação também registra alergia enquanto ela está aberta, como no item 4 (parecer e reavaliação).

Branch: `correcoes/alergia-quem-abriu`.

## Feito
- Migration `20270308000008_alergia_quem_abriu.sql`: trocas de texto reaplicáveis, com o rollback no cabeçalho.
  - `registrar_alergia` aceita quem abriu a observação.
  - `alergias_do_paciente` também aceita, porque a tela lê antes de registrar.
  - A regra de "quem abriu" é a mesma de sempre: `private.abriu_a_observacao`. É o autor do desfecho "observação", plantonista de plantão agora na unidade, com o paciente ainda na observação.
  - Inativar, "nega alergias" e "desconhece" não mudam.
- Tela "Observações que você abriu": ganhou o botão "Alergias", que abre o painel de alergias e eventos adversos (o mesmo da janela de atendimento).
- Teste `supabase/tests/fix_alergia_quem_abriu.sql`: falhou antes da migration ("Acesso negado") e passou depois, na homologação. Confere:
  - o autor lê e registra, com autor = login;
  - outro médico da porta não lê nem registra;
  - o autor fora do plantão não registra;
  - o médico da observação continua registrando;
  - fora da observação, o autor não registra mais.
- Testes vizinhos: `fix_observacao_quem_abriu_parecer` e `fix_porta_encerra_observacao` passaram com a migration.
- `src/lib/observacoesQueAbri.test.ts`: passou a esperar os 4 botões. Todos os testes de `src/lib` passam (404). `tsc`, `eslint` e a verificação do padrão do frontend estão limpos.

## Homologação
- A migration foi aplicada em 08/11/2026, com a versão registrada.
- `scripts/e2e/107_reconferencia_alergia_quem_abriu.sql`, no paciente "Chegada Enfermagem Teste":
  - `medico.upa.f5` leu as alergias ("nao_registrada") e registrou Dipirona;
  - a enfermeira da porta continuou recusada.
- A tela não foi aberta no navegador.
