FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock .env.schema ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
# Varlock validation happens here
RUN bun run build

# Production image
FROM base AS release
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.env.schema ./.env.schema

# TanStack Start / Vinxi production port
EXPOSE 3000

# Start using the Vinxi production server
CMD ["bun", ".output/server/index.mjs"]
