FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /workspace

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY . .
RUN pnpm install
RUN pnpm --filter @crypto-dca/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@crypto-dca/web", "start"]
