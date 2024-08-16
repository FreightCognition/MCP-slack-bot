const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function getRiskLevelEmoji(points) {
  if (points >= 0 && points <= 999) {
    return '🟢';
  } else if (points >= 1000 && points <= 9999) {
    return '🟡';
  } else {
    return '🔴';
  }
}

app.post('/slack/commands', async (req, res) => {
  const { text, response_url } = req.body;

  if (!text) {
    return res.send('Please provide a valid MC number.');
  }

  const mcNumber = text.trim();

  try {
    // Use the injected environment variable for the bearer token
    const bearerToken = process.env.MCP_BEARER_TOKEN;
    if (!bearerToken) {
      throw new Error('Bearer token is not set');
    }

    const response = await axios.post(
      'https://mycarrierpacketsapi-stage.azurewebsites.net/api/v1/Carrier/PreviewCarrier', 
      null, 
      {
        params: { docketNumber: mcNumber },
        headers: {
          Authorization: `Bearer ${bearerToken}`,
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
          text: `*Overall assessment:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.TotalPoints)} ${data.RiskAssessment.Overall}`
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
          text: `*Authority:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Authority.TotalPoints)} ${data.RiskAssessment.Authority}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${data.RiskAssessmentDetails.Authority.OverallRating} | Points: ${data.RiskAssessmentDetails.Authority.TotalPoints}`
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
          text: `*Insurance:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Insurance.TotalPoints)} ${data.RiskAssessment.Insurance}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${data.RiskAssessmentDetails.Insurance.OverallRating} | Points: ${data.RiskAssessmentDetails.Insurance.TotalPoints}`
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
          text: `*Operations:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Operation.TotalPoints)} ${data.RiskAssessment.Operation}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Points: ${data.RiskAssessmentDetails.Operation.TotalPoints}`
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
          text: `*Safety:* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Safety.TotalPoints)} ${data.RiskAssessment.Safety}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${data.RiskAssessmentDetails.Safety.OverallRating} | Points: ${data.RiskAssessmentDetails.Safety.TotalPoints}`
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
          text: `*MyCarrierProtect (Fraud, Double Brokering, and Performance):* ${getRiskLevelEmoji(data.RiskAssessmentDetails.Other.TotalPoints)} ${data.RiskAssessment.Other}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Risk Level: ${data.RiskAssessmentDetails.Other.OverallRating} | Points: ${data.RiskAssessmentDetails.Other.TotalPoints}`
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

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
