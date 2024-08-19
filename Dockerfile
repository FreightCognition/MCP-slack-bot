# Use the official Node.js image with the latest LTS version.
FROM node:20

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install production dependencies.
RUN npm install --only=production

# Install @google-cloud/secret-manager explicitly
RUN npm install @google-cloud/secret-manager

# Copy local code to the container image.
COPY . .

# Run the web service on container startup.
CMD [ "node", "app.js" ]

# Inform Docker that the container is listening on the specified port.
EXPOSE 8080
