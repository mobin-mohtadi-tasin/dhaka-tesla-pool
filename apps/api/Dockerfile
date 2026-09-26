FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/api apps/api
RUN npm run db:generate -w @dtp/api && npm run build -w @dtp/api
EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate -w @dtp/api && npm run db:seed -w @dtp/api && npm run start -w @dtp/api"]
