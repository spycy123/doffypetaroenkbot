# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install tools yang dibutuhkan untuk kompilasi modul native (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Salin file konfigurasi dependency
COPY package*.json tsconfig.json ./

# Install seluruh dependency (termasuk devDependencies untuk build TypeScript)
RUN npm ci

# Salin source code & file pendukung
COPY prompts/ ./prompts/
COPY src/ ./src/

# Compile TypeScript menjadi JavaScript di folder dist
RUN npm run build

# Hapus devDependencies agar ukuran node_modules menjadi ramping
RUN npm prune --production

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Salin file hasil build dan dependency produksi dari stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prompts ./prompts

# Siapkan folder data untuk file database SQLite dan beri hak akses penuh
RUN mkdir -p /app/data && chown -R 1000:1000 /app

USER 1000

# Port default untuk mode webhook
EXPOSE 3000

# Jalankan bot
CMD ["node", "dist/index.js"]
