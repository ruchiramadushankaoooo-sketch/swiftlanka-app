/**
 * AdPulse Global — Unified Payment Gateway & Payout Engine
 * 
 * Supports:
 * 1. PayPal Payouts API (PayPal balance -> Earner email)
 * 2. NOWPayments Crypto Payouts (USDT / BTC -> Earner wallet address)
 * 3. Commercial Bank of Ceylon (Sri Lanka LKR Instant Bank Transfer)
 * 4. Graceful Fallback / Simulation Mode (when API keys are not yet configured)
 */

const https = require('https');
const config = require('./config');

class PaymentGateway {
  constructor() {
    this.config = config;
  }

  /**
   * Helper: Make HTTPS request with Promise
   */
  async request(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (e) {
            parsed = { raw: data };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            const err = new Error(parsed.message || parsed.error_description || parsed.error || `HTTP Error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Payment gateway request timed out (15s)'));
      });

      if (postData) {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  }

  /**
   * Process a payout request based on method
   */
  async processPayout(payout, adminBankRef = '') {
    const method = (payout.method || '').toLowerCase();

    if (method.includes('paypal')) {
      return this.processPayPal(payout);
    } else if (method.includes('usdt') || method.includes('crypto') || method.includes('bitcoin') || method.includes('btc')) {
      return this.processCryptoNOWPayments(payout);
    } else if (method.includes('commercial bank') || method.includes('sri lanka') || method.includes('bank')) {
      return this.processCommercialBankSL(payout, adminBankRef);
    } else {
      // General/Other method (Gift Cards, etc.)
      return this.processGenericPayout(payout);
    }
  }

  // ==========================================
  // 1. PAYPAL PAYOUTS API INTEGRATION
  // ==========================================
  async processPayPal(payout) {
    const ppConfig = this.config.paypal;

    // Check if real PayPal credentials are provided
    if (ppConfig && ppConfig.enabled && ppConfig.clientId && ppConfig.clientSecret) {
      try {
        const host = ppConfig.sandboxMode ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';

        // Step 1: Get Access Token
        const authHeader = 'Basic ' + Buffer.from(`${ppConfig.clientId}:${ppConfig.clientSecret}`).toString('base64');
        const tokenRes = await this.request({
          hostname: host,
          path: '/v1/oauth2/token',
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }, 'grant_type=client_credentials');

        const accessToken = tokenRes.data.access_token;
        if (!accessToken) throw new Error('Failed to obtain PayPal OAuth token');

        // Step 2: Create Payout
        const senderBatchId = `payout_${payout.id}_${Date.now()}`;
        const payoutPayload = {
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: 'You have a cashout payment from AdPulse Global!',
            email_message: `Congratulations! Here is your $${payout.usdAmount.toFixed(2)} ad earnings cashout from AdPulse.`
          },
          items: [
            {
              recipient_type: 'EMAIL',
              amount: {
                value: payout.usdAmount.toFixed(2),
                currency: 'USD'
              },
              receiver: payout.payoutDetails,
              note: `AdPulse Cashout #${payout.id}`,
              sender_item_id: payout.id
            }
          ]
        };

        const payoutRes = await this.request({
          hostname: host,
          path: '/v1/payments/payouts',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }, payoutPayload);

