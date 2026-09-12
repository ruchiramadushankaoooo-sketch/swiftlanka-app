const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, 'data_store.json');

// Default initial dataset
const INITIAL_DATA = {
  users: [],
  ad_campaigns: [],
  ad_views: [],
  transactions: [],
  payout_requests: [],
  referrals: [],
  settings: {
    pointsPerUsd: 1000, // 1000 pts = $1.00
    minWithdrawalUsd: 1.0,
    dailyWatchLimit: 40,
    referralCommissionPct: 15,
    luckySpinCost: 10,
    dailyStreakBonuses: [20, 40, 60, 80, 120, 160, 300]
  }
};

class Database {
  constructor() {
    this.data = this.load();
    this.seedDefaults();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading database file, initializing defaults:', err);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  seedDefaults() {
    // Seed default admin and demo user if empty
    if (!this.data.users || this.data.users.length === 0) {
      this.data.users = [];
      const adminPass = bcrypt.hashSync('admin123', 10);
      const userPass = bcrypt.hashSync('demo123', 10);

      const adminUser = {
        id: 'user_admin_001',
        username: 'AdminMaster',
        email: 'admin@adpulse.com',
        passwordHash: adminPass,
        role: 'admin',
        points: 50000,
        totalEarned: 50000,
        totalWithdrawn: 0,
        adsWatchedToday: 0,
        lastWatchTimestamp: null,
        streakDays: 5,
        lastStreakDate: new Date().toISOString().split('T')[0],
        referralCode: 'ADMINVIP',
        referredBy: null,
        createdAt: new Date().toISOString()
      };

      const demoUser = {
        id: 'user_demo_002',
        username: 'GlobalEarner99',
        email: 'demo@adpulse.com',
        passwordHash: userPass,
        role: 'user',
        points: 750, // $0.75 starter balance
        totalEarned: 1250,
        totalWithdrawn: 500,
        adsWatchedToday: 3,
        lastWatchTimestamp: Date.now() - 1000 * 60 * 15,
        streakDays: 3,
        lastStreakDate: new Date().toISOString().split('T')[0],
        referralCode: 'EARN777',
        referredBy: 'ADMINVIP',
        createdAt: new Date().toISOString()
      };

      this.data.users.push(adminUser, demoUser);

      // Add demo transactions
      this.data.transactions.push(
        {
          id: uuidv4(),
          userId: demoUser.id,
          type: 'daily_bonus',
          points: 60,
          usdAmount: 0.06,
          description: 'Day 3 Daily Check-In Streak Bonus',
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: uuidv4(),
          userId: demoUser.id,
          type: 'ad_watch',
          points: 45,
          usdAmount: 0.045,
          description: 'Watched "FinTech Crypto Card" 30s Ad',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          id: uuidv4(),
          userId: demoUser.id,
          type: 'lucky_spin',
          points: 100,
          usdAmount: 0.10,
          description: 'Won 100 Points on Lucky Spin Wheel',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      );
    }

    // Seed realistic global Ad Campaigns
    if (!this.data.ad_campaigns || this.data.ad_campaigns.length === 0) {
      this.data.ad_campaigns = [
        {
          id: 'ad_camp_01',
          title: 'Binance Web3 Global Wallet',
          advertiser: 'Binance Global',
          category: 'Crypto & Web3',
          durationSeconds: 15,
          rewardPoints: 35, // ~$0.035
          cpmUsd: 12.50,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&q=80',
          ctaText: 'Open Free Web3 Wallet',
          ctaUrl: 'https://binance.com',
          rating: 4.9,
          viewsRemaining: 15000,
          country: 'Global'
        },
        {
          id: 'ad_camp_02',
          title: 'Cyberpunk 2077 Phantom Liberty Trailer',
          advertiser: 'CD PROJEKT RED',
          category: 'Gaming',
          durationSeconds: 30,
          rewardPoints: 65, // ~$0.065
          cpmUsd: 18.00,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
          ctaText: 'Get Game on Steam',
          ctaUrl: 'https://store.steampowered.com',
          rating: 4.8,
          viewsRemaining: 8400,
          country: 'Global'
        },
        {
          id: 'ad_camp_03',
          title: 'Shopify: Launch Your Global Store in 60s',
          advertiser: 'Shopify Inc.',
          category: 'E-Commerce & SaaS',
          durationSeconds: 20,
          rewardPoints: 45,
          cpmUsd: 15.00,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?w=600&q=80',
          ctaText: 'Start $1/Month Trial',
          ctaUrl: 'https://shopify.com',
          rating: 4.9,
          viewsRemaining: 22000,
          country: 'Global'
        },
        {
          id: 'ad_camp_04',
          title: 'NordVPN: Secure Internet & Streaming',
          advertiser: 'Nord Security',
          category: 'Cybersecurity',
          durationSeconds: 25,
          rewardPoints: 55,
          cpmUsd: 16.50,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80',
          ctaText: 'Claim 70% Discount + 3 Mo',
          ctaUrl: 'https://nordvpn.com',
          rating: 4.7,
          viewsRemaining: 12000,
          country: 'Global'
        },
        {
          id: 'ad_camp_05',
          title: 'Revolut Ultra: Multi-Currency Premium Card',
          advertiser: 'Revolut Ltd',
          category: 'Fintech & Banking',
          durationSeconds: 15,
          rewardPoints: 40,
          cpmUsd: 14.00,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&q=80',
          ctaText: 'Order Metal Card',
          ctaUrl: 'https://revolut.com',
          rating: 4.9,
          viewsRemaining: 9500,
          country: 'Global'
        },
        {
          id: 'ad_camp_06',
          title: 'Raid: Shadow Legends - New Champions',
          advertiser: 'Plarium Games',
          category: 'Mobile RPG',
          durationSeconds: 30,
          rewardPoints: 75,
          cpmUsd: 20.00,
          active: true,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80',
          ctaText: 'Play Free on PC & Mobile',
          ctaUrl: 'https://plarium.com',
          rating: 4.6,
          viewsRemaining: 30000,
          country: 'Global'
        }
      ];
    }

    // Seed sample payout request for demonstration in Admin
    if (!this.data.payout_requests || this.data.payout_requests.length === 0) {
      this.data.payout_requests = [
        {
          id: 'payout_demo_01',
          userId: 'user_demo_002',
          username: 'GlobalEarner99',
          method: 'USDT-TRC20',
          payoutDetails: 'TJ5uK9hZ2...TRC20Wallet',
          pointsDeducted: 500,
          usdAmount: 0.50,
          status: 'paid',
          txHash: '0x8f27ab...c93b1',
          createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ];
    }

    this.save();
  }

  // --- USER METHODS ---
  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  findUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserByReferralCode(code) {
    return this.data.users.find(u => u.referralCode && u.referralCode.toUpperCase() === code.toUpperCase());
  }

  createUser(username, email, password, referralCode) {
    const existing = this.findUserByEmail(email);
    if (existing) {
      throw new Error('Email is already registered');
    }

    let referredBy = null;
    if (referralCode) {
      const referrer = this.findUserByReferralCode(referralCode);
      if (referrer) {
        referredBy = referrer.referralCode;
      }
    }

    const uniqueCode = (username.substring(0, 4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
    const newUser = {
      id: 'user_' + uuidv4().substring(0, 8),
      username,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'user',
      points: 100, // Welcome signup bonus of 100 points ($0.10)
      totalEarned: 100,
      totalWithdrawn: 0,
      adsWatchedToday: 0,
      lastWatchTimestamp: null,
      streakDays: 1,
      lastStreakDate: new Date().toISOString().split('T')[0],
      referralCode: uniqueCode,
      referredBy: referredBy,
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);

    // Add signup bonus transaction
    this.data.transactions.unshift({
      id: uuidv4(),
      userId: newUser.id,
      type: 'signup_bonus',
      points: 100,
      usdAmount: 0.10,
      description: 'Welcome Sign Up Bonus',
      timestamp: new Date().toISOString()
    });

    // If referred, credit referrer or record referral
    if (referredBy) {
      const referrer = this.findUserByReferralCode(referredBy);
      if (referrer) {
        this.data.referrals.push({
          id: uuidv4(),
          referrerId: referrer.id,
          referredUserId: newUser.id,
          referredUsername: newUser.username,
          totalCommissionEarned: 0,
          createdAt: new Date().toISOString()
        });

        // Give referrer 50 points instant invite reward
        referrer.points += 50;
        referrer.totalEarned += 50;
        this.data.transactions.unshift({
          id: uuidv4(),
          userId: referrer.id,
          type: 'referral_bonus',
          points: 50,
          usdAmount: 0.05,
          description: `Direct Referral Bonus for inviting ${newUser.username}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.save();
    return newUser;
  }

  updateUserPoints(userId, pointsDelta, type, description) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    if (pointsDelta < 0 && user.points < Math.abs(pointsDelta)) {
      throw new Error('Insufficient points balance');
    }

    user.points += pointsDelta;
    if (pointsDelta > 0) {
      user.totalEarned += pointsDelta;
    }

    const tx = {
      id: uuidv4(),
      userId: user.id,
      type: type,
      points: pointsDelta,
      usdAmount: (pointsDelta / this.data.settings.pointsPerUsd),
      description: description,
      timestamp: new Date().toISOString()
    };

    this.data.transactions.unshift(tx);

    // Multi-level referral kickback: 15% to referrer if it's an ad or task watch reward
    if (pointsDelta > 0 && type === 'ad_watch' && user.referredBy) {
      const referrer = this.findUserByReferralCode(user.referredBy);
      if (referrer) {
        const commissionPct = this.data.settings.referralCommissionPct || 15;
        const commissionPoints = Math.max(1, Math.round((pointsDelta * commissionPct) / 100));
        referrer.points += commissionPoints;
        referrer.totalEarned += commissionPoints;

        this.data.transactions.unshift({
          id: uuidv4(),
          userId: referrer.id,
          type: 'referral_bonus',
          points: commissionPoints,
          usdAmount: commissionPoints / this.data.settings.pointsPerUsd,
          description: `${commissionPct}% Commission from referral ${user.username}'s ad watch`,
          timestamp: new Date().toISOString()
        });

        const refRecord = this.data.referrals.find(r => r.referrerId === referrer.id && r.referredUserId === user.id);
        if (refRecord) {
          refRecord.totalCommissionEarned += commissionPoints;
        }
      }
    }

    this.save();
    return { user, tx };
  }

  // --- AD WATCH VERIFICATION ---
  startAdSession(userId, campaignId) {
    const campaign = this.data.ad_campaigns.find(c => c.id === campaignId && c.active);
    if (!campaign) throw new Error('Campaign not found or inactive');

    const token = uuidv4();
    const session = {
      id: uuidv4(),
      userId,
      campaignId,
      watchToken: token,
      startedAt: Date.now(),
      minDurationSeconds: campaign.durationSeconds,
      rewardPoints: campaign.rewardPoints,
      completed: false
    };

    this.data.ad_views.push(session);
    this.save();

    return {
      watchToken: token,
      campaign
    };
  }

  completeAdSession(userId, watchToken) {
    const session = this.data.ad_views.find(s => s.watchToken === watchToken && s.userId === userId);
    if (!session) {
      throw new Error('Invalid or expired watch token');
    }

    if (session.completed) {
      throw new Error('Reward for this ad watch has already been claimed');
    }

    const elapsedSeconds = (Date.now() - session.startedAt) / 1000;
    // Strict anti-cheat: Allow 1.5s tolerance for network latency, but block fast-forward botting
    if (elapsedSeconds < (session.minDurationSeconds - 1.5)) {
      throw new Error(`Cheat detected: Ad was not watched for the required ${session.minDurationSeconds} seconds.`);
    }

    session.completed = true;
    session.completedAt = Date.now();

    const campaign = this.data.ad_campaigns.find(c => c.id === session.campaignId);
    const campaignTitle = campaign ? campaign.title : 'Sponsored Video Ad';

    // Credit user
    const { user, tx } = this.updateUserPoints(
      userId,
      session.rewardPoints,
      'ad_watch',
      `Watched ad: "${campaignTitle}" (${session.minDurationSeconds}s)`
    );

    user.adsWatchedToday = (user.adsWatchedToday || 0) + 1;
    user.lastWatchTimestamp = Date.now();

    if (campaign && campaign.viewsRemaining > 0) {
      campaign.viewsRemaining -= 1;
    }

    this.save();

    return {
      success: true,
      pointsAwarded: session.rewardPoints,
      newTotalPoints: user.points,
      usdBalance: user.points / this.data.settings.pointsPerUsd,
      tx
    };
  }

  // --- DAILY STREAK CLAIM ---
  claimDailyStreak(userId) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const todayStr = new Date().toISOString().split('T')[0];
    if (user.lastStreakDate === todayStr) {
      throw new Error('You have already claimed today’s streak reward!');
    }

    const yesterday = new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0];
    if (user.lastStreakDate === yesterday) {
      user.streakDays = (user.streakDays % 7) + 1;
    } else {
      user.streakDays = 1; // reset streak if missed
    }

    user.lastStreakDate = todayStr;
    const bonusTiers = this.data.settings.dailyStreakBonuses || [20, 40, 60, 80, 120, 160, 300];
    const rewardPoints = bonusTiers[user.streakDays - 1] || 50;

    const result = this.updateUserPoints(
      userId,
      rewardPoints,
      'daily_bonus',
      `Day ${user.streakDays} Daily Check-In Bonus`
    );

    return {
      streakDays: user.streakDays,
      rewardPoints,
      newTotalPoints: user.points,
      usdBalance: user.points / this.data.settings.pointsPerUsd
    };
  }

  // --- LUCKY WHEEL SPIN ---
  spinLuckyWheel(userId) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const spinCost = this.data.settings.luckySpinCost || 10;
    if (user.points < spinCost) {
      throw new Error(`You need at least ${spinCost} coins to spin the Lucky Wheel.`);
    }

    // Deduct spin fee
    user.points -= spinCost;

    // Wheel outcomes with probabilities
    // [Value, Probability weight, Color, Label]
    const segments = [
      { points: 5, weight: 25, label: '5 Coins' },
      { points: 15, weight: 30, label: '15 Coins' },
      { points: 30, weight: 20, label: '30 Coins' },
      { points: 50, weight: 12, label: '50 Coins' },
      { points: 100, weight: 8, label: '100 Coins' },
      { points: 250, weight: 4, label: '250 Coins 🔥' },
      { points: 500, weight: 1, label: 'JACKPOT 500! 💎' }
    ];

    const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = segments[0];
    let selectedIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      if (rand < segments[i].weight) {
        selected = segments[i];
        selectedIndex = i;
        break;
      }
      rand -= segments[i].weight;
    }

    // Credit reward
    user.points += selected.points;
    if (selected.points > spinCost) {
      user.totalEarned += (selected.points - spinCost);
    }

    const tx = {
      id: uuidv4(),
      userId: user.id,
      type: 'lucky_spin',
      points: selected.points - spinCost,
      usdAmount: (selected.points - spinCost) / this.data.settings.pointsPerUsd,
      description: `Lucky Spin: Won ${selected.label} (Net +${selected.points - spinCost} coins)`,
      timestamp: new Date().toISOString()
    };

    this.data.transactions.unshift(tx);
    this.save();

    return {
      segmentIndex: selectedIndex,
      wonPoints: selected.points,
      netGain: selected.points - spinCost,
      newTotalPoints: user.points,
      usdBalance: user.points / this.data.settings.pointsPerUsd
    };
  }

