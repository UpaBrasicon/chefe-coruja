# Painel do Chefe Coruja no Power BI: passo a passo

Este roteiro é para a secretaria de saúde. O painel lê leitos, atendimentos e produção SUS pela API do Chefe Coruja. Ele **não é ao vivo**: atualiza nos horários agendados, até 8 vezes por dia no Power BI Pro.

## 1. Pedir a chave
1. A administração do Chefe Coruja cria uma chave em **Integrações (API)**, com:
   - **Recursos:** atendimentos, leitos e produção, sem pacientes;
   - **Unidades:** as que a secretaria acompanha;
   - **IPs:** o IP fixo do computador do gateway (passo 5). Pode ficar para depois.
2. A chave começa por `cc_live_` e aparece **uma vez só**. Guarde-a como senha.

## 2. Colar as consultas no Power BI Desktop
1. Abra **Transformar dados**. Em **Gerenciar parâmetros**, crie três parâmetros (o modelo está em `00-Parametros.txt`):

   | Parâmetro | Tipo | Valor |
   |---|---|---|
   | `CorujaBase` | Texto | `https://api.chefecoruja.com.br` |
   | `CorujaChave` | Texto | a chave do passo 1 |
   | `DiasParaTras` | Número | 90 |

2. Para cada arquivo `.pq` desta pasta:
   1. Crie **Nova fonte → Consulta nula**.
   2. Abra o **Editor avançado** e cole o conteúdo do arquivo.
   3. Dê à consulta o mesmo nome do arquivo.
3. Cole os arquivos nesta ordem: `CorujaLista`, `Unidades`, `Leitos`, `Atendimentos`, `AIH`, `APAC`, `Fechamentos` e `AtualizadoEm`.
4. Quando o Power BI pedir credencial para o endereço da API, escolha **Anônimo**. A chave já vai no cabeçalho.
5. Clique em **Fechar e aplicar**.

## 3. Montar o painel
- **Relações:** ligue `unidade_id` de cada tabela a `Unidades[id]`.
- **Hora da atualização:** ponha um cartão com `AtualizadoEm[atualizado_em]`, para todos saberem de quando são os números.
- **Paciente:** só aparece o id (pseudônimo), nunca o nome nem o CNS.

## 4. Publicar
- **Onde:** publique num workspace da secretaria.
- **Cuidado:** a chave fica **dentro do arquivo `.pbix`**. Não mande o arquivo por e-mail nem o deixe em pasta compartilhada. Para dar acesso, compartilhe o relatório publicado, não o arquivo.

## 5. Atualização agendada (gateway)
A API só atende quem está no Brasil, e o serviço do Power BI roda na nuvem da Microsoft. Por isso a atualização passa por um **gateway local**:
1. Instale o **gateway de dados local** (modo padrão) num computador da secretaria que fique ligado.
2. Vincule a fonte da API a esse gateway nas configurações do conjunto de dados.
3. Peça à administração do Chefe Coruja que ponha o IP fixo desse computador na lista de IPs da chave.
4. Agende a atualização nos horários de que a secretaria precisa.

## Se der erro
| Mensagem | O que fazer |
|---|---|
| 401 | Chave errada, vencida ou revogada. Peça outra |
| 403 | A unidade ou o recurso não está liberado na chave, ou o IP não está na lista |
| "limite por minuto" | A API limita as consultas por minuto. Tente de novo ou peça um limite maior |
| "fonte de dados dinâmica" | Não altere `Web.Contents` nas consultas: o endereço base precisa ficar em `CorujaBase` |
