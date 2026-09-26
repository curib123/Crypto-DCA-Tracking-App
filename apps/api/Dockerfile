FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /workspace

ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

COPY . .
RUN pnpm install
RUN pnpm --filter @crypto-dca/core build
RUN pnpm --filter @crypto-dca/api build

EXPOSE 4000
CMD ["pnpm", "--filter", "@crypto-dca/api", "start"]
