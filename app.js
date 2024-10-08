const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

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

// Helper function to format infraction details
function formatInfractions(infractions) {
  if (!infractions || infractions.length === 0) {
    return "No infractions found.";
  }
  return infractions.map(infraction => {
    return `- ${infraction.RuleText}: ${infraction.RuleOutput} (${infraction.Points} points)`;
  }).join('\n');
}

app.post('/slack/commands', async (req, res) => {
  const { text, response_url } = req.body;

  if (!text) {
    return res.send('Please provide a valid MC number.');
  }

  const mcNumber = text.trim();

  try {
    console.log(`Fetching data for MC number: ${mcNumber}`);
    const response = await axios.post(
      'https://mycarrierpacketsapi-stage.azurewebsites.net/api/v1/Carrier/PreviewCarrier',
      null,
      {
        params: { docketNumber: mcNumber },
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      }
    );

    if (!response.data || response.data.length === 0) {
      console.log(`No data found for MC number: ${mcNumber}`);
      return res.send('No data found for the provided MC number.');
    }

    const data = response.data[0];
    console.log(`Data received for MC number: ${mcNumber}`, JSON.stringify(data, null, 2));

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
          text: `*${data.CompanyName || 'N/A'}*\nDOT: ${data.DotNumber || 'N/A'} / MC: ${data.DocketNumber || 'N/A'}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Overall assessment:* ${getRiskLevelEmoji(data.RiskAssessmentDetails?.TotalPoints)} ${getRiskLevel(data.RiskAssessmentDetails?.TotalPoints)}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Total Points: ${data.RiskAssessmentDetails?.TotalPoints || 'N/A'}`
          }
        ]
      },
      {
        type: "divider"
      }
    ];

    // Add sections for each risk assessment category with enhanced details
    const categories = ['Authority', 'Insurance', 'Operation', 'Safety', 'Other'];
    categories.forEach(category => {
      const categoryData = data.RiskAssessmentDetails?.[category];
      if (categoryData) {
        let detailsText = `Risk Level: ${getRiskLevel(categoryData.TotalPoints)} | Points: ${categoryData.TotalPoints}`;

        // Add specific explanations based on category and risk level (if needed)
        // ... (You can add conditional logic here based on the API response)

        // Add formatted infractions
        detailsText += `\nInfractions:\n${formatInfractions(categoryData.Infractions)}`;

        blocks.push(
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${category}:* ${getRiskLevelEmoji(categoryData.TotalPoints)} ${getRiskLevel(categoryData.TotalPoints)}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: detailsText
              }
            ]
          },
          {
            type: "divider"
          }
        );
      }
    });

    // Add MyCarrierProtect section
    const mcpData = { // Construct MyCarrierProtect data from relevant fields
      TotalPoints: (data.IsBlocked ? 1000 : 0) + (data.FreightValidateStatus === 'Review Recommended' ? 1000 : 0), 
      OverallRating: getRiskLevel((data.IsBlocked ? 1000 : 0) + (data.FreightValidateStatus === 'Review Recommended' ? 1000 : 0)),
      Infractions: [] 
    };
    if (data.IsBlocked) {
      mcpData.Infractions.push({
        Points: 1000,
        RiskLevel: 'Review Required',
        RuleText: 'MyCarrierProtect: Blocked',
        RuleOutput: 'Carrier blocked by 3 or more companies' // Adjust message as needed
      });
    }
    if (data.FreightValidateStatus === 'Review Recommended') {
      mcpData.Infractions.push({
        Points: 1000,
        RiskLevel: 'Review Required',
        RuleText: 'FreightValidate Status',
        RuleOutput: 'Carrier has a FreightValidate Review Recommended status'
      });
    }

    if (mcpData.TotalPoints > 0) {
      let mcpDetailsText = `Risk Level: ${mcpData.OverallRating} | Points: ${mcpData.TotalPoints}`;
      mcpDetailsText += `\nInfractions:\n${formatInfractions(mcpData.Infractions)}`;
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*MyCarrierProtect:* ${getRiskLevelEmoji(mcpData.TotalPoints)} ${mcpData.OverallRating}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: mcpDetailsText
            }
          ]
        },
        {
          type: "divider"
        }
      );
    }

    const slackResponse = {
      response_type: 'in_channel',
      blocks: blocks
    };

    console.log(`Sending Slack response for MC number: ${mcNumber}`);
    await axios.post(response_url, slackResponse, { timeout: 5000 });

    res.send();
  } catch (error) {
    console.error('Error fetching carrier data:', error);
    let errorMessage = 'Failed to retrieve carrier data. Please try again.';
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.data);
      errorMessage = `API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      console.error('No response received:', error.request);
      errorMessage = 'No response received from the API. Please try again later.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'The request timed out. Please try again later.';
    }
    res.status(500).send(errorMessage);
  }
});

async function startServer() {
  await initializeSecrets();
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer();
