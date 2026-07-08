FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    streamlink \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 sifttv \
    && adduser --system --uid 1001 sifttv
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/generated ./src/generated

RUN mkdir -p /app/node_modules/.prisma && \
    cp -r /app/src/generated/prisma /app/node_modules/.prisma/client 2>/dev/null; \
    mkdir -p /app/prisma && \
    chown -R sifttv:sifttv /app

USER sifttv
EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
