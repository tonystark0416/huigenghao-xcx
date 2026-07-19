// index.js
const { getGoodsList } = require('../../utils/api');

Component({
  data: {
    showLoginModal: false,
    linkInput: '',
    // 商品列表
    productList: [],
    goodsOffset: 0,
    goodsPageSize: 10,
    goodsHasMore: true,
    goodsLoading: false,
    platforms: [
      { name: '唯品会', key: 'vip', color: '#E4007F', icon: '唯' },
      { name: '淘宝', key: 'taobao', color: '#ff5000', icon: '淘' },
      { name: '京东', key: 'jd', color: '#c91623', icon: '京' },
      { name: '抖音商城', key: 'douyin', color: '#000000', icon: '抖' },
      { name: '拼多多', key: 'pdd', color: '#e02e24', icon: '拼' },
    ],
  },

  lifetimes: {
    attached() {
      // 延迟检查登录弹窗
      setTimeout(() => {
        this.checkLoginModal();
      }, 1000);
      // 加载首页商品列表
      this.loadGoodsList();
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
            console.log('[Login] /api/weixin/getPhone 响应:', res.data);
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

    /**
     * 粘贴购物链接输入
     */
    onLinkInput(e) {
      this.setData({ linkInput: e.detail.value });
    },

    /**
     * 从剪贴板粘贴
     */
    onPasteLink() {
      wx.getClipboardData({
        success: (res) => {
          this.setData({ linkInput: res.data || '' });
        },
        fail: () => {
          wx.showToast({ title: '请手动粘贴链接', icon: 'none' });
        },
      });
    },

    /**
     * 查找优惠
     */
    onFindCoupon() {
      const { linkInput } = this.data;
      if (!linkInput.trim()) {
        wx.showToast({ title: '请先粘贴购物链接', icon: 'none' });
        return;
      }
      // 预留：跳转到优惠查询页或发送给后端解析
      wx.showToast({ title: '功能开发中', icon: 'none' });
    },

    /**
     * 页面触底加载更多
     */
    onReachBottom() {
      this.loadMoreGoods();
    },

    // ==================== 商品列表 ====================

    /**
     * 加载商品列表（首页）
     */
    async loadGoodsList() {
      if (this.data.goodsLoading) return;
      this.setData({ goodsLoading: true });

      try {
        const res = await getGoodsList({
          jxCode: '4fepozbz',
          offset: 0,
          pageSize: this.data.goodsPageSize,
        });

        console.log('[Index] getGoodsList 原始响应:', res);

        if (res && res.returnCode === '0' && res.result) {
          const list = res.result.goodsInfoList || [];
          console.log('[Index] 提取到商品列表，数量:', list.length);
          this.setData({
            productList: this.formatGoodsList(list),
            goodsOffset: res.result.nextPageOffset || 0,
            goodsHasMore: !res.result.lastPage,
            goodsLoading: false,
          });
        } else {
          console.warn('[Index] getGoodsList 返回无效');
          this.setData({ goodsLoading: false });
        }
      } catch (err) {
        console.error('[Index] 加载商品列表失败:', err);
        this.setData({ goodsLoading: false });
      }
    },

    /**
     * 加载更多商品
     */
    async loadMoreGoods() {
      const { goodsLoading, goodsHasMore, goodsOffset, goodsPageSize, productList } = this.data;
      if (goodsLoading || !goodsHasMore) return;

      console.log('[Index] loadMoreGoods offset:', goodsOffset);
      this.setData({ goodsLoading: true });

      try {
        const res = await getGoodsList({
          jxCode: '4fepozbz',
          offset: goodsOffset,
          pageSize: goodsPageSize,
        });

        console.log('[Index] loadMoreGoods 响应:', res);

        if (res && res.returnCode === '0' && res.result) {
          const list = res.result.goodsInfoList || [];
          this.setData({
            productList: [...productList, ...this.formatGoodsList(list)],
            goodsOffset: res.result.nextPageOffset || goodsOffset,
            goodsHasMore: !res.result.lastPage,
            goodsLoading: false,
          });
        } else {
          this.setData({ goodsLoading: false });
        }
      } catch (err) {
        console.error('[Index] 加载更多失败:', err);
        this.setData({ goodsLoading: false });
      }
    },

    /**
     * 格式化商品列表：映射唯品会接口字段
     */
    formatGoodsList(list) {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        const price = parseFloat(item.vipPrice || item.price) || 0;
        const originalPrice = parseFloat(item.marketPrice || item.originalPrice) || 0;
        const commission = parseFloat(item.commission) || 0;
        return {
          id: item.goodsId || item.id || '',
          title: item.goodsName || item.title || '',
          image: item.goodsMainPicture || item.goodsThumbUrl || item.image || '',
          price: price,
          priceText: '¥' + price.toFixed(2),
          originalPrice: originalPrice,
          originalPriceText: originalPrice > price ? '¥' + originalPrice.toFixed(2) : '',
          rebate: commission,
          rebateText: commission > 0 ? '返¥' + commission.toFixed(2) : '',
        };
      });
    },

    /**
     * 点击商品
     */
    onGoodsTap(e) {
      const { id } = e.currentTarget.dataset;
      if (id) {
        wx.navigateTo({ url: `/pages/goods/goods?id=${id}` });
      }
    },

    // ==================== 其他 ====================

    goToSearch() {
      wx.navigateTo({
        url: '/pages/search/search',
      });
    },

    /**
     * 点击平台入口，跳转到搜索页并带上平台参数
     */
    onPlatformTap(e) {
      const { key } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/search/search?platform=${key}`,
      });
    },
  },
});
