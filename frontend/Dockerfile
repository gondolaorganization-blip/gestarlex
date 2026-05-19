# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve con nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Borra la config por defecto de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia la config de GESTARLEX
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia el build de React dentro de /lex/ para que coincida con el base path
COPY --from=builder /app/dist /usr/share/nginx/html/lex

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
