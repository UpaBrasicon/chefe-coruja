# F7 — Aviso "pensar em sepse" no atendimento — diagnóstico

Pedido do RT em 17/11/2026: quando o CID é de quadro infeccioso e o NEWS2 da triagem está aumentado, aparece um aviso de "pensar em sepse", com os exames para fechar o diagnóstico. Vale na urgência e na UBS. É a F7 do item "Ferramentas pelo CID" (`docs/clinico/CID-FERRAMENTAS-CELULAR-DIAGNOSTICO.md`).

O que já está decidido:
- **Exceção à regra de conduta.** O RT liberou o aviso como exceção à regra "nada sugere conduta" da aba Atendimento, só para ele.
- **Vitais.** Valem os das últimas 6 h (decisão do RT).
- **Condições da sessão de obrigatórios legais:**
  - mesma regra e mesma ficha do alerta de sepse do adulto;
  - texto "Pode ser sepse. Considere: <exames com fonte e página>. A decisão é do médico.", sem cor, sem a palavra "diagnóstico" e sem exame pré-marcado;
  - só para 14 anos ou mais;
  - registro de quando o aviso apareceu e de quando foi dispensado, numa tabela só de inserção;
  - pode ser desligado por unidade;
  - testes.

**Decisão do RT em 17/11/2026:** AV1 a AV8 = A ("Todas A"). Começa pela migration (função compartilhada, RPC e tabela de registro), com o teste de regressão do alerta da internação, na homologação.

## 1. Como está hoje

### O alerta de sepse do adulto (internação)
- **Onde roda:** só no banco, em `public.alertas_sepse(p_unidade)` (migration `20270405000002`). A decisão é A do RT, de 11/11/2026 (`docs/teste-rede/SEPSE-ADULTO-ALERTA-DIAGNOSTICO.md`).
- **Regra:** 14 anos ou mais, gatilho de infecção e NEWS2 de 5 ou mais.
  - **Gatilho de infecção** (`private.gatilho_infeccao`): suspeita marcada pelo médico, ou um CID da lista de infecção no SOAP registrado do episódio ou no CID principal da internação.
  - **NEWS2** (`private.calcular_acuidade`): vitais das últimas 24 h, de qualquer episódio. Ele soma mesmo o NEWS2 parcial.
  - **Níveis:** 5 e 6 dão "rastreio"; 7 ou mais dão "alto".
- **Quem é olhado:** só pacientes com internação ativa. O paciente da porta nunca entra.
- **Ficha:** `sepse-adulto` (2026-11-16.1, aguardando aprovação). As fontes são Sepsis-3, SSC 2026 e ILAS jul/2026, entre outras.
  - A regra "NEWS2 de 5 ou mais" está no SQL e no documento de decisão, mas não na ficha.

### O NEWS2 na porta
- **Já calculado:** o servidor calcula a acuidade (`public.acuidade`), que é o NEWS2 de 14 anos em diante. O cabeçalho do paciente na janela de atendimento já mostra esse valor.
- **Vitais da triagem:** a classificação de risco e a escuta da UBS gravam os vitais em `observacao`.
  - **A triagem não registra O₂ suplementar nem nível de consciência.** Por isso o NEWS2 só da triagem sai sempre parcial: faltam até 5 pontos.

### CID infeccioso
- **Lista existente:** `public.cid_infeccao_regras`, com 27 faixas. Já é usada pelo alerta da internação e pelo Phoenix da criança.
- **O que a lista cobre:**
  - doenças infecciosas e parasitárias (A00–B89, B95–B99);
  - infecções do SNC (G00–G07);
  - otite e mastoidite (H66, H70);
  - endocardite (I33);
  - infecções respiratórias (J00–J06, J09–J18, J20–J22, J36, J85–J86);
  - apendicite, abscesso anal e peritonite (K35, K61, K65);
  - pele (L00–L08);
  - artrite piogênica e osteomielite (M00–M01, M86);
  - pielonefrite, cistite e ITU (N10, N30.0, N39.0);
  - perinatais (P35–P39);
  - infecções de dispositivo e de procedimento (T80–T85).
- **Fora da lista:** R57 e R65.
- **Lacunas do gatilho de hoje:**
  - ele lê só o CID do SOAP registrado. O rascunho e os problemas da Conduta da UBS não entram;
  - na UBS, os CIDs dos problemas vão para `registrar_conduta_aps`, não para `atendimento_registros`.

### Exames com fonte já lida no app
- **Lactato:** SSC 2026, rec. 51 e 52, p. 39–40; ILAS jul/2026, p. 8 e 14 (lactato na 1ª hora; 2ª medida em 4 h se acima de 2 vezes o normal). Já está no guia da `sepse-adulto`.
- **Disfunção orgânica:** ILAS jul/2026, p. 3, lista creatinina, PaO₂/FiO₂, plaquetas, bilirrubinas e lactato (já em `ressuscitacaoVolemica.ts`).
- **Hemoculturas:** o app não tem fonte lida para o adulto. Só existe o texto pediátrico da SSC pediátrica. Para entrar, é preciso ler a SSC 2026 e o ILAS e subir a versão da ficha.

