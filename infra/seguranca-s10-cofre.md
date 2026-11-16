# S10 (H2) — cofre da cópia de 20 anos: sem sobrescrita e chave de leitura

Trilha de segurança, S10, decisão H2 = A do RT (16/11/2026). Diagnóstico: `docs/seguranca/S10-AREAS-ADIADAS-DIAGNOSTICO.md`.

O cofre é um bucket S3 na AWS (sa-east-1), com Object Lock em modo COMPLIANCE por 20 anos (`infra/guarda/README.md`). Este arquivo cobre o que muda **na AWS**. O que muda no código (`scripts/arquivo/`) vai no mesmo PR:
- todo envio manda `If-None-Match: *`;
- a restauração baixa a versão mais antiga de cada objeto e avisa se houver mais de uma.

## O problema

Com Object Lock, nenhuma versão é apagada, mas um envio novo na mesma chave cria uma **versão nova**, e o download padrão pega a mais recente. Quem tiver a chave `guarda-envio`, que fica no VPS, consegue:
- subir um índice e arquivos forjados por cima de uma guarda verdadeira, cifrados com a chave pública;
- fazer o restaurador abrir a cópia falsa;
- subir lixo que ninguém apaga por 20 anos, o que prende o custo.

## 1. Política do bucket: só grava chave nova

Na AWS: S3 → bucket do cofre → Permissions → Bucket policy. Acrescentar esta declaração, trocando `NOME-DO-BUCKET` pelo nome do bucket:

```json
{
  "Sid": "S10NaoSobrescreve",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::NOME-DO-BUCKET/*",
  "Condition": { "Null": { "s3:if-none-match": "true" } }
}
```

Com essa declaração, o S3 recusa qualquer envio que não traga o cabeçalho `If-None-Match: *`. Com o cabeçalho, ele recusa (412) quando a chave já existe. Resultado: nenhuma versão nova sobre uma guarda que já existe.

**Ordem obrigatória:**
1. Mesclar o PR do S10 (o código passa a mandar o cabeçalho).
2. Esperar a guarda da noite seguinte rodar com o código novo.
3. Aplicar a política.

Se a política vier antes do código novo, a guarda da noite falha, e o vigia avisa por e-mail.

**Conferir** pelo AWS CloudShell:
- `aws s3api put-object --bucket NOME-DO-BUCKET --key teste-s10/x --body /dev/null` sem o cabeçalho deve dar AccessDenied;
- com `--if-none-match '*'` numa chave nova, deve passar;
- na mesma chave de novo, deve dar 412.

A chave `teste-s10/x` fica presa pelo Object Lock, mas é vazia: custo desprezível.

**Volta:** apagar a declaração `S10NaoSobrescreve` da política.

## 2. Chave só de leitura para a restauração

Hoje a restauração usa a mesma chave de envio. Criar no IAM um usuário `guarda-leitura`, com acesso por chave, e esta política:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:ListBucketVersions"], "Resource": "arn:aws:s3:::NOME-DO-BUCKET" },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:GetObjectVersion", "s3:RestoreObject", "s3:GetObjectAttributes"], "Resource": "arn:aws:s3:::NOME-DO-BUCKET/*" }
  ]
}
```

A chave dessa conta fica **só com o RT**, no Bitwarden, e nunca vai ao VPS. Os comandos `baixar-guarda` e `abrir-guarda` passam a usá-la. A `guarda-envio` continua só no VPS.

**Volta:** desativar a chave do usuário `guarda-leitura`.

## Quem faz

Os dois passos são no console da AWS, com a conta do RT. Posso fazer pelo navegador logado do RT, com o ok dele para cada passo, ou o RT faz seguindo esta página. Em nenhum dos dois casos a chave nova passa pelo chat.
