# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only for the image)
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the application port (Koyeb usually maps this automatically)
EXPOSE 5000

# Start the application
CMD ["node", "src/server.js"]
