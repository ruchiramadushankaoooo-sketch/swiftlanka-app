/**
 * AdPulse Global — Watch & Earn Core Client Application
 */

class AdPulseApp {
  constructor() {
    this.token = localStorage.getItem('adpulse_token') || null;
    this.user = null;
    this.settings = { pointsPerUsd: 1000, minWithdrawalUsd: 1.0, dailyWatchLimit: 40 };
    this.campaigns = [];
    this.currentCategory = 'all';

    // Ad Watch State
    this.activeWatchSession = null; // { token, campaign, duration, remaining, timer, paused }
    this.wheelSpinning = false;
    this.wheelRotation = 0;

    // Audio Context (Synthesized Web Audio)
    this.audioCtx = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.initLuckyWheel();

    if (this.token) {
      await this.loadUserProfile();
    } else {
      // Auto login to demo user on first visit for seamless test drive experience
      await this.tryAutoDemoLogin();
    }

    await this.loadAdCampaigns();
    this.renderStreakGrid();
  }

  // Synthesized Sound Effects
  playAudio(type) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.2, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        });
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {
      console.warn('Audio Context error:', e);
    }
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    document.getElementById('btnLogoHome').addEventListener('click', () => this.switchTab('watch'));

    // Category filters
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.cat;
        this.renderAdCards();
      });
    });

    // Modals open/close
    document.getElementById('btnOpenLogin').addEventListener('click', () => this.openModal('modalLogin'));
    document.getElementById('btnOpenRegister').addEventListener('click', () => this.openModal('modalRegister'));
    document.getElementById('btnCloseLogin').addEventListener('click', () => this.closeModal('modalLogin'));
    document.getElementById('btnCloseRegister').addEventListener('click', () => this.closeModal('modalRegister'));
    document.getElementById('btnCloseRewardSuccess').addEventListener('click', () => this.closeModal('modalRewardSuccess'));
    
    document.getElementById('switchRegister').addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal('modalLogin');
      this.openModal('modalRegister');
    });

    document.getElementById('switchLogin').addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal('modalRegister');
      this.openModal('modalLogin');
    });

    // User Avatar Menu
    const avatarMenuBtn = document.getElementById('avatarMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    avatarMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      if (!userDropdown.classList.contains('hidden')) {
        userDropdown.classList.add('hidden');
      }
    });

    document.getElementById('btnQuickCashout').addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      this.switchTab('withdraw');
    });

    document.getElementById('btnQuickReferral').addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      this.switchTab('referral');
    });

    document.getElementById('btnLogout').addEventListener('click', () => this.logout());

    // Forms
    document.getElementById('formLogin').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('formRegister').addEventListener('submit', (e) => this.handleRegister(e));
    document.getElementById('formCashout').addEventListener('submit', (e) => this.handleCashout(e));

    // Daily streak & Lucky wheel
    document.getElementById('btnClaimDailyStreak').addEventListener('click', () => this.claimDailyStreak());
    document.getElementById('btnSpinWheel').addEventListener('click', () => this.spinLuckyWheel());

    // Referral Copy
    document.getElementById('btnCopyRefLink').addEventListener('click', () => this.copyReferralLink());

    // History refresh
    document.getElementById('btnRefreshHistory').addEventListener('click', () => this.loadWalletHistory());

    // Cashout Methods selection
    document.querySelectorAll('.method-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.updateCashoutFormMethod(card.dataset.method);
      });
    });

    // Cashout amount input live preview
    const payoutInput = document.getElementById('payoutCoinsInput');
    payoutInput.addEventListener('input', () => {
      const val = parseInt(payoutInput.value) || 0;
      const usd = (val / (this.settings.pointsPerUsd || 1000)).toFixed(2);
      document.getElementById('amountCalcPreview').innerHTML = `You will receive: <strong>$${usd} USD</strong>`;
      // Also update LKR preview if Commercial Bank SL is selected
      const activeMethod = document.querySelector('.method-card.active');
      if (activeMethod && activeMethod.dataset.method === 'Commercial Bank SL') {
        this.updateLkrPreview();
      }
    });

    document.getElementById('btnPayoutMax').addEventListener('click', () => {
      if (this.user) {
        payoutInput.value = this.user.points;
        payoutInput.dispatchEvent(new Event('input'));
      }
    });

    // Ad Reward Claim button
    document.getElementById('btnClaimAdReward').addEventListener('click', () => this.claimAdReward());

    // Admin campaign modal
    document.getElementById('btnOpenNewCampaignModal').addEventListener('click', () => this.openModal('modalNewCampaign'));
    document.getElementById('btnCloseNewCampaign').addEventListener('click', () => this.closeModal('modalNewCampaign'));
    document.getElementById('formNewCampaign').addEventListener('submit', (e) => this.handleCreateCampaign(e));

    // Anti-Cheat: Visibility / Tab Focus Detector
    document.addEventListener('visibilitychange', () => {
      if (this.activeWatchSession) {
        const video = document.getElementById('adVideoElement');
        const cheatWarn = document.getElementById('tabCheatWarning');
        if (document.hidden) {
          // User switched tab or minimized window -> PAUSE
          this.activeWatchSession.paused = true;
          video.pause();
          cheatWarn.classList.remove('hidden');
        } else {
          // User came back
          this.activeWatchSession.paused = false;
          video.play().catch(() => {});
          cheatWarn.classList.add('hidden');
        }
      }
    });
  }

  // --- NAVIGATION ---
  switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(b => {
      if (b.dataset.tab === tabId) b.classList.add('active');
      else b.classList.remove('active');
    });

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add('active');

    // Specific tab triggers
    if (tabId === 'history' || tabId === 'withdraw') {
      this.loadWalletHistory();
    } else if (tabId === 'referral') {
      this.loadReferrals();
    } else if (tabId === 'admin') {
      this.loadAdminStats();
    } else if (tabId === 'arena') {
      this.renderStreakGrid();
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'gold' ? 'toast-gold' : ''}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-xmark text-danger' : type === 'gold' ? 'fa-crown text-gold' : 'fa-circle-check text-accent'}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- AUTHENTICATION ---
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      this.token = data.token;
      this.user = data.user;
      this.settings = data.settings;
      localStorage.setItem('adpulse_token', this.token);

      this.closeModal('modalLogin');
      this.updateUserUI();
      this.showToast(`Welcome back, ${this.user.username}!`, 'success');
      this.playAudio('win');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const referralCode = document.getElementById('regReferral').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, referralCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      this.token = data.token;
      this.user = data.user;
      this.settings = data.settings;
      localStorage.setItem('adpulse_token', this.token);

      this.closeModal('modalRegister');
      this.updateUserUI();
      this.showToast(`Account created! +100 Coins Bonus added 🎉`, 'gold');
      this.playAudio('win');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async tryAutoDemoLogin() {
    // If not logged in, auto-login with demo user so visitor immediately sees fully populated app
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@adpulse.com', password: 'demo123' })
      });
      const data = await res.json();
      if (res.ok) {
        this.token = data.token;
        this.user = data.user;
        this.settings = data.settings;
        localStorage.setItem('adpulse_token', this.token);
        this.updateUserUI();
      }
    } catch (e) {
      console.warn('Auto demo login skipped:', e);
    }
  }

  async loadUserProfile() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-auth-token': this.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        this.settings = data.settings;
        this.updateUserUI();
      } else {
        this.logout();
      }
    } catch (e) {
      console.error('Failed to load user profile:', e);
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('adpulse_token');
    document.getElementById('loggedOutActions').classList.remove('hidden');
    document.getElementById('loggedInActions').classList.add('hidden');
    document.getElementById('adminNavTab').classList.add('hidden');
    this.showToast('You have been logged out.');
  }

  updateUserUI() {
    if (!this.user) return;

    document.getElementById('loggedOutActions').classList.add('hidden');
    document.getElementById('loggedInActions').classList.remove('hidden');

    // Balance update
    const pts = this.user.points || 0;
    const usd = (pts / (this.settings.pointsPerUsd || 1000)).toFixed(2);
    
    document.getElementById('headerCoins').innerText = pts.toLocaleString();
    document.getElementById('headerUsd').innerText = `$${usd}`;
    document.getElementById('userDisplayName').innerText = this.user.username;
    document.getElementById('userInitial').innerText = this.user.username.charAt(0).toUpperCase();
    document.getElementById('dropdownEmail').innerText = this.user.email;
    document.getElementById('dropdownRole').innerText = this.user.role === 'admin' ? 'Super Admin' : 'VIP Earner';

    // Show Admin Nav Tab if admin
    if (this.user.role === 'admin') {
      document.getElementById('adminNavTab').classList.remove('hidden');
    } else {
      document.getElementById('adminNavTab').classList.add('hidden');
    }

    // Daily limit bar
    const watched = this.user.adsWatchedToday || 0;
    const limit = this.settings.dailyWatchLimit || 40;
    document.getElementById('watchDailyLimit').innerText = `${watched} / ${limit}`;
    const pct = Math.min(100, Math.round((watched / limit) * 100));
    document.getElementById('dailyLimitBar').style.width = `${pct}%`;

    // Withdraw tab balance
    document.getElementById('withdrawCoinsVal').innerText = pts.toLocaleString();
    document.getElementById('withdrawUsdVal').innerText = `≈ $${usd} USD`;
  }

  // --- AD CAMPAIGNS & WATCHING ENGINE ---
  async loadAdCampaigns() {
    try {
      const res = await fetch('/api/ads/campaigns', {
        headers: this.token ? { 'x-auth-token': this.token } : {}
      });
      const data = await res.json();
      if (res.ok) {
        this.campaigns = data.campaigns || [];
        this.aAds = data.aAds || { enabled: false };
        this.renderAdCards();
        this.mountAAdsBanners();
      }
    } catch (e) {
      console.error('Failed to load campaigns:', e);
    }
  }

  mountAAdsBanners() {
    if (!this.aAds || !this.aAds.enabled || !this.aAds.adUnitId) return;

    const unitId = this.aAds.adUnitId;
    const iframeHtml = `<iframe data-aa='${unitId}' src='//acceptable.a-ads.com/${unitId}' style='border:0px; padding:0; width:100%; max-width:728px; height:90px; overflow:hidden; background-color: transparent;'></iframe>`;

    const bannerBox = document.getElementById('aadsBannerWatch');
    const iframeWrap = document.getElementById('aadsIframeWatch');
    if (bannerBox && iframeWrap) {
      iframeWrap.innerHTML = iframeHtml;
      bannerBox.classList.remove('hidden');
    }

    const playerBox = document.getElementById('aadsPlayerBanner');
    const playerWrap = document.getElementById('aadsIframePlayer');
    if (playerBox && playerWrap) {
      playerWrap.innerHTML = iframeHtml;
      playerBox.classList.remove('hidden');
    }
  }

  renderAdCards() {
    const container = document.getElementById('adsGrid');
    container.innerHTML = '';

    const filtered = this.campaigns.filter(c => {
      if (this.currentCategory === 'all') return true;
      return c.category === this.currentCategory;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="glass-card text-center text-muted" style="grid-column: 1/-1; padding: 40px;">No active campaigns in this category right now. Check back soon!</div>`;
      return;
    }

    filtered.forEach(camp => {
      const card = document.createElement('div');
      card.className = 'glass-card ad-card';
      const usdEst = (camp.rewardPoints / (this.settings.pointsPerUsd || 1000)).toFixed(3);

      card.innerHTML = `
        <div class="ad-thumbnail-box" style="background-image: url('${camp.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80'}');">
          <div class="ad-thumbnail-overlay">
            <div class="ad-top-badges">
              <span class="ad-cat-badge">${camp.category}</span>
              <span class="ad-duration-badge"><i class="fa-solid fa-clock"></i> ${camp.durationSeconds}s</span>
            </div>
            <div class="ad-play-hover-btn">
              <i class="fa-solid fa-play"></i>
            </div>
            <div></div>
          </div>
        </div>
        <div class="ad-card-body">
          <span class="ad-advertiser-name">${camp.advertiser}</span>
          <h3 class="ad-card-title">${camp.title}</h3>
          <div class="ad-card-footer">
            <div class="ad-reward-pill">
              <i class="fa-solid fa-coins"></i>
              <span>+${camp.rewardPoints} Coins</span>
            </div>
            <span class="ad-reward-usd">≈ $${usdEst} USD</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.startWatchingAd(camp.id));
      container.appendChild(card);
    });
  }

  async startWatchingAd(campaignId) {
    if (!this.user) {
      this.openModal('modalLogin');
      this.showToast('Please log in to watch ads and earn rewards.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/ads/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ campaignId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start ad session');

      const camp = data.campaign;
      this.activeWatchSession = {
        token: data.watchToken,
        campaign: camp,
        duration: camp.durationSeconds,
        remaining: camp.durationSeconds,
        paused: false,
        timer: null
      };

      // Populate Player Modal
      document.getElementById('adModalTitle').innerText = camp.title;
      document.getElementById('adModalAdvertiser').innerText = camp.advertiser;
      document.getElementById('adModalReward').innerText = `+${camp.rewardPoints} Coins`;
      document.getElementById('adModalCountdown').innerText = `${camp.durationSeconds}s`;
      document.getElementById('adModalBtnCountdown').innerText = `${camp.durationSeconds}s`;
      document.getElementById('adModalCtaText').innerText = camp.ctaText || 'Visit Sponsor';
      document.getElementById('adModalCtaLink').href = camp.ctaUrl || '#';
      document.getElementById('adProgressBarFill').style.width = '0%';

      const btnClaim = document.getElementById('btnClaimAdReward');
      btnClaim.classList.add('disabled');
      btnClaim.disabled = true;
      btnClaim.innerHTML = `<i class="fa-solid fa-lock"></i> Watch to Complete (<span id="adModalBtnCountdown">${camp.durationSeconds}s</span>)`;

      // Setup Video
      const video = document.getElementById('adVideoElement');
      const loader = document.getElementById('videoLoader');
      loader.classList.remove('hidden');

      video.src = camp.videoUrl;
      video.muted = true; // Auto-play compliant
      video.autoplay = true;

      video.onloadeddata = () => {
        loader.classList.add('hidden');
        video.play().catch(() => {});
      };

      this.openModal('modalAdPlayer');

      // Start Countdown Timer
      this.runWatchTimer();

    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  runWatchTimer() {
    if (this.activeWatchSession.timer) clearInterval(this.activeWatchSession.timer);

    const totalDuration = this.activeWatchSession.duration;

    this.activeWatchSession.timer = setInterval(() => {
      if (this.activeWatchSession.paused) return;

      this.activeWatchSession.remaining -= 0.5;
      const rem = Math.max(0, Math.ceil(this.activeWatchSession.remaining));
      
      const pct = Math.min(100, Math.round(((totalDuration - this.activeWatchSession.remaining) / totalDuration) * 100));
      document.getElementById('adProgressBarFill').style.width = `${pct}%`;
      document.getElementById('adModalCountdown').innerText = `${rem}s`;

      const btnCountdownSpan = document.getElementById('adModalBtnCountdown');
      if (btnCountdownSpan) btnCountdownSpan.innerText = `${rem}s`;

      if (this.activeWatchSession.remaining <= 0) {
        clearInterval(this.activeWatchSession.timer);
        this.onAdWatchCompleted();
      }
    }, 500);
  }

  onAdWatchCompleted() {
    const btnClaim = document.getElementById('btnClaimAdReward');
    btnClaim.classList.remove('disabled');
    btnClaim.disabled = false;
    btnClaim.innerHTML = `<i class="fa-solid fa-sparkles"></i> Claim +${this.activeWatchSession.campaign.rewardPoints} Coins Now!`;
    document.getElementById('adModalCountdown').innerHTML = `<i class="fa-solid fa-check text-accent"></i> Ready!`;
    this.playAudio('tick');
  }

  async claimAdReward() {
    if (!this.activeWatchSession) return;

    try {
      const res = await fetch('/api/ads/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ watchToken: this.activeWatchSession.token })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim reward');

      const wonCoins = data.pointsAwarded;
      this.user.points = data.newTotalPoints;
      this.user.adsWatchedToday = (this.user.adsWatchedToday || 0) + 1;
      this.updateUserUI();

      // Close Player Modal
      const video = document.getElementById('adVideoElement');
      video.pause();
      video.src = '';
      this.closeModal('modalAdPlayer');

      // Open Reward Celebration Modal
      document.getElementById('rewardEarnedAmount').innerText = `+${wonCoins}`;
      document.getElementById('rewardDescText').innerText = `Successfully completed "${this.activeWatchSession.campaign.title}"! ${wonCoins} coins credited to your wallet balance.`;
      this.openModal('modalRewardSuccess');
      this.playAudio('win');

      this.activeWatchSession = null;
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- EARN ARENA: STREAK & LUCKY WHEEL ---
  renderStreakGrid() {
    const container = document.getElementById('streakGrid');
    if (!container) return;
    container.innerHTML = '';

    const bonuses = this.settings.dailyStreakBonuses || [20, 40, 60, 80, 120, 160, 300];
    const userStreak = this.user ? this.user.streakDays : 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const isClaimedToday = this.user && this.user.lastStreakDate === todayStr;

    bonuses.forEach((pts, i) => {
      const dayNum = i + 1;
      const isClaimed = dayNum < userStreak || (dayNum === userStreak && isClaimedToday);
      const isCurrent = dayNum === userStreak && !isClaimedToday;

      const card = document.createElement('div');
      card.className = `streak-day-item ${isClaimed ? 'claimed' : ''} ${isCurrent ? 'current' : ''}`;
      card.innerHTML = `
        <span class="streak-day-lbl">DAY ${dayNum}</span>
        <div class="streak-icon">
          <i class="fa-solid ${dayNum === 7 ? 'fa-gem' : 'fa-coins'}"></i>
        </div>
        <span class="streak-points text-gold">+${pts}</span>
        <span style="font-size: 10px; color: ${isClaimed ? 'var(--accent-emerald)' : isCurrent ? 'var(--accent-gold)' : 'var(--text-muted)'}">
          ${isClaimed ? '✓ Claimed' : isCurrent ? 'Ready!' : 'Locked'}
        </span>
      `;
      container.appendChild(card);
    });

    const btn = document.getElementById('btnClaimDailyStreak');
    if (isClaimedToday) {
      btn.classList.add('disabled');
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Claimed for Today`;
    } else {
      btn.classList.remove('disabled');
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-gift"></i> Claim Day ${userStreak} Reward`;
    }
  }

  async claimDailyStreak() {
    if (!this.user) {
      this.openModal('modalLogin');
      return;
    }

    try {
      const res = await fetch('/api/earn/daily-streak', {
        method: 'POST',
        headers: { 'x-auth-token': this.token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim daily streak');

      this.user.points = data.newTotalPoints;
      this.user.streakDays = data.streakDays;
      this.user.lastStreakDate = new Date().toISOString().split('T')[0];
      this.updateUserUI();
      this.renderStreakGrid();

      this.showToast(`🔥 Day ${data.streakDays} Streak Claimed! +${data.rewardPoints} Coins added!`, 'gold');
      this.playAudio('win');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- LUCKY WHEEL CANVAS ENGINE ---
  initLuckyWheel() {
    this.wheelCanvas = document.getElementById('luckyWheelCanvas');
    if (!this.wheelCanvas) return;
    this.wheelCtx = this.wheelCanvas.getContext('2d');
    this.wheelSegments = [
      { points: 5, label: '5 Coins', color: '#1e293b' },
      { points: 15, label: '15 Coins', color: '#334155' },
      { points: 30, label: '30 Coins', color: '#0ea5e9' },
      { points: 50, label: '50 Coins', color: '#8b5cf6' },
      { points: 100, label: '100 Coins', color: '#ec4899' },
      { points: 250, label: '250 Coins 🔥', color: '#f59e0b' },
      { points: 500, label: 'JACKPOT 500 💎', color: '#10b981' }
    ];
    this.drawWheel(0);
  }

  drawWheel(rotationAngle) {
    const ctx = this.wheelCtx;
    const canvas = this.wheelCanvas;
    const numSegments = this.wheelSegments.length;
    const arcSize = (2 * Math.PI) / numSegments;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Outer Glow Rim
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 6;
    ctx.stroke();

    for (let i = 0; i < numSegments; i++) {
      const angle = rotationAngle + (i * arcSize);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
      ctx.fillStyle = this.wheelSegments[i].color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(this.wheelSegments[i].label, radius - 20, 5);
      ctx.restore();
    }

    // Center Gold Pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', centerX, centerY);
  }

  async spinLuckyWheel() {
    if (this.wheelSpinning) return;
    if (!this.user) {
      this.openModal('modalLogin');
      return;
    }

    if (this.user.points < 10) {
      this.showToast('You need at least 10 coins to spin the wheel!', 'error');
      return;
    }

    this.wheelSpinning = true;
    const btn = document.getElementById('btnSpinWheel');
    btn.disabled = true;
    document.getElementById('spinResultHint').innerText = 'Spinning for big multipliers...';

    try {
      const res = await fetch('/api/earn/spin', {
        method: 'POST',
        headers: { 'x-auth-token': this.token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Spin failed');

      // Calculate Target Angle so pointer stops directly on target segment
      const numSegments = this.wheelSegments.length;
      const arcSize = (2 * Math.PI) / numSegments;
      const targetIndex = data.segmentIndex;
      // Pointer is at the top (angle: -PI/2)
      const targetSegmentCenterAngle = (targetIndex * arcSize) + (arcSize / 2);
      const targetStopAngle = (1.5 * Math.PI) - targetSegmentCenterAngle;

      const extraSpins = 6 * (2 * Math.PI); // 6 full rotations
      const finalAngle = extraSpins + (targetStopAngle % (2 * Math.PI));

      let currentAngle = this.wheelRotation % (2 * Math.PI);
      const startTime = performance.now();
      const spinDuration = 4000; // 4 seconds spin animation

      const animateWheel = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / spinDuration);
        // Ease out cubic deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentRot = currentAngle + (finalAngle - currentAngle) * easeProgress;

        this.drawWheel(currentRot);

        if (Math.floor(elapsed / 120) !== Math.floor((elapsed - 16) / 120)) {
          this.playAudio('tick');
        }

        if (progress < 1) {
          requestAnimationFrame(animateWheel);
        } else {
          // Finished spin
          this.wheelRotation = finalAngle;
          this.wheelSpinning = false;
          btn.disabled = false;

          this.user.points = data.newTotalPoints;
          this.updateUserUI();

          document.getElementById('spinResultHint').innerHTML = `🎉 Won <strong>${data.wonPoints} Coins</strong>! (Net: +${data.netGain})`;
          this.showToast(`🎡 Lucky Spin: Won ${data.wonPoints} Coins!`, 'gold');
          this.playAudio('win');
        }
      };

      requestAnimationFrame(animateWheel);

    } catch (err) {
      this.wheelSpinning = false;
      btn.disabled = false;
      this.showToast(err.message, 'error');
    }
  }

  // Quick micro-quest reward simulation
  completeQuickQuest(type) {
    if (!this.user) {
      this.openModal('modalLogin');
      return;
    }
    this.user.points += 50;
    this.updateUserUI();
    this.showToast(`🎉 Quest completed! +50 Coins credited.`, 'gold');
    this.playAudio('coin');
  }

  // --- CASHOUT / WITHDRAWALS ---
  updateCashoutFormMethod(method) {
    const label = document.getElementById('payoutDestinationLabel');
    const input = document.getElementById('payoutDetailsInput');
    const bankSlFields = document.getElementById('bankSlFields');
    const lkrPreview = document.getElementById('lkrCalcPreview');

    // Hide SL bank fields and LKR preview by default
    bankSlFields.classList.add('hidden');
    lkrPreview.classList.add('hidden');

    if (method === 'PayPal') {
      label.innerText = 'PayPal Account Email';
      input.placeholder = 'your-email@paypal.com';
      input.type = 'email';
    } else if (method === 'USDT-TRC20') {
      label.innerText = 'USDT (TRC-20 or BEP-20) Wallet Address';
      input.placeholder = 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      input.type = 'text';
    } else if (method === 'Bitcoin') {
      label.innerText = 'Bitcoin (BTC) Wallet Address';
      input.placeholder = 'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      input.type = 'text';
    } else if (method === 'UPI / Bank Transfer') {
      label.innerText = 'UPI ID or Bank Account Details (IFSC / IBAN)';
      input.placeholder = 'username@okhdfcbank or Account+IFSC';
      input.type = 'text';
    } else if (method === 'Commercial Bank SL') {
      label.innerText = 'Commercial Bank Account Number';
      input.placeholder = 'e.g. 8xxxxxxxxx (Savings / Current)';
      input.type = 'text';
      bankSlFields.classList.remove('hidden');
      lkrPreview.classList.remove('hidden');
      // Update LKR preview with current coin input
      this.updateLkrPreview();
    } else {
      label.innerText = 'Gift Card Delivery Email Address';
      input.placeholder = 'where-to-send-code@example.com';
      input.type = 'email';
    }
  }

  updateLkrPreview() {
    const lkrRate = 298; // 1 USD ≈ 298 LKR (approximate rate)
    const coinsInput = parseInt(document.getElementById('payoutCoinsInput').value) || 0;
    const usd = coinsInput / (this.settings.pointsPerUsd || 1000);
    const lkr = (usd * lkrRate).toFixed(2);
    const lkrEl = document.getElementById('lkrCalcPreview');
    if (lkrEl) {
      lkrEl.innerHTML = `\u2248 <strong>LKR ${Number(lkr).toLocaleString()}</strong> (rate: 1 USD \u2248 ${lkrRate} LKR)`;
    }
  }

  async handleCashout(e) {
    e.preventDefault();
    if (!this.user) {
      this.openModal('modalLogin');
      return;
    }

    const activeMethodCard = document.querySelector('.method-card.active');
    const method = activeMethodCard ? activeMethodCard.dataset.method : 'PayPal';
    let payoutDetails = document.getElementById('payoutDetailsInput').value;
    const pointsAmount = parseInt(document.getElementById('payoutCoinsInput').value);

    // If Commercial Bank SL, bundle all bank fields into payoutDetails
    if (method === 'Commercial Bank SL') {
      const branch = document.getElementById('bankSlBranch').value.trim();
      const holderName = document.getElementById('bankSlHolderName').value.trim();
      const nic = document.getElementById('bankSlNic').value.trim();

      if (!branch || !holderName) {
        this.showToast('Please fill in Branch Name and Account Holder Name for Commercial Bank.', 'error');
        return;
      }

      const lkrRate = 298;
      const usdVal = pointsAmount / (this.settings.pointsPerUsd || 1000);
      const lkrVal = (usdVal * lkrRate).toFixed(2);

      payoutDetails = `Acc: ${payoutDetails} | Branch: ${branch} | Name: ${holderName}${nic ? ' | NIC: ' + nic : ''} | LKR: ${lkrVal}`;
    }

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ method, payoutDetails, pointsAmount })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal submission failed');

      this.user.points = data.newTotalPoints;
      this.updateUserUI();
      this.loadWalletHistory();

      // Hide SL bank fields and reset form
      document.getElementById('bankSlFields').classList.add('hidden');
      document.getElementById('lkrCalcPreview').classList.add('hidden');
      document.getElementById('formCashout').reset();

      const lkrMsg = method === 'Commercial Bank SL' ? ` (≈ LKR ${(data.payout.usdAmount * 298).toFixed(0)})` : '';
      this.showToast(`Withdrawal request for $${data.payout.usdAmount.toFixed(2)}${lkrMsg} submitted successfully! 🚀`, 'gold');
      this.playAudio('win');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async loadWalletHistory() {
    if (!this.token) return;

    try {
      const res = await fetch('/api/wallet/transactions', {
        headers: { 'x-auth-token': this.token }
      });
      const data = await res.json();
      if (res.ok) {
        // Transactions Table
        const txTbody = document.getElementById('transactionsTableBody');
        if (data.transactions.length === 0) {
          txTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No transactions found yet.</td></tr>`;
        } else {
          txTbody.innerHTML = data.transactions.map(t => `
            <tr>
              <td><span class="badge-tag ${t.points > 0 ? 'badge-gold' : 'badge-purple'}">${t.type.toUpperCase()}</span></td>
              <td>${t.description}</td>
              <td class="${t.points > 0 ? 'text-accent' : 'text-danger'}" style="font-weight: 700">
                ${t.points > 0 ? '+' : ''}${t.points} Coins
              </td>
              <td>$${Math.abs(t.usdAmount).toFixed(3)}</td>
              <td class="text-muted">${new Date(t.timestamp).toLocaleString()}</td>
            </tr>
          `).join('');
        }

        // Payouts Table
        const payTbody = document.getElementById('payoutsTableBody');
        if (data.payoutRequests.length === 0) {
          payTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No payout requests recorded.</td></tr>`;
        } else {
          payTbody.innerHTML = data.payoutRequests.map(p => `
            <tr>
              <td><code>${p.id}</code></td>
              <td><strong>${p.method}</strong></td>
              <td class="text-muted">${p.payoutDetails}</td>
              <td>${p.pointsDeducted}</td>
              <td class="text-accent" style="font-weight: 700">$${p.usdAmount.toFixed(2)}</td>
              <td><span class="badge-status status-${p.status}">${p.status}</span></td>
              <td class="text-muted">${new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load wallet history:', e);
    }
  }

  // --- REFERRAL SYSTEM ---
  async loadReferrals() {
    if (!this.token) return;

    try {
      const res = await fetch('/api/referrals', {
        headers: { 'x-auth-token': this.token }
      });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('referralLinkInput').value = data.referralLink;
        document.getElementById('refTotalInvited').innerText = data.totalInvited;
        document.getElementById('refTotalEarnedCoins').innerText = `+${data.totalCommissionPoints}`;
        document.getElementById('refTotalEarnedUsd').innerText = `$${data.totalCommissionUsd.toFixed(2)}`;

        const tbody = document.getElementById('referralTableBody');
        if (data.invitedUsers.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No friends invited yet. Share your link!</td></tr>`;
        } else {
          tbody.innerHTML = data.invitedUsers.map(u => `
            <tr>
              <td><strong>${u.referredUsername}</strong></td>
              <td>${new Date(u.createdAt).toLocaleDateString()}</td>
              <td class="text-gold">+${u.totalCommissionEarned} Coins</td>
              <td><span class="badge-status status-paid">ACTIVE</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load referrals:', e);
    }
  }

  copyReferralLink() {
    const input = document.getElementById('referralLinkInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    this.showToast('Referral link copied to clipboard! Share it with friends.', 'success');
  }

  // --- ADMIN COMMAND CENTER ---
  async loadAdminStats() {
    if (!this.token || this.user.role !== 'admin') return;

    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-auth-token': this.token }
      });
      const data = await res.json();
      if (res.ok) {
        const stats = data.stats;
        document.getElementById('admTotalUsers').innerText = stats.totalUsers;
        document.getElementById('admTotalViews').innerText = stats.totalAdsWatched;
        document.getElementById('admEstRevenue').innerText = `$${stats.estimatedAdRevenue.toFixed(2)}`;
        document.getElementById('admPaidOut').innerText = `$${stats.totalPaidOutUsd.toFixed(2)}`;
        document.getElementById('admNetProfit').innerText = `$${stats.netPlatformProfit.toFixed(2)}`;
        document.getElementById('admPendingCount').innerText = `${stats.pendingPayoutsCount} Pending`;

        // Payment Gateways Status Cards
        const gwGrid = document.getElementById('admGatewaysGrid');
        if (gwGrid && data.gatewayStatus) {
          const gw = data.gatewayStatus;
          gwGrid.innerHTML = `
            <div class="gateway-status-card">
              <div class="gateway-card-header">
                <span class="gateway-title"><i class="fa-brands fa-paypal text-cyan"></i> PayPal Payouts API</span>
                <span class="badge-tag ${gw.paypal.configured ? 'badge-emerald' : 'badge-purple'}">
                  ${gw.paypal.configured ? gw.paypal.mode : 'Demo / Simulated'}
                </span>
              </div>
              <p class="gateway-desc">Automated instant USD payouts directly into earner PayPal accounts.</p>
              <div class="gateway-footer">
                <span class="text-muted">Status: <strong>${gw.paypal.configured ? 'Live Connected' : 'Simulation Mode'}</strong></span>
                <span class="text-accent" style="font-size: 11px;">Keys in <code>config.js</code></span>
              </div>
            </div>

            <div class="gateway-status-card">
              <div class="gateway-card-header">
                <span class="gateway-title"><i class="fa-brands fa-bitcoin text-gold"></i> NOWPayments Crypto</span>
                <span class="badge-tag ${gw.nowpayments.configured ? 'badge-emerald' : 'badge-purple'}">
                  ${gw.nowpayments.configured ? gw.nowpayments.mode : 'Demo / Simulated'}
                </span>
              </div>
              <p class="gateway-desc">Instant cryptocurrency withdrawals (USDT TRC20, Bitcoin, etc.) on blockchain.</p>
              <div class="gateway-footer">
                <span class="text-muted">Status: <strong>${gw.nowpayments.configured ? 'Live Connected' : 'Simulation Mode'}</strong></span>
                <span class="text-gold" style="font-size: 11px;">Keys in <code>config.js</code></span>
              </div>
            </div>

            <div class="gateway-status-card">
              <div class="gateway-card-header">
                <span class="gateway-title"><i class="fa-solid fa-building-columns text-accent"></i> Commercial Bank SL</span>
                <span class="badge-tag badge-emerald">Active (LKR Transfer)</span>
              </div>
              <p class="gateway-desc">Direct LKR bank deposits to Commercial Bank of Ceylon accounts in Sri Lanka.</p>
              <div class="gateway-footer">
                <span class="text-muted">Exchange Rate: <strong>${gw.commercialBankSL?.exchangeRate || '298 LKR / USD'}</strong></span>
                <span class="text-cyan" style="font-size: 11px;">Auto Ref Generator</span>
              </div>
            </div>
          `;
        }

        // Payouts Admin Queue
        const payTbody = document.getElementById('admPayoutsTableBody');
        if (data.payouts.length === 0) {
          payTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No payout requests in system.</td></tr>`;
        } else {
          payTbody.innerHTML = data.payouts.map(p => `
            <tr>
              <td><code>${p.id}</code></td>
              <td><strong>${p.username}</strong></td>
              <td><strong>${p.method}</strong></td>
              <td><small>${p.payoutDetails}</small>${p.txHash ? `<br><small class="text-cyan font-mono" style="font-size:11px;">Ref: ${p.txHash}</small>` : ''}</td>
              <td class="text-accent" style="font-weight:700;">$${p.usdAmount.toFixed(2)}${p.method.includes('Commercial Bank') ? `<br><small class="text-gold">≈ LKR ${(p.usdAmount * 298).toFixed(0)}</small>` : ''}</td>
              <td>${new Date(p.createdAt).toLocaleDateString()}</td>
              <td>
                ${p.status === 'pending' ? `
                  <button class="btn btn-sm btn-primary" onclick="app.actionPayout('${p.id}', 'paid', '${p.method.replace(/'/g, "\\'")}')"><i class="fa-solid fa-paper-plane"></i> Execute Pay</button>
                  <button class="btn btn-sm btn-outline text-danger" onclick="app.actionPayout('${p.id}', 'rejected', '${p.method.replace(/'/g, "\\'")}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                ` : `<span class="badge-status status-${p.status}">${p.status.toUpperCase()}</span>`}
              </td>
            </tr>
          `).join('');
        }

        // Campaigns Admin List
        const campTbody = document.getElementById('admCampaignsTableBody');
        campTbody.innerHTML = data.campaigns.map(c => `
          <tr>
            <td><strong>${c.title}</strong><br><small class="text-muted">${c.advertiser}</small></td>
            <td>${c.category}</td>
            <td>${c.durationSeconds}s</td>
            <td class="text-gold">+${c.rewardPoints} Coins</td>
            <td class="text-accent">$${c.cpmUsd.toFixed(2)}</td>
            <td>${c.viewsRemaining.toLocaleString()}</td>
            <td><span class="badge-status ${c.active ? 'status-paid' : 'status-rejected'}">${c.active ? 'ACTIVE' : 'PAUSED'}</span></td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="app.toggleCampaign('${c.id}')"><i class="fa-solid fa-power-off"></i></button>
              <button class="btn btn-sm btn-outline text-danger" onclick="app.deleteCampaign('${c.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    }
  }

  async actionPayout(payoutId, status, method = '') {
    try {
      let bankRef = '';
      if (status === 'paid' && method.includes('Commercial Bank')) {
        const inputRef = prompt(`Commercial Bank SL Transfer:\nEnter Bank Transfer Reference Number (or leave empty to auto-generate):`, '');
        if (inputRef === null) return; // User cancelled
        bankRef = inputRef.trim();
      }

      const res = await fetch('/api/admin/payouts/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ payoutId, status, bankRef })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (status === 'paid') {
        const note = data.payout.adminNote || (data.gatewayResult && data.gatewayResult.note) || 'Disbursed successfully';
        this.showToast(`✅ Payout Processed! ${note}`, 'success');
        this.playAudio('win');
      } else {
        this.showToast(`Payout marked as ${status.toUpperCase()} (Coins refunded to earner)!`, 'error');
      }

      this.loadAdminStats();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleCreateCampaign(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('campTitle').value,
      advertiser: document.getElementById('campAdvertiser').value,
      category: document.getElementById('campCategory').value,
      durationSeconds: parseInt(document.getElementById('campDuration').value),
      rewardPoints: parseInt(document.getElementById('campReward').value),
      cpmUsd: parseFloat(document.getElementById('campCpm').value),
      videoUrl: document.getElementById('campVideoUrl').value,
      ctaUrl: document.getElementById('campCtaUrl').value
    };

    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      this.closeModal('modalNewCampaign');
      document.getElementById('formNewCampaign').reset();
      this.showToast('New Ad Campaign launched live! 🚀', 'gold');
      this.loadAdCampaigns();
      this.loadAdminStats();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async toggleCampaign(campaignId) {
    try {
      const res = await fetch('/api/admin/campaigns/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ campaignId })
      });
      if (res.ok) {
        this.showToast('Campaign status updated');
        this.loadAdCampaigns();
        this.loadAdminStats();
      }
    } catch (e) {
      this.showToast('Failed to toggle campaign', 'error');
    }
  }

  async deleteCampaign(campaignId) {
    if (!confirm('Are you sure you want to delete this ad campaign?')) return;
    try {
      const res = await fetch('/api/admin/campaigns/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': this.token
        },
        body: JSON.stringify({ campaignId })
      });
      if (res.ok) {
        this.showToast('Campaign deleted');
        this.loadAdCampaigns();
        this.loadAdminStats();
      }
    } catch (e) {
      this.showToast('Failed to delete campaign', 'error');
    }
  }
}

// Instantiate global app instance
const app = new AdPulseApp();
window.app = app;
