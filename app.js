// app.js
const api = require('./utils/api');

App({
  async onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    await this.doLogin()
  },

  /**
   * 登录流程：
   * 1. wx.login 获取临时 code
   * 2. 用 code 换取 openid
   * 3. 调用 loginByOpenid 尝试登录
   */
  async doLogin() {
    try {
      // Step 1: wx.login 获取临时 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes.code) {
        console.warn('[Login] wx.login 未返回 code');
        return;
      }

      // Step 2: 用 code 换取 openid
      const openid = await this.getOpenidByCode(loginRes.code);
      if (!openid) {
        console.warn('[Login] 获取 openid 失败');
        return;
      }

      // 保存 openid 到本地
      wx.setStorageSync('openid', openid);
      this.globalData.openid = openid;

      // 更新 API 层的用户配置
      api.setUserConfig({ openid });

      // Step 3: 调用 loginByOpenid 尝试登录
      const loginResult = await api.loginByOpenid(openid);

      if (loginResult && loginResult.success) {
        const data = loginResult.data || {};
        this.globalData.token = data.token || '';
        this.globalData.userInfo = data.userInfo || null;
        this.globalData.isLogin = true;

        // 持久化存储
        wx.setStorageSync('token', this.globalData.token);
        wx.setStorageSync('userInfo', this.globalData.userInfo);

        console.log('[Login] 登录成功');
      } else {
        console.warn('[Login] loginByOpenid 返回失败:', loginResult && loginResult.message);
      }
    } catch (err) {
      console.error('[Login] 登录异常:', err);
    }
  },

  /**
   * 用 wx.login 的 code 换取 openid
   * 请求后端通过微信 jscode2session 接口获取
   */
  getOpenidByCode(code) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'http://localhost:3000/api/user/getOpenid',
        method: 'POST',
        data: { code },
        header: { 'Content-Type': 'application/json' },
        timeout: 5000,
        success: (res) => {
          if (res.statusCode === 200) {
            const openid = res.data.openid
              || (res.data.data && res.data.data.openid)
              || '';
            resolve(openid);
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

  globalData: {
    userInfo: null,
    openid: '',
    token: '',
    isLogin: false,
  },
});
