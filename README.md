# MyCarrierPortal Risk Assessment Slackbot
### _by FreightCognition_

A hostable Slack bot that integrates with the MyCarrierPackets API to provide risk assessments for motor carriers. Users can query the bot with an MC number to receive a detailed risk assessment report directly in Slack.

## Features

- Fetches carrier data from the MyCarrierPackets API
- Calculates risk levels and points for various categories (Authority, Insurance, Safety, Operation, Other, MyCarrierProtect)
- Displays a human-readable list of infractions with details
- Provides a summary of the overall risk assessment
- Report is viewable by entire channel in public channels, inside or outside your network.
- Works in private channels

## Prerequisites

- MyCarrierPortal Subscription Subscription
- MyCarrierPortal Beraer Token via  Postman test
- Slack Subscription (free)
- A server to host it on (AWS, Azure, Google Cloud, or your own.)
- _If you are not interested in hosting this yourself, reach out to me via this repo or Reddit and we can work something out._

## Deploying on Google Cloud

To deploy this application on Google Cloud, follow these steps:

1. **Set up a Google Cloud Project**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable required APIs**
   - Enable the Cloud Run API
   - Enable the Secret Manager API

3. **Set up Secret Manager**
   - In the Google Cloud Console, go to Security > Secret Manager
   - Create a new secret named `BEARER_TOKEN`
   - Add your bearer token value to this secret

4. **Prepare your application**
   - Ensure your `package.json` file includes all necessary dependencies
   - Create a `Dockerfile` in your project root:

     ```dockerfile
     FROM node:14
     WORKDIR /app
     COPY package*.json ./
     RUN npm install
     COPY . .
     CMD [ "node", "app.js" ]
     ```

5. **Deploy to Cloud Run**
   - Open Google Cloud Shell or install and configure the [gcloud CLI](https://cloud.google.com/sdk/docs/install) on your local machine
   - Build and deploy your container:

     ```bash
     gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-slack-bot
     gcloud run deploy mcp-slack-bot --image gcr.io/PROJECT_ID/mcp-slack-bot --platform managed --allow-unauthenticated
     ```

   Replace `PROJECT_ID` with your Google Cloud project ID.

6. **Set up environment variables**
   - In the Cloud Run service details, go to the "Variables & Secrets" tab
   - Add the following environment variable:
     - Name: `GOOGLE_APPLICATION_CREDENTIALS`
     - Value: `/etc/secrets/google-application-credentials.json`

7. **Mount the service account key**
   - In the same "Variables & Secrets" tab, under "Secrets", click "Add Secret"
   - Choose the service account key file
   - Mount path: `/etc/secrets/google-application-credentials.json`

8. **Update Slack with your new endpoint**
   - Copy the URL provided by Cloud Run after deployment
   - Update your Slack app's slash command configuration with this new URL

Your application should now be deployed and accessible via the Cloud Run URL. Make sure to test the integration to ensure everything is working correctly.
Contributing
Contributions are welcome! For bugs or improvement suggestions, please open an issue or submit a pull request.

![image](https://github.com/user-attachments/assets/b2f2f1f4-8d22-4b47-9680-92c9798acc18)

