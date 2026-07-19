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
   * 3. 调用 loginByOpenid 完成登录
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

      // 保存 code 到全局和本地
      this.globalData.code = loginRes.code;
      wx.setStorageSync('code', loginRes.code);

      // Step 2: 用 code 换取 openid
      const result = await this.getOpenidByCode(loginRes.code);
      if (!result || !result.openid) {
        console.warn('[Login] 获取 openid 失败');
        return;
      }

      const openid = result.openid;

      // 保存 openid 和 session_key
      wx.setStorageSync('openid', openid);
      wx.setStorageSync('session_key', result.session_key || '');
      this.globalData.openid = openid;
      this.globalData.session_key = result.session_key || '';
      api.setUserConfig({ openid });
      console.log('[Login] openid 已获取');

      // Step 3: 调用 loginByOpenid 完成登录
      const loginResult = await api.loginByOpenid(openid);

      // 兼容多种成功格式: result / success / code===0
      const isSuccess = loginResult
        && (loginResult.result || loginResult.success || loginResult.code === 0);

      if (isSuccess) {
        const data = loginResult.data || {};
        const user = data.user || {};
        this.globalData.token = data.token || '';
        this.globalData.userId = user.id || data.userId || data.id || '';
        this.globalData.userInfo = (user.nickname || user.avatar) ? user : (data.userInfo || null);
        this.globalData.isLogin = true;

        wx.setStorageSync('token', this.globalData.token);
        wx.setStorageSync('userId', this.globalData.userId);
        wx.setStorageSync('userInfo', this.globalData.userInfo);

        console.log('[Login] 登录成功，userId:', this.globalData.userId);
      } else {
        // 未注册，需要手机号登录
        console.warn('[Login] loginByOpenid 返回失败，原始结果:', JSON.stringify(loginResult));
        this.globalData.needPhoneLogin = true;
      }
    } catch (err) {
      console.error('[Login] 登录异常:', err);
    }
  },

  /**
   * 用 wx.login 的 code 换取 openid
   */
  getOpenidByCode(code) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `http://localhost:3000/api/weixin/openid?code=${code}`,
        method: 'GET',
        timeout: 5000,
        success: (res) => {
          console.log('[Login] /api/weixin/openid 响应:', JSON.stringify(res.data));
          if (res.statusCode === 200) {
            const openid = res.data.openid || '';
            const session_key = res.data.session_key || '';
            if (openid) {
              console.log('[Login] 提取到 openid:', openid);
            } else {
              console.warn('[Login] 未能从响应中提取 openid，原始数据:', res.data);
            }
            resolve({ openid, session_key });
          } else {
            console.error('[Login] /api/weixin/openid HTTP错误:', res.statusCode);
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('[Login] /api/weixin/openid 请求失败:', err);
          reject(err);
        },
      });
    });
  },

  globalData: {
    userInfo: null,
    userId: '',
    code: '',
    openid: '',
    session_key: '',
    token: '',
    isLogin: false,
    needPhoneLogin: false,
  },
});
