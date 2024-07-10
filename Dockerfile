# Use an official Node.js runtime as the base image
FROM node:16

# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true


# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install Yarn
RUN npm install -g yarn --force

# Install project dependencies
RUN yarn install --frozen-lockfile

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget

# Copy the rest of the application code
COPY . .

# Expose any necessary ports (if your application listens on a specific port)
# EXPOSE 3000

# Set the LIBSQL_DB_AUTH_TOKEN environment variable
ENV LIBSQL_DB_AUTH_TOKEN eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIyMDIzLTExLTAzVDA2OjQxOjM3LjAwMTUzOTU3MloiLCJpZCI6ImYxMmEwMzA0LTdhMTItMTFlZS1iNzEyLTdhZWJhMmI3ZmVhYiJ9.sMMxTa6y1CJWTt07hl42azMkPdjfoU6KU8s77I3H3gtkvx9Ze_VMQwSvWlDHRJQL22MJL22o3FulHB2kQwZnDQ

# Set the command to run your application
CMD ["yarn", "start"]