  // --- CASHOUT / WITHDRAWAL METHODS ---
  createPayoutRequest(userId, method, payoutDetails, pointsAmount) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const minUsd = this.data.settings.minWithdrawalUsd || 1.0;
    const minPoints = minUsd * this.data.settings.pointsPerUsd;

    if (pointsAmount < minPoints) {
      throw new Error(`Minimum withdrawal amount is $${minUsd.toFixed(2)} (${minPoints} points)`);
    }

    if (user.points < pointsAmount) {
      throw new Error('Insufficient coins balance for this withdrawal');
    }

    const usdValue = pointsAmount / this.data.settings.pointsPerUsd;

    // Deduct coins from user
    user.points -= pointsAmount;
    user.totalWithdrawn = (user.totalWithdrawn || 0) + pointsAmount;

    const payout = {
      id: 'payout_' + uuidv4().substring(0, 8),
      userId: user.id,
      username: user.username,
      method,
      payoutDetails,
      pointsDeducted: pointsAmount,
      usdAmount: usdValue,
      status: 'pending', // pending -> approved / paid / rejected
      txHash: null,
      adminNote: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.payout_requests.unshift(payout);

    this.data.transactions.unshift({
      id: uuidv4(),
      userId: user.id,
      type: 'withdrawal',
      points: -pointsAmount,
      usdAmount: -usdValue,
      description: `Withdrawal Request: $${usdValue.toFixed(2)} via ${method}`,
      timestamp: new Date().toISOString()
    });

    this.save();

    return payout;
  }

