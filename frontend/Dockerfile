# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests + .npmrc (retry/timeout tuning) first so this layer
# is cached unless deps change.
COPY package*.json .npmrc ./

# We use `npm install` (not `npm ci`) on purpose: `npm ci` is strict
# about platform-specific optionalDependencies (e.g. @esbuild/<arch>),
# and a single lockfile produced on macOS can be incomplete for the
# linux/arm64 build that runs inside Docker. `npm install` resolves
# the right binaries per-platform automatically. Retries/timeouts are
# tuned in .npmrc to make this resilient to transient registry blips.
RUN npm install

# Copy the rest of the source
COPY . .

# VITE_API_URL is baked into the bundle at build time (see src/lib/apiConfig.ts).
# For testing/production, pass the real API URL as a build-arg — do not rely on localhost.

ARG VITE_API_URL=http://localhost:5001/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy compiled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing + caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
