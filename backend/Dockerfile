FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

RUN mkdir -p uploads

EXPOSE 3099

# Una sola definición del arranque de producción: el script start:prod del package.json
# (prisma db push + node src/index.js). Antes esta línea corría `migrate deploy`, lo que
# hacía que el contenedor se comportara distinto según por dónde se desplegara y podía
# fallar en bases cuyo historial de migraciones no está completo.
CMD ["npm", "run", "start:prod"]
