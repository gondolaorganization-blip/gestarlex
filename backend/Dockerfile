FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

RUN mkdir -p uploads

EXPOSE 3099

# Corre migraciones pendientes y luego levanta el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
