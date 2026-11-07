# Prontuário encerrado aberto "pela escala": diagnóstico (D P1-1)

Achado P1-1 do teste da rede (D10, `EXECUCAO-D01-D12.md`), diagnosticado em 07/11/2026. Nada foi corrigido: as decisões P1 a P4 estão no fim, à espera do RT.

## 1. O que acontece
- **No teste:** o farmacêutico escalado no PS da UPA F5 abriu o prontuário de uma paciente que tinha **todos os atendimentos encerrados havia 3 dias**. O técnico da UBS não conseguiu pedir acesso, porque o sistema respondeu "Você já tem acesso a este paciente pela escala".
- **Regra desenhada:** é a da migration `20261119000001_desfecho_encerra_cuidado` (decisão do RT de 11/10/2026).
  - A escrita do cuidado vale **só com o atendimento ou a internação aberta**.
  - A leitura vale para a equipe do setor por **24 h** depois da alta.
  - Depois disso, o acesso é **só pelo pedido ao gestor**.
  - O farmacêutico não lê nem pede (`20270105000001`).

## 2. Causa
`private.paciente_em_cuidado_no_plantao` tem duas condições. A segunda (internação aberta no setor da escala) está certa. A primeira é esta:

```sql
SELECT 1 FROM public.pacientes pa
 WHERE pa.id = p_paciente
   AND pa.setor_id IN (SELECT private.setores_na_escala_agora())
```

- **O campo não é limpo:** `pacientes.setor_id` é o "setor onde o paciente está". A ficha da recepção o preenche, e a alta da **internação** o limpa. A alta da **porta** não limpa, nem a evasão, a alta a pedido, o óbito na porta ou a consulta da UBS encerrada. O cadastro fica com o último setor para sempre.
- **O efeito se espalha:** quem está escalado naquele setor passa a "cuidar" do paciente sem prazo e em qualquer papel. `paciente_em_cuidado_no_plantao` alimenta `paciente_no_meu_plantao`, que alimenta `pode_atuar_no_paciente`. A janela de 24 h e o pedido de acesso ficam sem efeito para quem é do mesmo setor.
- **Na UBS** (um consultório só), todo escalado lê todo cadastro.

### Alcance
- **Dependentes, na homologação:**
  - `paciente_em_cuidado_no_plantao`: 24 funções e 6 políticas (prescrição, itens, observação);
  - `paciente_no_meu_plantao`: 18 funções e 24 políticas de leitura (alergias, exames, SAE, balanço, administrações, pendências e outras);
  - `pode_atuar_no_paciente`: 64 funções, entre elas `abrir_prontuario`, `pedir_acesso_prontuario`, `impressoes_do_prontuario` e `solicitar_teleinterconsulta`, e 8 políticas (AIH, APAC, dispensações, pareceres e outras).
- **O furo vale para leitura e para escrita.** As políticas de prescrição e observação usam a primeira função.
- **Produção (só metadados):** as duas funções têm a mesma lógica da homologação; a diferença de md5 é só o fim de linha (CRLF). **Hoje nenhum cadastro está exposto**: 7 cadastros e 0 com setor preenchido sem atendimento ou internação aberta. O furo aparece no primeiro atendimento encerrado na porta, quando a UPA Centro ganhar equipe.
- **Homologação:** 190 cadastros, 50 expostos (13 na UBS).
- **Fora do problema:** pré-natal, hiperdia e puericultura usam regra própria (papel na UBS), não esta função. Os painéis dos programas não mudam com a correção.

### Conferências que sustentam a correção
- **Cadastro e atendimento aberto andam juntos.** Na homologação, todo paciente com atendimento aberto tem um atendimento aberto **no mesmo setor** do cadastro (0 divergências). Trocar "setor do cadastro" por "atendimento aberto no setor" não muda nada para quem está em cuidado.
- **Etapa e data são coerentes:** nenhum episódio "encerrado" está sem data, e nenhum com data está sem a etapa "encerrado".
- **Atendimento esquecido aberto continua dando acesso**, porque o paciente segue "em cuidado". Na homologação há 38 episódios abertos há mais de 24 h, sobras dos testes. O gestor já os vê em "atendimentos sem desfecho". Ver P4.

## 3. Decisões para o RT

### P1. Como fechar
- **A (recomendada):** em `paciente_em_cuidado_no_plantao`, trocar a condição do cadastro por **"atendimento aberto (`episodios.encerrado_em IS NULL`) num setor da minha escala"**.
  - É uma função só, e a fonte da verdade passa a ser o atendimento.
  - Nenhuma tela ou RPC muda, e não há dado a corrigir.
  - Só expande, sem DROP. O rollback é a definição anterior.
