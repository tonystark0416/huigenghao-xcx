// pages/goods/goods.js
const { getProductDetail, getGoodsTranUrlByGoodsId, setUserConfig } = require('../../utils/api');

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
    // 悬浮返回按钮的 top 值（与胶囊垂直居中对齐）
    navBackStyle: '',
  },

  lifetimes: {
    attached() {
      // 悬浮返回按钮与胶囊对齐
      this.initNavBackStyle();
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
    /**
     * 详情数据预处理：
     * 将价格计算方式文案 priceDesc（如 "¥167-超V折扣 ¥3"）拆分为分段，
     * 便于页面分段样式展示；无 priceDesc 时返回空数组。
     */
    _normalizeDetail(goods) {
      if (!goods) return goods;
      const desc = goods.priceDesc || '';
      const parts = [];
      if (desc) {
        const dashIdx = desc.indexOf('-');
        if (dashIdx > 0 && dashIdx < desc.length - 1) {
          // 前半为基准价，后半为优惠说明（高亮）
          parts.push({ id: 0, text: desc.slice(0, dashIdx).trim(), highlight: false });
          parts.push({ id: 1, text: desc.slice(dashIdx + 1).trim(), highlight: true });
        } else {
          parts.push({ id: 0, text: desc.trim(), highlight: false });
        }
      }
      return { ...goods, priceDescParts: parts };
    },

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
            goods: this._normalizeDetail(res.data),
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
     * 预览主图：从点击的图开始预览，可左右切换全部主图
     */
    previewMainImage(e) {
      const url = e.currentTarget.dataset.url;
      if (!url) return;
      const images = this.data.goods && this.data.goods.images;
      wx.previewImage({
        current: url,
        urls: images && images.length ? images : [url],
      });
    },

    /**
     * 预览详情长图：从点击的图开始，可切换全部详情图
     */
    previewDetailImage(e) {
      const url = e.currentTarget.dataset.url;
      if (!url) return;
      const detailImages = this.data.goods && this.data.goods.detailImages;
      wx.previewImage({
        current: url,
        urls: detailImages && detailImages.length ? detailImages : [url],
      });
    },

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
        console.warn('[Goods] 初始化返回按钮位置失败:', err);
      }
    },

    /**
     * 悬浮返回按钮：返回上一页
     */
    onNavBack() {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/index/index' });
        },
      });
    },

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
          // 同步用户 uid，供转链等接口使用
          setUserConfig({ uid: app.globalData.userId });

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

    // 前往购买：实时请求转链接口，按商品 ID 获取 weapp_url 跳转唯品会小程序
    async onBuyTap() {
      const { goods } = this.data;
      if (!goods || !goods.id) {
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
        const res = await getGoodsTranUrlByGoodsId({
          goodsId: goods.id,
          platform: goods.platform || 'vip',
          uid,
          pid: goods.pid || '',
        });
        wx.hideLoading();
        this._buying = false;

        if (res && res.result === true && res.urls && res.urls.weapp_url) {
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
