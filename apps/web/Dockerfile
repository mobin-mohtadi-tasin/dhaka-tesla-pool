FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/web apps/web
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build -w @dtp/web
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@dtp/web"]
