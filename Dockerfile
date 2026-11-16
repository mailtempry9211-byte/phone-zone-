FROM node:20-bookworm-slim

# Install system dependencies required for native C++ modules (better-sqlite3, sharp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install root dependencies
RUN npm install

# Install backend dependencies (builds better-sqlite3 cleanly with g++/make/python3)
RUN cd backend && npm install

# Copy application source
COPY . .

# Build Vite frontend
RUN npm run build

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "backend/src/server.js"]
