# Teste ponta a ponta da rede: catálogo de cenários

Pedido do RT em 06/11/2026. A frente "Teste ponta a ponta da rede" está registrada no BACKLOG.

Este é o catálogo da tarefa 1: **30 cenários** que percorrem todos os papéis e a rede inteira, da UBS à UPA e ao hospital, passando por regulação, farmácia, faturamento e custos. Por enquanto nada é gravado no banco. A carga na homologação e a execução com login são a tarefa 2, que só começa com o aval do RT.

## Como ler
- **`MAPA.md`:** a base de tudo. Lista os papéis, telas, RPCs e fluxos tirados do código, os pontos onde o custo nasce, as ferramentas clínicas com a fonte, o ambiente de teste, as regras e as **lacunas**, ou seja, o que o sistema não faz e nenhum cenário pode exigir.
- **Formato de cada cenário:** objetivo; rede; papéis e contas `*.f5@teste.local`; paciente fictício; pré-condições; tabela de passos (papel → tela → ação → resultado esperado → conferência no banco); custos; critérios de aceite; bordas; lacunas.
- **Custos:** todos são **fictícios**. Cada tabela abre com "EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais". Os códigos SIGTAP citados existem na tabela carregada no sistema. Os valores foram inventados.
- **Regras clínicas:** nenhum cenário traz dose ou conduta de memória. O cenário remete à ferramenta do sistema que tem a fonte, pelo id da ficha. A cor da classificação é sempre escolha da enfermeira de teste, nunca do sistema. Sinais vitais aparecem crus.
- **Senhas:** nenhuma senha aparece no catálogo; as de teste ficam fora do repositório.

## Os 30 cenários

| Bloco | Arquivo | Cenários |
|---|---|---|
| A — Materno-infantil e pediatria | `CENARIOS-A-materno-infantil.md` | A01 Pré-natal na UBS → pré-eclâmpsia grave e eclâmpsia na UPA → regulação ao hospital · A02 Gestante hipertensa com envio que "não chegou" em 12 h · A03 Puericultura que vira bronquiolite na UPA · A04 Corte de idade: 13a 11m 29d e 14a 0d no mesmo plantão · A05 Anafilaxia pediátrica com liberação da farmácia · A06 Recém-nascido vinculado à mãe e regulação neonatal |
| B — Urgência adulto e regulação | `CENARIOS-B-urgencia-regulacao.md` | B01 Sepse até UTI fora da rede · B02 AVC: recusa, negativa, devolução e reenvio · B03 SCA com leito reservado no hospital da rede · B04 Trauma: em trânsito e "não chegou" · B05 Regulação de consulta pela UBS e teleinterconsulta · B06 SLA estourado, cobrança do NIR e cancelamento |
| C — Farmácia, faturamento e custos | `CENARIOS-C-farmacia-custos.md` | C01 Conta de porta, BPA-I/BPA-C e fechamento · C02 AIH, pré-auditoria e glosa com recurso · C03 APAC com competências · C04 Farmácia: alta vigilância, dispensação e estoque · C05 ERP: plantões, versões da conta e reabertura · C06 Leitura pela API e pelo arquivo do ERP |
| D — Bordas, acessos e segurança | `CENARIOS-D-bordas-acessos.md` | D01 Escala: fora da janela e tolerância · D02 Fim do plantão e liberação · D03 Check-in fora do raio · D04 Troca de plantão · D05 Segundo fator · D06 Evasão · D07 Óbito, SINAN e regulação em curso · D08 Sem conexão · D09 Virada de data · D10 Pedido de prontuário encerrado · D11 Unificação de cadastro · D12 Administrador só com agregados |

**Por onde começar:** o A01 é o carro-chefe. Sozinho ele percorre quase todos os papéis da rede de teste.

## Ambiente preparado (06/11/2026)
O script `scripts/e2e/46_rede_fase5_ampliacao.sql` ampliou a rede F5 da homologação. Pode rodar de novo sem duplicar nada.

**O que entrou:**
- **Secretaria de Saúde F5**, com o módulo de rede ligado e a UBS, a UPA e o hospital liberados.
- **Setores novos:**
  - na UPA, Observação Pediátrica (3 leitos) e Isolamento (2);
  - no hospital, UTI Adulto (3) e Obstetrícia (3), que entram como destinos da regulação.
- **9 contas novas** (24 no total), todas com a mesma senha das contas F5 (o hash foi copiado no banco; nenhuma senha aparece no repositório):
  - `tecnico.upa.f5`
  - `telemedicina.f5`
  - `admin.f5`
  - `secretaria.f5`
  - `regulacao.regional.f5`
  - `faturamento.rede.f5`
  - `recepcao.hospital.f5`
  - `gestor.hospital.f5`
  - `enfermeiro.hospital.f5`
- **Vínculos a mais:**
  - o regulador também na UPA e no hospital, para decidir AIH e APAC;
  - o faturamento e o NIR também no hospital.
- **CNS e CBO:** CNS fictício com dígito verificador válido (começa com 7) e CBO da tabela `terminologia.cbo` nos 24 perfis.
- **Escala:** de 05/11 a 13/11/2026, nos três turnos, para todas as contas que dependem de escala. O check-in de cada sessão de teste continua sendo pelo `41_checkin_fase5.sql` ou pela tela.

**Ficou de fora, de propósito:**
- **Coordenadas das unidades.** Com elas, o check-in na tela exige estar a 500 m e barraria quem testa de longe. O D03 põe a coordenada numa unidade só durante o teste e a retira depois.
- **Fora da janela e fim do plantão.** Cada conta está nos três turnos, então esses casos (D01 e D02) só acontecem se o gestor abrir uma vaga, como já diz a pré-condição.
- **Super admin.** `admin.f5` é admin da organização. O super admin (chaves da API e ligar o módulo pela tela) continua sendo a conta do RT.

