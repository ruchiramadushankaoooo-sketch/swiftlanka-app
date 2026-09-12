/**
 * AdPulse Global — Payment Gateway Configuration
 * 
 * ============================================
 * ⚠️  FILL IN YOUR REAL API KEYS BELOW  ⚠️
 * ============================================
 * 
 * To enable real money cashouts, you need accounts on these platforms:
 * 
 * 1. NOWPayments (Crypto: USDT, BTC)
 *    → Sign up: https://nowpayments.io
 *    → Go to: Dashboard → Settings → API Keys
 *    → Copy your API Key below
 * 
 * 2. PayPal Business (PayPal Payouts)
 *    → Sign up: https://developer.paypal.com
 *    → Create App: Dashboard → My Apps → Create App
 *    → Copy Client ID and Secret below
 *    → ⚠️ Use SANDBOX keys for testing first!
 * 
 * 3. Commercial Bank SL (Manual Bank Transfer)
 *    → No API needed — admin manually transfers via online banking
 *    → Then enters the transaction reference in the admin panel
 */

module.exports = {

  // ==========================================
  //  NOWPAYMENTS — Crypto Payouts (USDT, BTC)
  // ==========================================
  // Sign up at: https://nowpayments.io
  // Get API key from: Dashboard → Settings → API Keys
  // Get IPN Secret from: Dashboard → Settings → IPN
  nowpayments: {
    enabled: true,           // ← Enabled with real API key
    apiKey: 'YX2SXY9-SDD4A4K-KXV29J6-342B3YK',
    apiPublicKey: '75b2bcc3-2f93-4c36-8b9c-a7587e4708f1',
    ipnSecret: '',           // ← (Optional) IPN callback secret for webhooks
    sandboxMode: false,      // ← Live mode (api.nowpayments.io)
    // Live API: https://api.nowpayments.io/v1
  },

  // ==========================================
  //  PAYPAL — PayPal Payouts
  // ==========================================
  // Sign up at: https://developer.paypal.com
  // Create app at: Dashboard → My Apps & Credentials → Create App
  paypal: {
    enabled: false,          // ← Set to true after adding credentials
    clientId: '',            // ← PayPal App Client ID
    clientSecret: '',        // ← PayPal App Secret
    sandboxMode: true,       // ← true = sandbox testing, false = live payouts
    // Sandbox: https://api-m.sandbox.paypal.com
    // Live:    https://api-m.paypal.com
  },

  // ==========================================
  //  COMMERCIAL BANK SL — Manual Bank Transfer
  // ==========================================
  // No API integration needed.
  // Admin manually transfers via Commercial Bank online banking,
  // then enters the bank reference number in the admin panel.
  commercialBankSL: {
    enabled: true,           // Always available (manual process)
    bankName: 'Commercial Bank of Ceylon PLC',
    currency: 'LKR',
    usdToLkrRate: 298,       // ← Update this with current exchange rate
    adminInstructions: 'Log in to ComBank Online → Fund Transfer → Enter account details → Send → Copy reference number → Paste in admin panel'
  },

  // ==========================================
  //  A-ADS (ANONYMOUS ADS) CRYPTO AD NETWORK
  // ==========================================
  // Sign up at: https://a-ads.com (No KYC, 100% Crypto)
  // 1. Create an Ad Unit (e.g. 728x90 or Adaptive banner)
  // 2. Paste your Ad Unit ID below (e.g. '2234567')
  // 3. Set your Bitcoin or USDT deposit address in A-Ads to get daily payouts!
  aAds: {
    enabled: true,
    adUnitId: '2234567',     // ← Replace with your A-Ads Unit ID from a-ads.com
    adaptive: true,
  },

  // ==========================================
  //  GIFT CARDS — (Future Integration)
  // ==========================================
  // Services like Reloadly (https://reloadly.com) or Bitrefill
  giftCards: {
    enabled: false,
    provider: 'reloadly',    // 'reloadly' or 'bitrefill'
    apiKey: '',
    apiSecret: '',
    sandboxMode: true,
  },

  // ==========================================
  //  GLOBAL SETTINGS
  // ==========================================
  global: {
    // Minimum payout amount in USD
    minPayoutUsd: 1.00,
    // Maximum single payout in USD (fraud protection)
    maxPayoutUsd: 500.00,
    // Payout processing fee percentage (0 = no fee)
    processingFeePct: 0,
    // Admin email for payout notifications
    adminEmail: 'admin@adpulse.com',
  }
};
