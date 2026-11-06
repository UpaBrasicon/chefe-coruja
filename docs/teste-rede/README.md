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

## O que o RT precisa preparar antes da execução (tarefa 2)
Os cenários apontam faltas no ambiente de teste (rede F5 da homologação):
- **Contas que não existem:** telemedicina, técnico de enfermagem da UPA, administrador e papéis de rede. Sem elas, partes de B05, D03, D05, D08, D10 e D12 ficam de fora.
- **Regulador:** hoje só tem vínculo na Central. `decidir_aih`/`decidir_apac` exigem o papel na unidade da AIH/APAC (C02 e C03).
- **Hospital F5:** não tem recepção, gestor, faturamento nem NIR. A conta do hospital não fecha (A01, B03).
- **Perfis:** estão sem CNS/CBO, o que faz as críticas do faturamento caírem em "fora" (C01 a C03).
- **Unidades:** estão sem coordenadas, então o raio do check-in não barra ninguém (D03).
- **Escala:** cada conta está nos três turnos, então "fora da janela" só acontece se o gestor abrir uma vaga (D01 e D02).

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