## Resultado da execução (06 e 07/11/2026, homologação)

Os 30 cenários rodaram pelo banco, na homologação, como cada usuário de teste. A produção não foi tocada. Nada foi corrigido durante a execução, exceto o achado do A01 que o RT mandou corrigir (PR #482). As telas ficam para a conferência no Chrome.

| Bloco | Relatório | P0 | P1 | P2 de produto |
|---|---|---|---|---|
| A01 | `EXECUCAO-A01.md` | 0 | 2 (resolvidos pelo ambiente) | 3; um corrigido no #482 |
| A02–A06 | `EXECUCAO-A02-A06.md` | 0 | 0 | 3 |
| B01–B06 | `EXECUCAO-B01-B06.md` | 0 | 1 | 2 |
| C01–C06 | `EXECUCAO-C01-C06.md` | 0 | 0 | 2 |
| D01–D12 | `EXECUCAO-D01-D12.md` | 0 | 1 | 2 |

### Achados para o RT decidir a ordem (do mais grave)
1. **D P1-1, privacidade, provável também na produção.** Quem está escalado no último setor do paciente lê o prontuário encerrado sem pedido de acesso, sem prazo e em qualquer papel. No teste, o farmacêutico leu um prontuário encerrado 3 dias antes. Causa: `pacientes.setor_id` continua preenchido depois do encerramento, e `paciente_em_cuidado_no_plantao` aceita esse vínculo. Na UBS, todo profissional escalado lê qualquer cadastro.
2. **B P1-1, faturamento.** Quando a observação vira internação na UPA, a conta de internação não abre. O gatilho da conta só olha a mudança direta em `internado_em`, e nessa conversão o campo é preenchido por outro gatilho. No B01, a AIH aprovada (0303010037) ficou fora de qualquer conta.
3. **Segunda dose "Agora" recusada (A01 P2-1 e A P2-1).** A regra "um item por medicamento e via" recusa a repetição da epinefrina na anafilaxia pediátrica e o ataque mais manutenção do magnésio. Pergunta ao RT.
4. **B P2-1.** `alertas_sepse` só vale para menores de 14 anos; o adulto séptico não aparece para o gestor.
5. **B P2-2.** O médico da porta encerra a observação que abriu (#482), mas não pede parecer nem marca reavaliação. Pergunta ao RT.
6. **A P2-2.** Prescrição, dispensação e checagem aceitas com o paciente ainda na triagem. Pergunta ao RT.
7. **A P2-3.** A enfermagem dispensa com justificativa mesmo com o farmacêutico de plantão.
8. **D P2-1.** O check-out não fecha a porta; ela segue aberta até 20 min depois do fim do plantão.
9. **D P2-2.** Uma troca cancelada ou recusada não pode ser pedida de novo: o erro de unicidade chega cru à tela.
10. **C P2-C1.** A remuneração de plantão não guarda autor nem auditoria.
11. **C P2-C2.** A execução de APAC aceita competência e data no futuro.
12. **Já previstos e confirmados:** o óbito não cancela a regulação em curso (D07); o prazo da regulação só gera aviso (B06); `rascunho`, `agendada` e `excluida` não têm função que grave (B06).

As correções do A01 (P1-1, P2-1, P2-2) têm diagnóstico próprio em `CORRECOES-A01-DIAGNOSTICO.md`, à espera da decisão do RT. Os P3 (catálogo, MAPA, ambiente e pontos menores) estão em cada relatório.

### O que ficou gravado na homologação
Estoque negativo de alguns medicamentos na UPA F5; leitos em higienização (OA-03, INT-01 a INT-03); CM-03 ocupado pela internação do B03; o recém-nascido do A06 internado; a internação do B01 sem conta; uma teleinterconsulta do B05 aberta; valores fictícios de remuneração na UPA F5; a rede "UPA Bloco D" com 11 contas `*.d.f5`. Cada relatório lista o seu.

## Achados de produto que os cenários já apontam (a confirmar na execução)
São candidatos a correção. Nada foi corrigido: entram no relatório da tarefa 3, e o RT decide a ordem.
1. **Obstetrícia:** não há ferramenta própria de pré-eclâmpsia/eclâmpsia nem fluxograma obstétrico na triagem. O sulfato de magnésio fica dentro de `adulto-emergencia-hipertensiva` (A01, A02).
2. **Óbito:** o óbito não cancela a regulação em curso. O regulador ou a origem precisam encerrá-la à mão (D07).
3. **Chegada regulada:** a chegada regulada não cria internação no destino (A01, B03).
4. **Dupla checagem:** existe no banco, mas não tem tela (`conferir_alta_vigilancia`) (A05, C04).
5. **Remuneração de plantões:** o turno "madrugada" cai no valor genérico. O fracionado de 12 h em "manhã" usa base de 360 minutos (C05).
6. **SLA da regulação:** só alerta. `cancelamento_origem='prazo'` nunca é gravado (B06).
7. **Status sem RPC:** `rascunho`, `agendada` e `excluida` (B06).
8. **A provar:** se `leitos_para_ocupar` oferece o leito reservado pela regulação (B03) e se `finalizar_observacao` gera a contrarreferência à UBS (A01).
9. **Valores na conta:** medicamento, material, exame, transporte, diária e parecer entram sem valor. É o desenho atual (só SIGTAP tem valor), e os cenários conferem isso.
