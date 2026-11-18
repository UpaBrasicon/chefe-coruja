# U13: painel e indicadores do gestor da UBS (plano, 18/11/2026)

Decisão U13 = A do diagnóstico (`docs/ubs/PERCURSO-UBS-DIAGNOSTICO.md`, achados GE1, GE5 e GE6): o Painel do Gestor e os Indicadores da UBS passam a ser ambulatoriais.
- Saem as abas de hospital.
- Entram as seis frentes de gestão e os indicadores C1 a C7 da SAPS, pelas notas metodológicas vigentes, com a fonte citada.

**Nada foi implementado.**

## Fonte conferida

As notas metodológicas C1 a C7 da SAPS/MS para eSF e eAP foram conferidas no texto em 18/11/2026. São as versões de junho de 2026, que revogam as anteriores. Também a NT 8/2026-DEAPS/SAPS/MS, que trata da avaliação e da nota final. Página: gov.br/saude → SAPS → fichas técnicas → equipe de atenção primária e saúde da família.

| Indicador | Fórmula | No app |
|---|---|---|
| **C1 Mais acesso** | Atendimentos de demanda programada (consulta agendada programada, cuidado continuado, consulta agendada) ÷ todos os atendimentos (programada + espontânea: escuta inicial, consulta no dia, urgência), de médico e enfermeiro. Ótimo > 50% e ≤ 70%; acima de 70% é regular | Calculável: o tipo de atendimento já é registrado |
| **C2 Criança até 2 anos** | Média de pontos (A a E, 20 cada) | Painel da puericultura. Fora do app: visitas do ACS (D) e vacinas (E) |
| **C3 Gestação e puerpério** | Média de pontos (A = 10; B a K = 9 cada) | Painel do pré-natal. Fora do app: ACS (E, J), dTpa (F) e saúde bucal (K) |
| **C4 Diabetes** | Média de pontos (consulta 20, pressão 15, peso e altura 15, ACS 20, HbA1c 15, pés 15) | Painel do hiperdia. Fora do app: ACS |
| **C5 Hipertensão** | Média de pontos (consulta, pressão, peso e altura, ACS; 25 cada) | Painel do hiperdia. Fora do app: ACS |
| **C6 Pessoa idosa (60+)** | Média de pontos em 12 meses: consulta de médico ou enfermeiro 25, peso e altura no mesmo dia 25, 2 visitas do ACS 25, vacina da influenza 25 | **Novo.** Consulta e peso e altura calculáveis; ACS e vacina fora do app |
| **C7 Mulher, prevenção do câncer** | Soma de quatro partes, cada uma com sua faixa: colo do útero 25 a 64 anos (exame em 36 meses, ou DNA-HPV em 60) × 20; vacina HPV em meninas de 9 a 14 anos × 30; saúde sexual e reprodutiva de 14 a 69 anos em 12 meses × 30; mamografia de 50 a 69 anos em 24 meses × 20 | **Novo.** Colo, saúde sexual e reprodutiva e mamografia calculáveis; vacina HPV fora do app |

- **Classificação de C2 a C7:** ótimo > 75, bom > 50, suficiente > 25, regular ≤ 25.
- **Nota final (NT 8/2026):**
  - cada conceito vale um peso: regular 0,25; suficiente 0,50; bom 0,75; ótimo 1;
  - cada indicador tem um peso: C1, C4, C5 e C6 = 1; C2, C3 e C7 = 2;
  - total de 10.
- **C7, saúde sexual e reprodutiva:** a nota lista os CIAP-2 e os CID-10 que contam; o app usa a mesma lista. Exemplos de CIAP-2: W02, W10 a W15, X01 a X13. Exemplos de CID-10: N91 a N95, Z30, Z31 e Z70.

## O que o app tem hoje

- **Painel do Gestor na UBS:** só as abas Agora e Equipe em plantão. As de internação, giro e porta já saem.
- **Indicadores** (`/indicadores`): página de hospital e UPA (censo, ocupação, espera da porta). Não diferencia a UBS.
- **Dados disponíveis para as seis frentes:**
  - **Produção:** consultas por tipo de atendimento e por quem atendeu; escutas por cor.
  - **Agenda:** marcadas, presentes, faltas e grade.
  - **Espera:** chegada, escuta e consulta.
  - **Medicamentos:** dispensações, estoque crítico e faltas; administração registrada nos procedimentos.
  - **Rede:** envios à UPA, regulação e retornos.
  - **Vigilância:** notificações compulsórias pendentes.

## Plano em PRs

1. **Indicadores APS (C1 a C7)**
   - Aba nova no Painel do Gestor da UBS.
   - Para cada indicador: o resultado no app, a classificação, a fonte e o que fica fora do app.
   - A nota final estimada, com os pesos da NT 8/2026.
   - C1, C6 e C7 por função nova no banco. C2 a C5 pelas regras que já existem nos painéis.
2. **Gestão ambulatorial**
   - Aba com as seis frentes, por período e por profissional.
   - Na UBS, a página Indicadores mostra a versão ambulatorial, sem censo, ocupação nem porta.
3. **Faturamento da UBS**
   - O menu de faturamento de porta e internação sai do gestor da UBS.
   - A exportação ao SISAB fica para o U15.

## Decisões para o RT

**G1. Itens que o app não registra** (visita do ACS, vacinas, saúde bucal)
- **A:** mostrar dois números. O primeiro é o resultado do que o app registra, sobre o teto do app. O segundo é a estimativa do Ministério, em que esses itens contam zero.
- **B:** só o resultado sobre o teto do app.

**G2. Quem conta como médico e enfermeiro em C1, C6 e C7**
- **A:** pelo papel na unidade (médico ou enfermeiro). Fica a nota de que o Ministério usa o CBO, que nem todo perfil tem no app.
- **B:** só quem tem CBO no perfil (médico 2251, 2252, 2253 ou 2231; enfermeiro 2235).

**G3. Quem é da UBS (denominador de C2 a C7)**
- **A:** o paciente com cadastro ativo na UBS. Fica a nota de que o Ministério usa o vínculo da Portaria SAPS 161/2024, que o app não tem.
- **B:** só quem teve ao menos uma consulta na UBS nos últimos 24 meses.
