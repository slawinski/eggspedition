# Use a specific, recent Bun version to satisfy Varlock (1.3.3+)
FROM oven/bun:1.3.11 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock .env.schema ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Varlock validation happens here during 'vite build'
# These variables must be provided in Coolify as "Build Time" variables
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG AUTH_SECRET
ARG BASE_URL
ARG NODE_ENV=production

RUN bun run build

# Production image
FROM base AS release
# Copy only the necessary files for runtime
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.env.schema ./.env.schema
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# Set environment to production
ENV NODE_ENV=production

# TanStack Start / Nitro production port
EXPOSE 3000

# Start script handles migrations and then boots the server
CMD ["bun", "run", "start"]