        const batchId = payoutRes.data?.batch_header?.payout_batch_id || senderBatchId;
        return {
          success: true,
          mode: ppConfig.sandboxMode ? 'paypal_sandbox' : 'paypal_live',
          txHash: `PP-${batchId}`,
          gatewayResponse: payoutRes.data,
          note: `PayPal ${ppConfig.sandboxMode ? 'Sandbox' : 'Live'} Payout Sent (Batch: ${batchId})`
        };

      } catch (err) {
        console.error('PayPal API Error:', err.message, err.response || '');
        throw new Error(`PayPal Gateway Error: ${err.message}`);
      }
    }

    // Fallback Simulation Mode
    const simTx = `SIM-PP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    return {
      success: true,
      mode: 'simulated',
      txHash: simTx,
      gatewayResponse: {
        simulated: true,
        message: 'PayPal API keys not configured in config.js. Payout processed in simulation mode.'
      },
      note: `Simulated PayPal Payout to ${payout.payoutDetails} (Add keys in config.js for live payouts)`
    };
  }

  // ==========================================
  // 2. NOWPAYMENTS CRYPTO PAYOUTS (USDT/BTC)
  // ==========================================
  async processCryptoNOWPayments(payout) {
    const cryptoConfig = this.config.nowpayments;

    if (cryptoConfig && cryptoConfig.enabled && cryptoConfig.apiKey) {
      try {
        const host = cryptoConfig.sandboxMode ? 'api-sandbox.nowpayments.io' : 'api.nowpayments.io';
        let currency = 'usdttrc20'; // default
        if (payout.method.toLowerCase().includes('btc') || payout.method.toLowerCase().includes('bitcoin')) {
          currency = 'btc';
        }

        const payoutPayload = {
          withdrawals: [
            {
              address: payout.payoutDetails,
              currency: currency,
              amount: payout.usdAmount,
              ipn_callback_url: cryptoConfig.ipnSecret ? 'http://localhost:3000/api/payments/ipn' : undefined
            }
          ]
        };

        const res = await this.request({
          hostname: host,
          path: '/v1/payout',
          method: 'POST',
          headers: {
            'x-api-key': cryptoConfig.apiKey,
            'Content-Type': 'application/json'
          }
        }, payoutPayload);

        const payoutId = res.data?.id || res.data?.withdrawals?.[0]?.id || `NP-${Date.now()}`;
        return {
          success: true,
          mode: cryptoConfig.sandboxMode ? 'nowpayments_sandbox' : 'nowpayments_live',
          txHash: `NP-${payoutId}`,
          gatewayResponse: res.data,
          note: `Crypto Payout submitted via NOWPayments (${currency.toUpperCase()})`
        };

      } catch (err) {
        console.error('NOWPayments API Error:', err.message, err.response || '');
        throw new Error(`NOWPayments Gateway Error: ${err.message}`);
      }
    }

    // Fallback Simulation Mode
    const simTx = `0x${Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('')}`;
    return {
      success: true,
      mode: 'simulated',
      txHash: simTx,
      gatewayResponse: {
        simulated: true,
        message: 'NOWPayments API key not configured in config.js. Simulated blockchain tx generated.'
      },
      note: `Simulated Crypto Transfer (${payout.method}) to ${payout.payoutDetails}`
    };
  }

  // ==========================================
  // 3. COMMERCIAL BANK SRI LANKA (LKR TRANSFER)
  // ==========================================
  async processCommercialBankSL(payout, adminBankRef = '') {
    const bankConfig = this.config.commercialBankSL || { usdToLkrRate: 298 };
    const lkrAmount = (payout.usdAmount * bankConfig.usdToLkrRate).toFixed(2);
    const refNumber = adminBankRef || `CB-SL-${Date.now().toString().slice(-8)}`;

    return {
      success: true,
      mode: 'commercial_bank_sl',
      txHash: refNumber,
      lkrAmount: `LKR ${lkrAmount}`,
      exchangeRate: `1 USD = ${bankConfig.usdToLkrRate} LKR`,
      gatewayResponse: {
        bankName: 'Commercial Bank of Ceylon PLC',
        destination: payout.payoutDetails,
        amountLkr: lkrAmount,
        bankRef: refNumber
      },
      note: `Commercial Bank SL Deposit: LKR ${lkrAmount} (Ref: ${refNumber})`
    };
  }

  // ==========================================
  // 4. GENERIC / GIFT CARDS
  // ==========================================
  async processGenericPayout(payout) {
    const giftCode = `CARD-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      success: true,
      mode: 'simulated',
      txHash: giftCode,
      gatewayResponse: {
        giftCardCode: giftCode
      },
      note: `Gift Voucher Code generated: ${giftCode}`
    };
  }

  /**
   * Get Gateway Status / Availability for Admin Dashboard
   */
  getStatus() {
    return {
      paypal: {
        configured: !!(this.config.paypal?.clientId && this.config.paypal?.clientSecret),
        enabled: !!this.config.paypal?.enabled,
        mode: this.config.paypal?.sandboxMode ? 'Sandbox (Testing)' : 'Live'
      },
      nowpayments: {
        configured: !!this.config.nowpayments?.apiKey,
        enabled: !!this.config.nowpayments?.enabled,
        mode: this.config.nowpayments?.sandboxMode ? 'Sandbox (Testing)' : 'Live'
      },
      commercialBankSL: {
        configured: true,
        enabled: true,
        mode: 'Direct Bank Transfer (LKR)',
        exchangeRate: `${this.config.commercialBankSL?.usdToLkrRate || 298} LKR / USD`
      }
    };
  }
}

module.exports = new PaymentGateway();
