// index.js
Component({
  data: {
    showLoginModal: false,
  },

  lifetimes: {
    attached() {
      // 延迟检查，等待 app.js 的 doLogin 执行完毕
      setTimeout(() => {
        this.checkLoginModal();
      }, 1000);
    },
  },

  pageLifetimes: {
    show() {
      this.checkLoginModal();
    },
  },

  methods: {
    /**
     * 检查是否需要显示手机号登录弹窗
     */
    checkLoginModal() {
      const app = getApp();
      if (app.globalData.needPhoneLogin && !app.globalData.isLogin) {
        this.setData({ showLoginModal: true });
      }
    },

    /**
     * 关闭登录弹窗
     */
    closeLoginModal() {
      this.setData({ showLoginModal: false });
    },

    /**
     * 获取手机号回调
     * 用户点击按钮授权手机号后触发
     */
    async onGetPhoneNumber(e) {
      const { code, errMsg } = e.detail;

      if (errMsg !== 'getPhoneNumber:ok' || !code) {
        console.warn('[Login] 用户拒绝手机号授权:', errMsg);
        wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      console.log('[Login] 获取到手机号 code:', code);

      try {
        wx.showLoading({ title: '登录中...', mask: true });

        // Step 1: 用手机号 code 换取真实手机号码
        const purePhoneNumber = await this.getPhoneNumber(code);
        if (!purePhoneNumber) {
          wx.hideLoading();
          wx.showToast({ title: '获取手机号失败', icon: 'none' });
          return;
        }

        console.log('[Login] 获取到手机号:', purePhoneNumber);

        // Step 2: 用 openid + 手机号 注册
        const app = getApp();
        const res = await this.register(app.globalData.openid, purePhoneNumber);

        wx.hideLoading();

        const isSuccess = res && (res.result || res.success || res.code === 0);

        if (isSuccess) {
          const data = res.data || {};
          const user = data.user || {};
          app.globalData.token = data.token || '';
          app.globalData.userId = user.id || data.userId || data.id || '';
          app.globalData.userInfo = (user.nickname || user.avatar) ? user : (data.userInfo || null);
          app.globalData.isLogin = true;
          app.globalData.needPhoneLogin = false;

          wx.setStorageSync('token', app.globalData.token);
          wx.setStorageSync('userId', app.globalData.userId);
          wx.setStorageSync('userInfo', app.globalData.userInfo);

          this.setData({ showLoginModal: false });
          wx.showToast({ title: '登录成功', icon: 'success' });
          console.log('[Login] 注册登录成功，userId:', app.globalData.userId);
        } else {
          wx.showToast({ title: (res && res.message) || '登录失败，请重试', icon: 'none' });
        }
      } catch (err) {
        wx.hideLoading();
        console.error('[Login] 手机号登录异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    },

    /**
     * 用手机号 code 换取真实手机号
     * GET /api/weixin/getPhone?code=xxx
     */
    getPhoneNumber(code) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `http://localhost:3000/api/weixin/getPhone?code=${code}`,
          method: 'GET',
          timeout: 5000,
          success: (res) => {
            console.log('[Login] /api/weixin/getPhone 响应:', JSON.stringify(res.data));
            if (res.statusCode === 200 && res.data.errcode === 0) {
              const phone = res.data.phone_info && res.data.phone_info.purePhoneNumber;
              if (phone) {
                resolve(phone);
              } else {
                reject(new Error('响应中无手机号'));
              }
            } else {
              reject(new Error(res.data.errmsg || `errcode: ${res.data.errcode}`));
            }
          },
          fail: (err) => {
            console.error('[Login] /api/weixin/getPhone 请求失败:', err);
            reject(err);
          },
        });
      });
    },

    /**
     * 注册
     * POST /api/user/register
     * @param {string} openid
     * @param {string} phone
     */
    register(openid, phone) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: 'http://localhost:3000/api/user/register',
          method: 'POST',
          data: { openid, phone },
          header: { 'Content-Type': 'application/json' },
          timeout: 5000,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          },
          fail: (err) => {
            reject(err);
          },
        });
      });
    },

    goToSearch() {
      wx.navigateTo({
        url: '/pages/search/search',
      });
    },
  },
});
