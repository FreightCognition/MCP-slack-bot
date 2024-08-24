const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const secretClient = new SecretManagerServiceClient();

async function getSecret(secretName) {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/mcp-slack-bot/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

let BEARER_TOKEN;

async function initializeSecrets() {
  try {
    BEARER_TOKEN = await getSecret('BEARER_TOKEN');
    console.log('Secrets initialized successfully');
  } catch (error) {
    console.error('Error initializing secrets:', error);
    process.exit(1);
  }
}

function getRiskLevelEmoji(points) {
  if (points >= 0 && points <= 249) {
    return '🟢';
  } else if (points >= 250 && points <= 999) {
    return '🟡';
  } else if (points >= 1000 && points <= 9999) {
    return '🟠';
  } else {
    return '🔴';
  }
}

function getRiskLevel(points) {
  if (points >= 0 && points <= 249) {
    return 'Low';
  } else if (points >= 250 && points <= 999) {
    return 'Medium';
  } else if (points >= 1000 && points <= 9999) {
    return 'Review Required';
  } else {
    return 'Fail';
  }
}

function getDetailsString(details) {
  return Object.entries(details)
    .filter(([key, value]) => key !== 'TotalPoints' && key !== 'OverallRating' && value !== 0)
    .map(([key, value]) => `${key}: ${value} points`)
    .join('\n');
}

app.post('/slack/commands', async (req, res) => {
  const { text, response_url } = req.body;

  if (!text) {
    return res.send('Please provide a valid MC number.');
  }

  const mcNumber = text.trim();

  try {
    const response = await axios.post(
      'https://mycarrierpacketsapi-stage.azurewebsites.net/api/v1/Carrier/PreviewCarrier', 
      null, 
      {
        params: { docketNumber: mcNumber },
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data[0];

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "MyCarrierPortal Risk Assessment",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${data.CompanyName}*\nDOT: ${data.DotNumber} / MC: ${data.DocketNumber}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Overall assessment:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Total Points: ${data.RiskAssessmentDetails.TotalPoints}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Authority:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Authority.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.Authority.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${getRiskLevel(data.RiskAssessmentDetails.Authority.TotalPoints)} | Points: ${data.RiskAssessmentDetails.Authority.TotalPoints}\n${getDetailsString(data.RiskAssessmentDetails.Authority)}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Insurance:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Insurance.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.Insurance.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${getRiskLevel(data.RiskAssessmentDetails.Insurance.TotalPoints)} | Points: ${data.RiskAssessmentDetails.Insurance.TotalPoints}\n${getDetailsString(data.RiskAssessmentDetails.Insurance)}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Operations:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Operation.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.Operation.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${getRiskLevel(data.RiskAssessmentDetails.Operation.TotalPoints)} | Points: ${data.RiskAssessmentDetails.Operation.TotalPoints}\n${getDetailsString(data.RiskAssessmentDetails.Operation)}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Safety:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Safety.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.Safety.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${getRiskLevel(data.RiskAssessmentDetails.Safety.TotalPoints)} | Points: ${data.RiskAssessmentDetails.Safety.TotalPoints}\n${getDetailsString(data.RiskAssessmentDetails.Safety)}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*MyCarrierProtect (Fraud, Double Brokering, and Performance):* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Other.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails.Other.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${getRiskLevel(data.RiskAssessmentDetails.Other.TotalPoints)} | Points: ${data.RiskAssessmentDetails.Other.TotalPoints}\n${getDetailsString(data.RiskAssessmentDetails.Other)}`
          }
        ]
      }
    ];

    const slackResponse = {
      response_type: 'in_channel',
      blocks: blocks
    };

    await axios.post(response_url, slackResponse);

    res.send();
  } catch (error) {
    console.error('Error fetching carrier data:', error);
    res.send('Failed to retrieve carrier data. Please try again.');
  }
});

async function startServer() {
  await initializeSecrets();
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer();