### Desligar por unidade
- **Camada que existe:** `ferramenta_unidade.oculta`. O gestor desliga, com motivo e auditoria, por `definir_ferramenta_unidade`.
- **Efeito de ligar o aviso a `sepse-adulto`:** desligar o aviso suspende também a calculadora de sepse da Central, porque o id é o mesmo.

## 2. Decisões para o RT (A recomendada)

**AV1 — Mesma regra**
- A) Uma função do servidor só, compartilhada com a internação: gatilho de infecção mais NEWS2 de 5 ou mais. Na porta, a janela dos vitais é de 6 h e restrita ao episódio atual; na internação continua em 24 h. O critério é o mesmo, e só o "vital recente" muda, pela sua decisão.
- B) Passar a internação também para 6 h, para a regra ficar idêntica. Isso muda o alerta que já está no ar.

**AV2 — Qual CID conta como infeccioso**
- A) A lista do banco que o alerta da internação já usa (`cid_infeccao_regras`). Vale também o CID do rascunho e os problemas da Conduta da UBS: a tela manda os códigos para o servidor conferir na lista, sem gravar nada. A "suspeita marcada" continua valendo, como na internação.
- B) Uma lista nova, só da porta. Fica diferente da internação, o que a sessão legal não recomenda.

**AV3 — NEWS2 parcial da triagem**
- A) Dispara com 5 ou mais mesmo parcial, como na internação, e o aviso diz "NEWS2 parcial: sem O₂ e consciência".
- B) Só com o NEWS2 completo. Na porta, quase nunca dispararia, porque a triagem não registra O₂ nem consciência.

**AV4 — Exames do aviso**
- A) "Pode ser sepse. Considere: lactato (SSC 2026, rec. 51–52, p. 39–40; ILAS, p. 8 e 14) e os exames de disfunção orgânica que o ILAS lista (creatinina, plaquetas, bilirrubinas, PaO₂/FiO₂; ILAS, p. 3). A decisão é do médico." As hemoculturas entram depois da leitura da SSC 2026 e do ILAS, com a versão da ficha subindo.
- B) Só o lactato.

**AV5 — Desligar por unidade**
- A) Pela ficha `sepse-adulto`, como pediu a sessão legal ("mesma ficha"). Desligar suspende o aviso e a calculadora juntos.
- B) Um item próprio na camada da unidade, "Aviso de sepse no atendimento", que desliga só o aviso. A regra continua a da `sepse-adulto`.

**AV6 — Registro**
- A) Tabela nova, só de inserção, `avisos_sepse_atendimento`, com:
  - episódio, paciente e unidade;
  - evento (exibido ou dispensado);
  - NEWS2 e se era parcial;
  - CID;
  - autor (login), hora e motivo opcional.

  O RLS é o da observação: gestor ou paciente no meu plantão, com segundo fator. A escrita é só por RPC. O "exibido" grava uma vez por episódio e nível. É também o dado do SP1.
- B) Só a auditoria geral, sem tabela própria.

**AV7 — Onde e como aparece**
- A) Na aba Atendimento (urgência e UBS), junto do bloco "Ferramentas para este CID", e na Conduta da UBS. Visual neutro, sem cor. Botões:
  - "Abrir sepse (adulto)", que abre a janela da F3;
  - "Dispensar", com motivo opcional.
- B) Só no cabeçalho do paciente.

**AV8 — Idade**
- A) Só 14 anos ou mais. Abaixo disso, continua o aviso pediátrico que já existe (`SepsePorta`, PEWS e Phoenix).
- B) Outro corte.

## 3. Banco, servidor, permissões e auditoria
- **Migration (expand):**
  - `private.sepse_adulto_regra(paciente, desde)` com a regra atual;
  - `alertas_sepse` passa a chamá-la, sem mudar o resultado (teste de regressão);
  - RPC `aviso_sepse_atendimento(p_episodio, p_cids text[])`, só leitura: devolve o nível, o NEWS2, se é parcial e o CID que disparou;
  - tabela `avisos_sepse_atendimento`, com a RPC `registrar_aviso_sepse(p_episodio, p_evento, p_motivo)`.
- **Permissão:** só lê e grava quem pode atender o episódio (médico na porta ou na UBS), com segundo fator.
- **Rollback escrito.** Os testes de banco vão para `supabase/tests`.

## 4. Testes e critérios de aceite
- A criança nunca recebe o aviso.
- Sem vitais nas últimas 6 h do episódio, não há aviso.
- NEWS2 de 4 não dispara; NEWS2 de 5 com CID da lista dispara.
- O resultado do `alertas_sepse` da internação é o mesmo de antes (regressão).
- O texto não tem cor nem a palavra "diagnóstico", e não marca nem pede exame.
- Dispensar grava autor, hora e motivo; "exibido" não se repete no mesmo episódio e nível.
- Desligado na unidade, o aviso não aparece.

## 5. Riscos
- **Falso alarme por NEWS2 parcial.** Por isso o aviso diz "parcial" e o registro mede disparos e dispensas (SP1).
- **Regressão no alerta da internação.** Por isso o teste compara antes e depois.
- **Exame sem fonte.** Por isso as hemoculturas só entram depois da leitura e da versão nova da ficha.

## 6. Ordem
Migration e teste de banco → RPC e regressão → aviso na tela e registro → homologação → "ok produção" → aprovação da versão da ficha, se o texto do aviso entrar na `sepse-adulto`.
