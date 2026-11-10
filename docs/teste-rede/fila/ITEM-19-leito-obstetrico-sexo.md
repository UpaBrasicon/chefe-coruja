# Item 19: leito obstétrico só para paciente do sexo feminino

Achado: conferência das telas de 08/11/2026. A lista de leitos do aceite, e da chegada, oferecia a Obstetrícia para paciente do sexo masculino.

Decisão do RT (08/11/2026): A. A regulação não oferece leito de setor incompatível com o sexo do paciente.

Branch: `correcoes/leito-por-sexo`.

## Como ficou
- Sem coluna nova. O setor já diz que é obstétrico pelo tipo de leito da regulação: `setores.regulacao_tipo_leito = 'obstetrico'`.
  - Na proposta ao RT, eu tinha falado em "marcar o sexo em cada setor". Usar o campo que já existe dá o mesmo resultado sem um cadastro a mais.
- A regra: leito de setor obstétrico só para paciente do sexo feminino. Paciente sem sexo registrado não é barrado.
- Fora desta mudança:
  - o público por idade (`setores.publico`: adulto ou pediátrico), que não fazia parte da decisão;
  - os demais tipos de leito.
- Na produção, em 08/11/2026, nenhum setor tem tipo de leito marcado (conferido por agregado). A regra começa a valer quando a Obstetrícia for marcada como "obstétrico".

## Feito
- Migration `20270308000010_leito_obstetrico_sexo.sql`: rollback no cabeçalho.
  - `private.leito_serve_ao_paciente(p_leito, p_paciente)` concentra a regra.
  - `regulacao_leitos_destino` não lista o leito incompatível.
  - `regulacao_destino_aceitar` e `private.regulacao_internar_chegada` recusam com "Leito obstétrico é só para paciente do sexo feminino.".
- Teste `supabase/tests/fix_leito_obstetrico_sexo.sql`: falhou antes da migration e passou depois, na homologação. Confere:
  - a lista para o homem, sem OB, e para a mulher, com OB;
  - a recusa no aceite e na chegada do homem;
  - o aceite da mulher no OB.
- Testes vizinhos: passaram com a migration `fix_regulacao_leito_internacao`, `fix_chegada_regulada_interna`, `fix_regulacao_origem_encerrada` e `fix_enfermagem_chegadas`.

## Homologação
- A migration foi aplicada em 08/11/2026, com a versão registrada.
- Conferência pela conta de `medico.hospital.f5` (JWT simulado, sem gravar): para a nº 197, de paciente homem, a lista ficou só com UTI-03. Antes, mostrava UTI-03 e OB-01 a OB-03.
