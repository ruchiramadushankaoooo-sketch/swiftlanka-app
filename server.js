const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database');
const paymentGateway = require('./paymentGateway');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple session token in-memory store for effortless demo use
const activeSessions = new Map();

// Authentication middleware
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const cleanToken = token.replace('Bearer ', '');
  const userId = activeSessions.get(cleanToken);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const user = db.findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// ================= AUTH ROUTES =================
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const newUser = db.createUser(username.trim(), email.trim(), password, referralCode ? referralCode.trim() : null);
    const sessionToken = 'sess_' + Math.random().toString(36).substring(2) + Date.now();
    activeSessions.set(sessionToken, newUser.id);

    const safeUser = { ...newUser };
    delete safeUser.passwordHash;

    res.json({
      success: true,
      token: sessionToken,
      user: safeUser,
      settings: db.data.settings
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email.trim());
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const sessionToken = 'sess_' + Math.random().toString(36).substring(2) + Date.now();
    activeSessions.set(sessionToken, user.id);

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.json({
      success: true,
      token: sessionToken,
      user: safeUser,
      settings: db.data.settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const safeUser = { ...req.user };
  delete safeUser.passwordHash;
  res.json({
    user: safeUser,
    settings: db.data.settings
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) activeSessions.delete(token);
  res.json({ success: true });
});

// ================= AD CAMPAIGNS & WATCH ROUTES =================
app.get('/api/ads/campaigns', authMiddleware, (req, res) => {
  const activeAds = db.data.ad_campaigns.filter(c => c.active && c.viewsRemaining > 0);
  res.json({
    campaigns: activeAds,
    dailyLimit: db.data.settings.dailyWatchLimit,
    watchedToday: req.user.adsWatchedToday || 0,
    pointsPerUsd: db.data.settings.pointsPerUsd,
    aAds: config.aAds || { enabled: false }
  });
});

app.post('/api/ads/start', authMiddleware, (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });

    // Check daily limit
    const limit = db.data.settings.dailyWatchLimit || 40;
    if ((req.user.adsWatchedToday || 0) >= limit) {
      return res.status(400).json({ error: `Daily ad limit of ${limit} reached. Come back tomorrow!` });
    }

    const session = db.startAdSession(req.user.id, campaignId);
    res.json({
      watchToken: session.watchToken,
      campaign: session.campaign
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/ads/verify', authMiddleware, (req, res) => {
  try {
    const { watchToken } = req.body;
    if (!watchToken) return res.status(400).json({ error: 'watchToken is required' });

    const result = db.completeAdSession(req.user.id, watchToken);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= EARN ARENA (Daily Streak & Lucky Spin) =================
app.post('/api/earn/daily-streak', authMiddleware, (req, res) => {
  try {
    const result = db.claimDailyStreak(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/earn/spin', authMiddleware, (req, res) => {
  try {
    const result = db.spinLuckyWheel(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= WALLET & WITHDRAWALS =================
app.get('/api/wallet/transactions', authMiddleware, (req, res) => {
  const userTxs = db.data.transactions.filter(t => t.userId === req.user.id);
  const userPayouts = db.data.payout_requests.filter(p => p.userId === req.user.id);
  res.json({
    points: req.user.points,
    usdBalance: req.user.points / db.data.settings.pointsPerUsd,
    totalEarned: req.user.totalEarned,
    totalWithdrawn: req.user.totalWithdrawn,
    transactions: userTxs.slice(0, 50),
    payoutRequests: userPayouts,
    settings: db.data.settings
  });
});

app.post('/api/wallet/withdraw', authMiddleware, (req, res) => {
  try {
    const { method, payoutDetails, pointsAmount } = req.body;
    if (!method || !payoutDetails || !pointsAmount) {
      return res.status(400).json({ error: 'Payment method, payout destination details, and points amount are required.' });
    }

    const payout = db.createPayoutRequest(req.user.id, method, payoutDetails.trim(), parseInt(pointsAmount));
    res.json({
      success: true,
      payout,
      newTotalPoints: req.user.points,
      usdBalance: req.user.points / db.data.settings.pointsPerUsd
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= REFERRAL SYSTEM =================
app.get('/api/referrals', authMiddleware, (req, res) => {
  const refs = db.data.referrals.filter(r => r.referrerId === req.user.id);
  const totalCommission = refs.reduce((sum, r) => sum + (r.totalCommissionEarned || 0), 0);

  res.json({
    referralCode: req.user.referralCode,
    referralLink: `${req.protocol}://${req.get('host')}?ref=${req.user.referralCode}`,
    commissionRatePct: db.data.settings.referralCommissionPct,
    totalInvited: refs.length,
    totalCommissionPoints: totalCommission,
    totalCommissionUsd: totalCommission / db.data.settings.pointsPerUsd,
    invitedUsers: refs
  });
});

// ================= ADMIN DASHBOARD ROUTES =================
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const stats = db.getPlatformStats();
  const gatewayStatus = paymentGateway.getStatus();
  res.json({
    stats,
    gatewayStatus,
    allUsersCount: db.data.users.length,
    allUsers: db.data.users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      points: u.points,
      totalEarned: u.totalEarned,
      createdAt: u.createdAt
    })),
    payouts: db.data.payout_requests,
    campaigns: db.data.ad_campaigns
  });
});

app.get('/api/admin/gateways', adminMiddleware, (req, res) => {
  res.json({ success: true, gateways: paymentGateway.getStatus() });
});

app.post('/api/admin/payouts/action', adminMiddleware, async (req, res) => {
  try {
    const { payoutId, status, txHash, adminNote, bankRef } = req.body;
    if (!payoutId || !['approved', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Valid payoutId and status (approved/paid/rejected) required' });
    }

    const payout = db.data.payout_requests.find(p => p.id === payoutId);
    if (!payout) {
      return res.status(404).json({ error: 'Payout request not found' });
    }

    let finalTxHash = txHash || payout.txHash;
    let finalNote = adminNote || payout.adminNote;
    let gatewayResult = null;

    // If admin is marking as paid and no explicit txHash is supplied, process via payment gateway
    if (status === 'paid' && !txHash) {
      try {
        gatewayResult = await paymentGateway.processPayout(payout, bankRef);
        finalTxHash = gatewayResult.txHash;
        if (!finalNote) {
          finalNote = gatewayResult.note;
        }
      } catch (gateErr) {
        return res.status(400).json({ 
          error: `Payment Gateway execution failed: ${gateErr.message}`,
          details: gateErr.response || null
        });
      }
    }

    const updated = db.updatePayoutStatus(payoutId, status, finalTxHash, finalNote);
    res.json({ success: true, payout: updated, gatewayResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/campaigns', adminMiddleware, (req, res) => {
  try {
    const newCamp = db.addAdCampaign(req.body);
    res.json({ success: true, campaign: newCamp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/campaigns/toggle', adminMiddleware, (req, res) => {
  try {
    const { campaignId } = req.body;
    const camp = db.toggleCampaign(campaignId);
    res.json({ success: true, campaign: camp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/campaigns/delete', adminMiddleware, (req, res) => {
  try {
    const { campaignId } = req.body;
    db.deleteCampaign(campaignId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback to index.html for client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AdPulse Watch-to-Earn Server running at http://127.0.0.1:${PORT}`);
});
