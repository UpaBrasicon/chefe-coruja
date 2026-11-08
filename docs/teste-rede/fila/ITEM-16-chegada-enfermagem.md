# Item 16: a enfermagem vê a chegada regulada no leito reservado

**Origem:** item da fila incluído pelo RT em 08/11/2026 ("tela do enfermeiro para confirmar a chegada regulada"). Desde o item 6 (#491, R5), o banco já deixa o enfermeiro escalado no setor do leito marcar a chegada, mas não havia tela para isso.

**Decisão do RT (08/11/2026, "Sim" às recomendações):**

| # | Decisão | Escolhida |
|---|---|---|
| E1 | Onde aparece | **B**: o leito reservado entra na lista do setor da Internação da enfermagem, com quem chega e "Paciente chegou". Junto vai o aviso de saída (C). |
| E2 | "Não chegou" | O enfermeiro **não** registra. Fica com o médico, o NIR e o gestor, porque pede justificativa e muda a regulação. |
| E3 | Regulação sem leito reservado | **Não aparece** para a enfermagem. Quem escolhe o leito é o médico ou o NIR. |

As opções nasceram de telas reais do Refero: o check-in do Luma (A e B) e o status de retirada do Instacart (C). O desenho das opções ficou em `tmp/chegada-enfermeiro-opcoes.html`, fora do git.

**Branch:** `correcoes/chegada-enfermeiro`.

## Banco
**Migration `20270308000007_enfermagem_chegadas.sql`:** nova leitura `enfermagem_chegadas(p_unidade)`, com o rollback no cabeçalho.
- Mostra as regulações da rede que levam o paciente à unidade e ainda esperam a chegada (autorizada, agendada ou em trânsito).
- Só entram as que têm reserva ativa num leito de setor em que a pessoa está escalada agora.
- Só a enfermagem lê. `pode_confirmar` é verdadeiro só para o enfermeiro, como na regra R5.
- Traz o nome (o social, se houver), o nascimento, o sexo, a unidade de origem, a hora da saída e as alergias ativas da origem.

A confirmação usa `regulacao_marcar_chegada`, que não mudou. Para E2, o banco já recusava "não chegou" vindo do enfermeiro, porque o setor do leito só é conferido na chegada. O teste novo comprova isso.

## Tela
- **`ChegadaReservada`:** a linha do leito reservado, em cor de atenção. Mostra o texto "Reservado · chega <nome>, <idade>a, da <origem> (regulação nº N) · saiu às HH:MM", ou "ainda não saiu da origem".
  - "Paciente chegou" abre a confirmação, com as alergias informadas pela origem e o que a chegada faz.
  - Se houver provável cadastro duplicado, a tela pergunta se é a mesma pessoa, como a tela do médico.
  - O técnico vê a linha, mas sem o botão.
- **`InternacaoEnfermagem`:** cada setor junta os leitos internados e as chegadas esperadas. Um setor que só tem chegada também aparece.
- **Aviso de saída:** quando uma chegada passa a "em trânsito" entre duas leituras (a cada 60 s), a tela mostra o balão "<nome> saiu da <origem>", com o leito e o número.
  - **Diferença do que foi apresentado:** a faixa de notificações do topo só aparece para o médico plantonista. Por isso, o aviso do enfermeiro é o balão flutuante desta tela, e só aparece com ela aberta.

## Testes
- **`supabase/tests/fix_enfermagem_chegadas.sql`:** falhou antes da migration, porque a função não existia, e passou na homologação depois dela. Confere:
  - o que a enfermeira do setor vê;
  - que não vê outro setor nem chegada sem reserva;
  - que o técnico vê sem confirmar;
  - que o médico não lê;
  - E2;
  - que a linha some depois da chegada.
- **`src/lib/chegadaEnfermagem.test.ts`:** confere o texto da linha e quem saiu desde a leitura anterior (4 de 4). Todos os testes de `src/lib` passam (404).

## Homologação
- A migration foi aplicada em 08/11/2026, com a versão registrada.
- **`scripts/e2e/106_conferencia_chegada_enfermagem.sql`:** cria o paciente "Chegada Enfermagem Teste" na UPA F5. A regulação nº 196 vai para o Hospital F5, aceita com o leito UTI-02 reservado.
  - O plantão de agora de `enfermeiro.hospital.f5` passou da Porta do Hospital para a UTI Adulto.
  - O `106b` marca a saída e, no fim, devolve o plantão.
- **Alergia:** `registrar_alergia` voltou "Acesso negado" neste paciente, para a enfermeira e para o médico da porta. Por isso a chegada da homologação não tem alergia. As alergias ficam cobertas pelo teste de banco.
- **Conferência pela conta da enfermeira (JWT simulado, sem gravar):** `enfermagem_chegadas` devolveu a nº 196, UTI-02, UTI Adulto, origem UPA Fase 5 24h, `pode_confirmar` verdadeiro.
