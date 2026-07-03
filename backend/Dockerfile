# ─────────────────────────────────────────────────────────────
#  Velox-CRM — Backend
#  Build context: ./backend  (contains node-crm/ and database/)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine

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

EXPOSE 5002

# Use dumb-init as PID 1 to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
