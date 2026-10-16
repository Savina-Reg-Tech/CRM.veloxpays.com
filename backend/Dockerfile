# ─────────────────────────────────────────────────────────────
#  Velox-CRM — Backend
#  Build context: ./backend  (contains node-crm/ and database/)
# ─────────────────────────────────────────────────────────────
# Node 22 LTS (Node 20 reached end of life in April 2026).
FROM node:22-alpine

# Install dumb-init + wget for downloading the disposable email blocklist
RUN apk add --no-cache dumb-init wget

WORKDIR /app

# Copy package files + .npmrc (retry/timeout tuning) first for better
# layer caching.
COPY node-crm/package*.json node-crm/.npmrc ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the Express application source
COPY node-crm/ .

# Download the authoritative disposable-email blocklist from GitHub.
# Saved to /app/data/ so spamService.js can load it at startup.
# If the download fails (no internet during build), the file simply won't
# exist and spamService falls back to the npm package list.
RUN mkdir -p /app/data && \
    wget -q -O /app/data/disposable_email_blocklist.conf \
      "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf" \
    && echo "Downloaded $(wc -l < /app/data/disposable_email_blocklist.conf) domains from GitHub blocklist" \
    || echo "WARNING: Could not download blocklist — falling back to npm package list"

# Copy database folder (migrations + seeds) so the seed script
# can be run inside the container:
#   docker compose run --rm seed
COPY database/ ./database/

# Run as the image's unprivileged `node` user, not root. It only needs to write local-disk
# uploads (dev / ALLOW_LOCAL_STORAGE); everything else in /app stays read-only to it.
# COPY keeps the build machine's file modes, so make the app readable regardless of them.
RUN chmod -R a+rX /app && mkdir -p /app/uploads && chown node:node /app/uploads
USER node

EXPOSE 5002

# Use dumb-init as PID 1 to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