- **B:** manter a condição e limpar `pacientes.setor_id` em todo desfecho que tira o paciente (porta, UBS, evasão, óbito, alta a pedido, transferência), mais uma limpeza dos cadastros atuais.
  - São várias funções.
  - Cada caminho novo de encerramento que esquecer de limpar reabre o furo.

### P2. A equipe da UBS entre uma consulta e outra
- **A (recomendada):** a mesma regra da rede.
  - O prontuário completo abre com a consulta aberta, nas 24 h depois dela, ou pelo pedido ao gestor.
  - Os painéis do pré-natal, do hiperdia e da puericultura continuam como estão, pela regra própria.
- **B:** o médico e o enfermeiro da UBS leem os cadastros da própria UBS sem pedido, como vínculo da atenção primária, com o log de leitura que já existe. O técnico e os outros papéis seguem pela regra A.

### P3. Quando vai à produção
- **A (recomendada):** logo depois da homologação, com o seu "ok produção" para a migration. Hoje não há cadastro exposto, mas o furo aparece no primeiro plantão real.
- **B:** junto com o próximo lote de correções.

### P4. Atendimento esquecido aberto
- **A (recomendada):** fica como está. Aberto é "em cuidado", e o gestor já vê os atendimentos sem desfecho. Isso fica registrado no documento da correção.
- **B:** limitar o acesso pela escala a atendimentos abertos há menos de N horas.

**Decisão do RT (07/11/2026): A em P1, P2, P3 e P4.**

## 4. Plano com A em P1 a P4
1. **Teste primeiro** (`supabase/tests/fix_privacidade_encerrado.sql`), em transação desfeita na homologação. Ele cobre:
   - o farmacêutico do PS **não** abre o prontuário de quem foi encerrado há 3 dias;
   - o técnico da UBS **consegue** pedir acesso a um cadastro sem consulta aberta;
   - com atendimento aberto no setor, a equipe lê e prescreve como hoje;
   - até 24 h depois do encerramento, a equipe do setor lê, e depois disso não;
   - internação aberta continua valendo;
   - o gestor continua lendo;
   - o pedido aprovado abre por 24 h.
2. **Migration** `<data>_encerrado_sem_escala.sql`: `CREATE OR REPLACE` de `private.paciente_em_cuidado_no_plantao` com a nova condição, com o rollback escrito no cabeçalho.
3. **Homologação:** aplicar com a versão registrada, rodar o teste e repetir o D10 (`scripts/e2e/89_cenario_d10.sql`) esperando os passos D10.08 e D10.11 **ok**.
4. **PR próprio** (`correcoes/privacidade-encerrado`). Depois, o "ok produção" e o push com md5 conferido.
5. **Telas:** nenhuma muda. A conferência no Chrome é o pedido de acesso do técnico da UBS e o "sem acesso" do Prontuário completo para quem não cuida mais.

**Critério de aceite:** o D10 sem falhas, o teste novo verde, e o CI verde (`banco` inclui os testes antigos de acesso).

**Riscos:** um fluxo que dependa de ler o paciente depois do encerramento sem pedido para de funcionar. Os candidatos são documentos tardios depois das 24 h e a AIH de alta antiga. Esses casos já deveriam passar pelo pedido, pela regra de 11/10, e o teste da rede (bloco C) entra como regressão.

## 5. Feito (07/11/2026)
- **Teste** `supabase/tests/fix_privacidade_encerrado.sql`, com 13 conferências.
  - Antes da migration, falhou na primeira: "médico da porta não atua no paciente encerrado há 3 dias".
  - Com a migration, passou inteiro, em transação desfeita na homologação.
- **Migration** `20270306000001_encerrado_sem_escala.sql`, um `CREATE OR REPLACE` de `private.paciente_em_cuidado_no_plantao`, com as mesmas permissões e o rollback no cabeçalho.
  - Aplicada na homologação com a versão registrada.
  - md5 da função: `fe799c2a8a753743ad4ac5f097d32d84`.
- **D10 repetido na homologação**, com as contas F5, em transação desfeita:
  - dos 26 cadastros encerrados há mais de 24 h (18 da UPA e 8 da UBS), o farmacêutico, o médico e o enfermeiro da UPA e o técnico, o médico e o enfermeiro da UBS atuam em **0**. Antes eram todos;
  - **D10.08:** o pedido de acesso do técnico da UBS é **aceito**;
  - **D10.11:** o farmacêutico que tenta abrir o prontuário encerrado recebe "Acesso negado: paciente fora dos setores do seu plantão".
- **Falta:** o "ok produção" da migration e a conferência na tela (pedido do técnico da UBS e "sem acesso" no Prontuário completo).
