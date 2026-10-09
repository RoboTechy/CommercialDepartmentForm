# =====================================================
# Multi-Stage Production Dockerfile for Commercial Portal
# Stage 1: Build the React + Vite application
# Stage 2: Serve with lightweight Nginx Alpine
# =====================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (leverage Docker layer caching)
COPY package.json ./
# If lockfiles exist, copy them
COPY bun.lock* package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Install all dependencies required for building the app
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Build the project (generates static production assets in /app/dist)
RUN npm run build

# ---- Stage 2: Production Nginx ----
FROM nginx:1.27-alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA routing and caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build artifacts from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port 80
EXPOSE 80

# Health check to ensure Nginx is serving traffic
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
