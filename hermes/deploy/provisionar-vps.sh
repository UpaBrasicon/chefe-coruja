#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HERMES — provisionar-vps.sh (rodar como root na VPS Ubuntu 24.04, 1x)
#
#   ssh root@IP_DA_VPS
#   bash <(curl -fsSL https://SEU-REPO/provisionar-vps.sh)   # ou copiar o arquivo
#
# Faz: atualiza o sistema, instala Docker + compose, firewall (UFW),
# fail2ban, cria o usuário 'hermes' e prepara a pasta de deploy.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

log() { echo -e "\n\033[1;32m==> $1\033[0m"; }

log "Atualizando o sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

log "Instalando dependências base..."
apt-get install -y ca-certificates curl gnupg ufw fail2ban git

log "Instalando Docker (via repositório oficial)..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

log "Criando usuário 'hermes' (sem senha — acesso via SSH por chave)..."
id -u hermes &>/dev/null || useradd -m -s /bin/bash hermes
usermod -aG docker hermes
mkdir -p /home/hermes/deploy
chown -R hermes:hermes /home/hermes/deploy

log "Configurando UFW (firewall)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Configurando fail2ban (SSH)..."
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 600
EOF
systemctl enable --now fail2ban

log "Ajustes de segurança do Docker..."
# (opcional) limite de logs do Docker para não encher o disco:
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker

log "PRONTO! Próximos passos:"
echo "  1. [SEU PC] copie a chave SSH para o usuário hermes:"
echo "     ssh-copy-id hermes@IP_DA_VPS"
echo "  2. Desative o login por senha do root (recomendado):"
echo "     sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config"
echo "     sudo systemctl restart ssh"
echo "  3. Copie os arquivos do hermes para /home/hermes/deploy e suba:"
echo "     docker compose -f docker-compose.prod.yml up -d --build"
