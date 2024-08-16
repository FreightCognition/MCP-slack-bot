const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const express = require('express');
const request = require('supertest');

// Import the app
const app = require('./app');

// Create a mock for axios
const mock = new MockAdapter(axios);

describe('Slack Bot API', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mock.reset();
  });

  it('should make a request with the correct bearer token', async () => {
    // Set the environment variable for the test
    process.env.MCP_BEARER_TOKEN = 'test-bearer-token';

    // Mock the API response
    mock.onPost('https://mycarrierpacketsapi-stage.azurewebsites.net/api/v1/Carrier/PreviewCarrier').reply(200, [{
      CompanyName: 'Test Company',
      DotNumber: '12345',
      DocketNumber: 'MC123456',
      RiskAssessment: {
        Overall: 'Low Risk',
        Authority: 'Low Risk',
        Insurance: 'Low Risk',
        Operation: 'Low Risk',
        Safety: 'Low Risk',
        Other: 'Low Risk'
      },
      RiskAssessmentDetails: {
        TotalPoints: 500,
        Authority: { TotalPoints: 100, OverallRating: 'Low' },
        Insurance: { TotalPoints: 100, OverallRating: 'Low' },
        Operation: { TotalPoints: 100 },
        Safety: { TotalPoints: 100, OverallRating: 'Low' },
        Other: { TotalPoints: 100, OverallRating: 'Low' }
      }
    }]);

    // Make a request to the Slack command endpoint
    const response = await request(app)
      .post('/slack/commands')
      .send({ text: 'MC123456', response_url: 'http://example.com/response' });

    // Check the response
    expect(response.status).toBe(200);

    // Verify that the correct bearer token was used in the request
    const apiCall = mock.history.post[0];
    expect(apiCall.headers.Authorization).toBe('Bearer test-bearer-token');

    // Additional assertion to check if the API was called with the correct parameters
    expect(apiCall.params.docketNumber).toBe('MC123456');
  });

  it('should handle errors when bearer token is not set', async () => {
    // Unset the bearer token
    delete process.env.MCP_BEARER_TOKEN;

    // Make a request to the Slack command endpoint
    const response = await request(app)
      .post('/slack/commands')
      .send({ text: 'MC123456', response_url: 'http://example.com/response' });

    // Check the response
    expect(response.status).toBe(200);
    expect(response.text).toBe('Failed to retrieve carrier data. Please try again.');
  });
});