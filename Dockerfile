# Build Stage
FROM node:18-slim as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage
FROM node:18-slim
WORKDIR /app

# Copy Backend
COPY server/package*.json ./server/
RUN cd server && npm install --production

COPY server ./server
# Copy env file
COPY .env.production .env

# Copy Frontend Build
COPY --from=build /app/dist ./dist

# Environment Variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/trackmaster.db

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server/index.js"]
