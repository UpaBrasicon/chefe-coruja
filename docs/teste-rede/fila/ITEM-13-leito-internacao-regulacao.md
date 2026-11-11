# Item 13: a regulação só usa leito de internação, UTI ou isolamento

Achado: achado 1 da conferência das telas (`CONFERENCIA-TELAS-08NOV.md`), P2.

Pedido: o RT pediu a correção em 08/11/2026 ("Sim, corrige"). O "ok produção" e o merge ficam com ele.

Branch: `correcoes/chegada-leito-internacao`.

## O que acontecia
- Na chegada regulada e no aceite pelo destino, `regulacao_leitos_destino` listava todos os leitos livres da unidade.
- A lista incluía "EST-01/EST-02 · Porta do Hospital". Para o paciente homem do teste, também incluía a Obstetrícia.
- `private.regulacao_internar_chegada` e `regulacao_destino_aceitar` não conferiam o tipo do setor. Por isso, a chegada podia internar num leito da porta, e o aceite podia reservar um.

## Decisão
A regulação usa a mesma regra da internação pela porta (`registrar_desfecho`): só setor do tipo `internacao`, `uti` ou `isolamento`.

O filtro por público ou sexo (por exemplo, a Obstetrícia para um homem) não entra. Ele fica para o RT decidir.

## Feito
- Migration `20270308000006_regulacao_leito_internacao.sql`: trocas de texto reaplicáveis, com o rollback no cabeçalho.
  - `regulacao_leitos_destino` lista só leitos de internação, UTI ou isolamento.
  - `regulacao_destino_aceitar` e `private.regulacao_internar_chegada` recusam outro leito com "Escolha um leito de internação, UTI ou isolamento desta unidade."
- Teste `supabase/tests/fix_regulacao_leito_internacao.sql`: com cenário próprio (um hospital com leito na porta e leitos na Clínica Médica).
  - Antes da migration, falhou na lista. Depois, passou na homologação.
  - Confere a lista, a recusa do leito da porta no aceite e na chegada, e a internação num leito da Clínica Médica.
- Testes vizinhos: `fix_chegada_regulada_interna` e `fix_regulacao_origem_encerrada` passaram com a migration na homologação.
- Homologação: a migration foi aplicada em 08/11/2026, com a versão registrada. As três funções têm a condição nova.

## O que não foi conferido
- A tela não foi aberta de novo no navegador. A regulação nº 176 da conferência já está realizada, e a lista só aparece para regulação aguardando chegada ou aceite.
