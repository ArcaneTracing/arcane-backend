# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/data-source.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig*.json ./
COPY docker-entrypoint.sh ./

# Install all deps (including dev) for migration:run (uses ts-node)
RUN npm ci
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

# Don't copy .env — use docker run -e or compose env vars
# COPY .env .env  <-- remove this line

EXPOSE 8085

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