  // Admin approves or rejects payout
  updatePayoutStatus(payoutId, status, txHash = '', adminNote = '') {
    const payout = this.data.payout_requests.find(p => p.id === payoutId);
    if (!payout) throw new Error('Payout request not found');

    payout.status = status;
    payout.txHash = txHash || payout.txHash;
    payout.adminNote = adminNote || payout.adminNote;
    payout.updatedAt = new Date().toISOString();

    // If rejected, refund points to user
    if (status === 'rejected') {
      const user = this.findUserById(payout.userId);
      if (user) {
        user.points += payout.pointsDeducted;
        user.totalWithdrawn -= payout.pointsDeducted;

        this.data.transactions.unshift({
          id: uuidv4(),
          userId: user.id,
          type: 'refund',
          points: payout.pointsDeducted,
          usdAmount: payout.usdAmount,
          description: `Refund for rejected ${payout.method} withdrawal: ${adminNote || 'Reason not provided'}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.save();
    return payout;
  }

  // --- ADMIN METHODS ---
  getPlatformStats() {
    const totalUsers = this.data.users.length;
    const totalAdsWatched = this.data.ad_views.filter(v => v.completed).length;
    const totalPointsDistributed = this.data.transactions
      .filter(t => t.points > 0)
      .reduce((sum, t) => sum + t.points, 0);

    const totalPaidOutUsd = this.data.payout_requests
      .filter(p => p.status === 'paid' || p.status === 'approved')
      .reduce((sum, p) => sum + p.usdAmount, 0);

    const pendingPayoutsCount = this.data.payout_requests.filter(p => p.status === 'pending').length;

    // Platform estimated Ad Revenue (sum of completed ad impressions * CPM / 1000)
    let estimatedAdRevenue = 0;
    this.data.ad_views.filter(v => v.completed).forEach(v => {
      const camp = this.data.ad_campaigns.find(c => c.id === v.campaignId);
      if (camp && camp.cpmUsd) {
        estimatedAdRevenue += camp.cpmUsd / 1000;
      } else {
        estimatedAdRevenue += 0.015; // default fallback
      }
    });

    const netPlatformProfit = Math.max(0, estimatedAdRevenue - (totalPointsDistributed / this.data.settings.pointsPerUsd));

    return {
      totalUsers,
      totalAdsWatched,
      totalPointsDistributed,
      totalPointsDistributedUsd: totalPointsDistributed / this.data.settings.pointsPerUsd,
      totalPaidOutUsd,
      pendingPayoutsCount,
      estimatedAdRevenue,
      netPlatformProfit,
      activeCampaignsCount: this.data.ad_campaigns.filter(c => c.active).length
    };
  }

  addAdCampaign(campaign) {
    const newCamp = {
      id: 'ad_camp_' + uuidv4().substring(0, 6),
      title: campaign.title,
      advertiser: campaign.advertiser || 'Direct Sponsor',
      category: campaign.category || 'General',
      durationSeconds: parseInt(campaign.durationSeconds) || 15,
      rewardPoints: parseInt(campaign.rewardPoints) || 30,
      cpmUsd: parseFloat(campaign.cpmUsd) || 10.0,
      active: true,
      videoUrl: campaign.videoUrl,
      thumbnail: campaign.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
      ctaText: campaign.ctaText || 'Learn More',
      ctaUrl: campaign.ctaUrl || 'https://google.com',
      rating: 5.0,
      viewsRemaining: parseInt(campaign.viewsRemaining) || 10000,
      country: campaign.country || 'Global'
    };

    this.data.ad_campaigns.unshift(newCamp);
    this.save();
    return newCamp;
  }

  deleteCampaign(id) {
    this.data.ad_campaigns = this.data.ad_campaigns.filter(c => c.id !== id);
    this.save();
    return true;
  }

  toggleCampaign(id) {
    const camp = this.data.ad_campaigns.find(c => c.id === id);
    if (camp) {
      camp.active = !camp.active;
      this.save();
      return camp;
    }
    throw new Error('Campaign not found');
  }
}

const db = new Database();
module.exports = db;
