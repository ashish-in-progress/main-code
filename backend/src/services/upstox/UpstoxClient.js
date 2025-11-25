// ==================== src/services/upstox/UpstoxClient.js ====================
import axios from 'axios';
import { UPSTOX_CONFIG } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class UpstoxClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = UPSTOX_CONFIG.baseUrl;
    this.connected = true;
    this.isAuthenticated = true;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`Upstox API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getProfile() {
    return this.makeRequest('/user/profile');
  }

  async getHoldings() {
    return this.makeRequest('/portfolio/long-term-holdings');
  }

  async getPositions() {
    return this.makeRequest('/portfolio/short-term-positions');
  }

  async getFunds() {
    return this.makeRequest('/user/get-funds-and-margin');
  }

  async searchInstruments(query) {
    return this.makeRequest(`/search/instruments?query=${encodeURIComponent(query)}`);
  }

  async getMarketQuote(instruments) {
    const upstoxInstruments = instruments.map(inst => {
      if (inst.includes(':')) {
        const [exchange, symbol] = inst.split(':');
        return `${exchange}_EQ|${symbol}`;
      }
      return `NSE_EQ|${inst}`;
    });

    return this.makeRequest(`/market-quote/quotes?instrument_key=${upstoxInstruments.join(',')}`);
  }
}
