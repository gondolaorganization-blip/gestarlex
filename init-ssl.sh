#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-ssl.sh — Obtiene el certificado SSL inicial de Let's Encrypt
#
# Ejecutar UNA SOLA VEZ antes del primer `docker compose ... up`:
#   chmod +x init-ssl.sh
#   ./init-ssl.sh
# ─────────────────────────────────────────────────────────────────────────────

DOMAIN="gestarsoft.com"
EMAIL="gondola.organization@gmail.com"

set -e

echo "→ Creando directorios de certbot..."
mkdir -p certbot/conf certbot/www

echo "→ Levantando nginx en modo HTTP para el desafío ACME..."
# Levanta solo el servicio frontend (en modo HTTP, las rutas HTTPS fallarán
# porque no hay cert todavía — ignoramos ese error con || true)
docker compose -f docker-compose.prod.yml up -d frontend 2>/dev/null || true

# Pequeña pausa para que nginx arranque
sleep 3

echo "→ Solicitando certificado a Let's Encrypt para $DOMAIN y www.$DOMAIN..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "→ Recargando nginx con el certificado recién obtenido..."
docker compose -f docker-compose.prod.yml exec frontend nginx -s reload 2>/dev/null || true

echo ""
echo "✓ Certificado SSL obtenido correctamente."
echo "  Ahora puedes levantar el stack completo:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
