# Live Bet Mentor - Cloud Dockerfile (Render)
# Node.js for proxy API + Python with curl_cffi for SofaScore data fetching

FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

# Create and activate Python venv (Debian requires it)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies (curl_cffi for SofaScore TLS impersonation)
RUN pip install --no-cache-dir requests curl_cffi python-dotenv

WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy all project files
COPY . .

# Expose port
EXPOSE 3001

# Start the proxy server (it will spawn the Python fetcher automatically)
CMD ["node", "server/proxy.js"]
