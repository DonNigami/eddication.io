#!/bin/bash
# Docker image for DriverConnect Backend
# Usage: docker build -t driverconnect-backend .
#        docker run -p 3000:3000 -e GOOGLE_SHEETS_ID=... driverconnect-backend

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
EXPOSE 3000
CMD ["node", "server.js"]
