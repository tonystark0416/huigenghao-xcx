// pages/meituan-goods/meituan-goods.js
// 美团团购商品详情页（券包结构，与电商商品详情页 pages/goods 相互独立）
const {
  getMeituanGoodsDetail,
  getMeituanGoodsReferralLink,
  setUserConfig,
} = require('../../utils/api');
const { BASE_URL } = require('../../utils/config');

// 美团外卖小程序 appId（跳转目标）
const MEITUAN_APP_ID = 'wxde8ac0a21135c07d';
// 转链返回中 key=4 对应小程序路径
const MINI_PROGRAM_LINK_KEY = '4';

Component({
  properties: {
    // 路由参数 sign（productViewSign）会自动注入为 property
    sign: {
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
    // 悬浮返回按钮的 top 值（与胶囊垂直居中对齐）
    navBackStyle: '',
  },

  lifetimes: {
    attached() {
      // 悬浮返回按钮与胶囊对齐
      this.initNavBackStyle();
      // 如果 attached 时 sign 已有值，立即加载
      if (this.properties.sign) {
        this.loadDetail(this.properties.sign);
      } else {
        // 兜底：properties observer 可能先于 attached，若都取不到则报错
        setTimeout(() => {
          if (!this.data.goods && this.data.loading && !this.properties.sign) {
            this.setData({ loading: false });
            wx.showToast({ title: '商品ID缺失', icon: 'none' });
          }
        }, 500);
      }
    },
  },

  methods: {
    // ==================== 分享 ====================

    /**
     * 转发给好友：携带 productViewSign，好友点开直达本商品详情
     */
    onShareAppMessage() {
      const title = (this.data.goods && this.data.goods.title) || '超值团购 · 吃喝玩乐';
      return {
        title: title.slice(0, 30),
        path: `/pages/meituan-goods/meituan-goods?sign=${this.properties.sign}`,
      };
    },

    /**
     * 分享到朋友圈
     */
    onShareTimeline() {
      const title = (this.data.goods && this.data.goods.title) || '超值团购 · 吃喝玩乐';
      return {
        title: title.slice(0, 30),
        query: `sign=${this.properties.sign}`,
      };
    },

    // ==================== 详情加载 ====================

    async loadDetail(sign) {
      if (!sign) return;
      // 防重复请求：observer 与 attached 可能都会触发加载，同一商品只请求一次
      if (this._loadingSign === sign) return;
      this._loadingSign = sign;

      this.setData({ loading: true });

      try {
        const goods = await getMeituanGoodsDetail(sign);
        if (goods) {
          this.setData({ goods, loading: false });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: '商品详情加载失败', icon: 'none' });
        }
      } catch (err) {
        console.error('[MeituanGoods] 获取商品详情失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      } finally {
        this._loadingSign = '';
      }
    },

    /**
     * 预览商品主图
     */
    previewMainImage() {
      const url = this.data.goods && this.data.goods.image;
      if (!url) return;
      wx.previewImage({ current: url, urls: [url] });
    },

    // ==================== 导航 ====================

    /**
     * 悬浮返回按钮与右上角胶囊水平对齐：
     * 取胶囊矩形，让按钮的垂直中心与胶囊中心重合
     */
    initNavBackStyle() {
      try {
        const menu = wx.getMenuButtonBoundingClientRect();
        const btnSize = 34; // 与 wxss .nav-back-btn 的宽高一致（px）
        if (menu && menu.top) {
          const top = menu.top + (menu.height - btnSize) / 2;
          this.setData({ navBackStyle: `top:${Math.max(top, 0)}px;` });
        }
      } catch (err) {
        console.warn('[MeituanGoods] 初始化返回按钮位置失败:', err);
      }
    },

    /**
     * 悬浮返回按钮：返回上一页
     */
    onNavBack() {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/life/life' });
        },
      });
    },

    // ==================== 登录 ====================

    /**
     * 确保用户已登录，未登录则弹出登录弹窗并存储回调
     * 前往购买需要 uid 传给转链接口，因此强制校验
     */
    ensureLogin(callback) {
      const app = getApp();
      if (!app.globalData.isLogin || !app.globalData.userId) {
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
        console.warn('[MeituanGoods] 用户拒绝手机号授权:', errMsg);
        wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      console.log('[MeituanGoods] 获取到手机号 code:', code);

      try {
        wx.showLoading({ title: '登录中...', mask: true });

        // Step 1: 用手机号 code 换取真实手机号码
        const purePhoneNumber = await this.getPhoneNumber(code);
        if (!purePhoneNumber) {
          wx.hideLoading();
          wx.showToast({ title: '获取手机号失败', icon: 'none' });
          return;
        }

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
          // 同步用户 uid，供转链等接口使用
          setUserConfig({ uid: app.globalData.userId });

          wx.setStorageSync('token', app.globalData.token);
          wx.setStorageSync('userId', app.globalData.userId);
          wx.setStorageSync('userInfo', app.globalData.userInfo);

          this.setData({ showLoginModal: false });
          wx.showToast({ title: '登录成功', icon: 'success' });
          console.log('[MeituanGoods] 注册登录成功，userId:', app.globalData.userId);

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
        console.error('[MeituanGoods] 手机号登录异常:', err);
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
          url: `${BASE_URL}/api/weixin/getPhone?code=${code}`,
          method: 'GET',
          timeout: 5000,
          success: (res) => {
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
            console.error('[MeituanGoods] /api/weixin/getPhone 请求失败:', err);
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
          url: `${BASE_URL}/api/user/register`,
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

    // ==================== 前往购买 ====================

    /**
     * 前往购买：先校验登录，通过后调用转链接口取小程序路径并跳转美团外卖小程序
     * （登录校验放在转链前，与吃喝玩乐页/首页原直接跳转逻辑保持一致）
     */
    async onBuyTap() {
      const sign = this.properties.sign;
      if (!sign) {
        wx.showToast({ title: '暂无购买链接', icon: 'none' });
        return;
      }

      // 强制登录校验：转链需要 uid
      if (!this.ensureLogin(() => this.onBuyTap())) return;

      if (this._buying) return;
      this._buying = true;

      wx.showLoading({ title: '获取推广链接...', mask: true });

      try {
        const res = await getMeituanGoodsReferralLink(sign);

        if (!res || !res.success || !res.data || !res.data.referralLinkMap) {
          console.error('[MeituanGoods] 商品转链失败:', res);
          wx.showToast({ title: '获取推广链接失败，请稍后重试', icon: 'none' });
          return;
        }

        const miniProgramPath = res.data.referralLinkMap[MINI_PROGRAM_LINK_KEY];
        if (!miniProgramPath) {
          wx.showToast({ title: '该商品暂不支持跳转', icon: 'none' });
          return;
        }

        console.log('[MeituanGoods] 跳转美团小程序, 商品推广路径:', miniProgramPath);
        wx.navigateToMiniProgram({
          appId: MEITUAN_APP_ID,
          path: miniProgramPath,
          success: () => {
            console.log('[MeituanGoods] 跳转成功');
          },
          fail: (err) => {
            console.error('[MeituanGoods] 跳转失败:', err);
            wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
          },
        });
      } catch (err) {
        console.error('[MeituanGoods] 获取推广链接异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      } finally {
        wx.hideLoading();
        this._buying = false;
      }
    },
  },
});
