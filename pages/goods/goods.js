// pages/goods/goods.js
const { getProductDetail, getTranUrl } = require('../../utils/api');

// 唯品会小程序 appId
const VIP_APP_ID = 'wxe9714e742209d35f';

Component({
  properties: {
    // 路由参数 id 会自动注入为 property
    id: {
      type: String,
      value: '',
      observer(newVal) {
        if (newVal) {
          this.loadDetail(newVal);
        }
      },
    },
  },

  data: {
    loading: true,
    goods: null,
    showLoginModal: false,
  },

  lifetimes: {
    attached() {
      // 如果 attached 时 id 已有值，立即加载
      if (this.properties.id) {
        this.loadDetail(this.properties.id);
      } else {
        // 兜底：properties observer 可能先于 attached，若都取不到则报错
        setTimeout(() => {
          if (!this.data.goods && this.data.loading && !this.properties.id) {
            this.setData({ loading: false });
            wx.showToast({ title: '商品ID缺失', icon: 'none' });
          }
        }, 500);
      }
    },
  },

  methods: {
    async loadDetail(goodsId) {
      if (!goodsId) return;
      // 防重复请求：observer 与 attached 可能都会触发加载，同一商品只请求一次
      if (this._loadingGoodsId === goodsId) return;
      this._loadingGoodsId = goodsId;

      this.setData({ loading: true });

      try {
        const res = await getProductDetail(goodsId);
        if (res.code === 0 && res.data) {
          this.setData({
            goods: res.data,
            loading: false,
          });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: '商品详情加载失败', icon: 'none' });
        }
      } catch (err) {
        console.error('获取商品详情失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      } finally {
        this._loadingGoodsId = '';
      }
    },

    /**
     * 确保用户已登录，未登录则弹出登录弹窗并存储回调
     * 前往购买需要 uid 传给转链接口，因此强制校验
     */
    ensureLogin(callback) {
      const app = getApp();
      if (app.globalData.needPhoneLogin && !app.globalData.isLogin) {
        this._pendingAction = callback;
        this.setData({ showLoginModal: true });
        return false;
      }
      return true;
    },

    /**
     * 关闭登录弹窗（同时清除待执行动作）
     */
    closeLoginModal() {
      this._pendingAction = null;
      this.setData({ showLoginModal: false });
    },

    noop() {},

    /**
     * 获取手机号回调
     * 用户点击按钮授权手机号后触发
     */
    async onGetPhoneNumber(e) {
      const { code, errMsg } = e.detail;

      if (errMsg !== 'getPhoneNumber:ok' || !code) {
        console.warn('[Goods] 用户拒绝手机号授权:', errMsg);
        wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      console.log('[Goods] 获取到手机号 code:', code);

      try {
        wx.showLoading({ title: '登录中...', mask: true });

        // Step 1: 用手机号 code 换取真实手机号码
        const purePhoneNumber = await this.getPhoneNumber(code);
        if (!purePhoneNumber) {
          wx.hideLoading();
          wx.showToast({ title: '获取手机号失败', icon: 'none' });
          return;
        }

        console.log('[Goods] 获取到手机号:', purePhoneNumber);

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
          console.log('[Goods] 注册登录成功，userId:', app.globalData.userId);

          // 执行登录前的待办动作（前往购买）
          if (this._pendingAction) {
            const action = this._pendingAction;
            this._pendingAction = null;
            // 延迟 500ms，让登录成功 toast 展示后再执行
            setTimeout(() => action(), 500);
          }
        } else {
          wx.showToast({ title: (res && res.message) || '登录失败，请重试', icon: 'none' });
        }
      } catch (err) {
        wx.hideLoading();
        console.error('[Goods] 手机号登录异常:', err);
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
          url: `https://hgh.pangpai-car.com/api/weixin/getPhone?code=${code}`,
          method: 'GET',
          timeout: 5000,
          success: (res) => {
            console.log('[Goods] /api/weixin/getPhone 响应:', res.data);
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
            console.error('[Goods] /api/weixin/getPhone 请求失败:', err);
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
          url: 'https://hgh.pangpai-car.com/api/user/register',
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

    // 前往购买：实时请求转链接口，获取 weapp_url 跳转唯品会小程序
    async onBuyTap() {
      const { goods } = this.data;
      if (!goods || !goods.destUrl) {
        wx.showToast({ title: '暂无购买链接', icon: 'none' });
        return;
      }

      // 强制登录校验：需要 uid 传给转链接口
      if (!this.ensureLogin(() => this.onBuyTap())) return;

      if (this._buying) return;
      this._buying = true;

      const uid = getApp().globalData.userId || getApp().globalData.openid || '';

      wx.showLoading({ title: '获取推广链接...', mask: true });

      try {
        const res = await getTranUrl(goods.destUrl, uid);
        wx.hideLoading();
        this._buying = false;

        if (res && res.code === 200 && res.urls && res.urls.weapp_url) {
          const weappUrl = res.urls.weapp_url;
          console.log('[Goods] 唯品会小程序路径:', weappUrl);
          wx.navigateToMiniProgram({
            appId: VIP_APP_ID,
            path: weappUrl,
            fail: (err) => {
              console.error('[Goods] 跳转唯品会小程序失败:', err);
              wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
            },
          });
        } else {
          console.warn('[Goods] 未获取到 weapp_url:', res);
          wx.showToast({ title: '获取推广链接失败', icon: 'none' });
        }
      } catch (err) {
        wx.hideLoading();
        this._buying = false;
        console.error('[Goods] 获取推广链接异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    },
  },
});
