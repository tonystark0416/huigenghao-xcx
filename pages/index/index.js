// index.js
const { getGoodsList, convertLink, setUserConfig } = require('../../utils/api');

Component({
  data: {
    // 置顶搜索栏避让参数
    navTopPad: 20,
    capsuleGap: 0,
    showLoginModal: false,
    // 今日最优惠活动（接口待对接，默认空）
    activityBanners: [],
    linkInput: '',
    // 链接转换
    linkConverting: false,
    linkResult: null,
    showLinkResult: false,
    // 商品列表
    productList: [],
    goodsOffset: 0,
    goodsPageSize: 10,
    goodsHasMore: true,
    goodsLoading: false,
  },

  lifetimes: {
    attached() {
      // 适配置顶搜索栏（状态栏高度、胶囊按钮右侧避让）
      this.setNavTopLayout();
      // 加载首页商品列表
      this.loadGoodsList();
      // TODO: 活动 banner 接口对接完成后在此调用 this.loadActivityBanners()
      // this.loadActivityBanners();
    },
  },

  pageLifetimes: {
    show() {
      // 不再自动弹出登录弹窗，由用户行为触发
    },
  },

  methods: {
    // ==================== 分享 ====================

    /**
     * 转发给好友
     */
    onShareAppMessage() {
      return {
        title: '精选好物 · 超值返利',
        path: '/pages/index/index',
      };
    },

    /**
     * 分享到朋友圈
     */
    onShareTimeline() {
      return {
        title: '精选好物 · 超值返利',
      };
    },

    /**
     * 计算置顶搜索栏的避让参数
     * navTopPad：胶囊按钮上边缘到屏幕顶的距离（px），使搜索框顶边与胶囊齐平、水平对齐
     * capsuleGap：右上角胶囊按钮宽度+右间距（px），使搜索框收窄且不被遮挡
     */
    setNavTopLayout() {
      try {
        const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const menuRect = wx.getMenuButtonBoundingClientRect();
        const statusBarHeight = (sysInfo && sysInfo.statusBarHeight) || 20;
        let navTopPad = statusBarHeight;
        let capsuleGap = 0;
        if (sysInfo && menuRect && menuRect.top) {
          navTopPad = menuRect.top;
          capsuleGap = Math.max(0, sysInfo.windowWidth - menuRect.left + 8);
        }
        this.setData({ navTopPad, capsuleGap });
      } catch (err) {
        this.setData({ navTopPad: 20, capsuleGap: 0 });
      }
    },

    // ==================== 今日最优惠活动 ====================

    /**
     * 加载今日最优惠活动 banner 数据
     * TODO: 接口正在开发中，期望响应
     *   { code: 0, data: [{ id, image, title, link?, targetType? }] }
     * 对接完成后在 lifetimes.attached 中调用本方法即可
     */
    async loadActivityBanners() {
      // 接口待对接，先保留空实现
      // const res = await getActivityBanners();
      // if (res && res.code === 0 && Array.isArray(res.data)) {
      //   this.setData({ activityBanners: res.data.slice(0, 3) });
      // }
    },

    /**
     * 活动 banner 点击事件
     * TODO: 根据 item.link / item.targetType 跳转到活动详情或对应小程序
     */
    onActivityTap(e) {
      const { item } = e.currentTarget.dataset;
      console.log('[Index] 点击活动 banner:', item);
    },

    // ==================== 登录 ====================

    /**
     * 确保用户已登录，未登录则弹出登录弹窗并存储回调
     * @param {Function} callback - 登录成功后要执行的回调
     * @returns {boolean} true=已登录可直接执行，false=已拦截需等待登录
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
          // 同步用户 uid，供转链等接口使用
          setUserConfig({ uid: app.globalData.userId });

          wx.setStorageSync('token', app.globalData.token);
          wx.setStorageSync('userId', app.globalData.userId);
          wx.setStorageSync('userInfo', app.globalData.userInfo);

          this.setData({ showLoginModal: false });
          wx.showToast({ title: '登录成功', icon: 'success' });
          console.log('[Login] 注册登录成功，userId:', app.globalData.userId);

          // 执行登录前的待办动作（如搜索、转链、平台跳转、商品点击）
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
          url: `https://hgh.pangpai-car.com/api/weixin/getPhone?code=${code}`,
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
     * 查找优惠 - 链接转换
     * 支持拼多多和唯品会链接，调用后端 /api/tranUrl 获取推广链接
     */
    async onFindCoupon() {
      if (!this.ensureLogin(() => this.onFindCoupon())) return;

      const { linkInput } = this.data;
      if (!linkInput.trim()) {
        wx.showToast({ title: '请先粘贴购物链接', icon: 'none' });
        return;
      }

      this.setData({
        linkConverting: true,
        showLinkResult: false,
        linkResult: null,
      });

      wx.showLoading({ title: '转换中...', mask: true });

      try {
        // 获取当前登录用户的 uid
        const uid = getApp().globalData.userId || getApp().globalData.openid || '';
        const res = await convertLink(linkInput, uid);

        wx.hideLoading();

        if (!res || res.code !== 0) {
          const msg = (res && res.message) || '链接转换失败，请检查链接是否有效';
          wx.showToast({ title: msg, icon: 'none', duration: 2000 });
          this.setData({ linkConverting: false });
          return;
        }

        const data = res.data;
        this.setData({
          linkConverting: false,
          showLinkResult: true,
          linkResult: {
            originalUrl: data.originalUrl || linkInput.trim(),
            h5_url: data.h5_url || '',
            weapp_url: data.weapp_url || '',
            weapp_short_link: data.weapp_short_link || '',
            deeplink_url: data.deeplink_url || '',
          },
        });
      } catch (err) {
        wx.hideLoading();
        console.error('[Index] 链接转换异常:', err);
        this.setData({ linkConverting: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    },

    /**
     * 复制指定的链接字段
     */
    onCopyField(e) {
      const { field } = e.currentTarget.dataset;
      const { linkResult } = this.data;
      if (!linkResult) return;

      const url = linkResult[field];
      if (!url) {
        wx.showToast({ title: '暂无链接可复制', icon: 'none' });
        return;
      }
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showToast({ title: '链接已复制，快去分享吧', icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '复制失败', icon: 'none' });
        },
      });
    },

    /**
     * 复制转换后的推广链接（兼容旧逻辑，默认复制 h5_url）
     */
    onCopyLink() {
      const { linkResult } = this.data;
      if (!linkResult || !linkResult.h5_url) {
        wx.showToast({ title: '暂无链接可复制', icon: 'none' });
        return;
      }
      wx.setClipboardData({
        data: linkResult.h5_url,
        success: () => {
          wx.showToast({ title: '链接已复制，快去分享吧', icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '复制失败', icon: 'none' });
        },
      });
    },

    /**
     * 清除转链结果，回到输入状态
     */
    onClearLinkResult() {
      this.setData({
        showLinkResult: false,
        linkResult: null,
        linkInput: '',
      });
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
     * 点击商品，直接跳转商品详情（不做强制登录校验）
     */
    onGoodsTap(e) {
      const { id } = e.currentTarget.dataset;
      if (!id) return;
      this._doGoodsTap(id);
    },

    /**
     * 商品点击核心逻辑
     */
    _doGoodsTap(id) {
      wx.navigateTo({ url: `/pages/goods/goods?id=${id}` });
    },

    // ==================== 其他 ====================

    /**
     * 进入搜索页面（不做强制登录校验）
     */
    goToSearch() {
      wx.navigateTo({
        url: '/pages/search/search',
      });
    },
  },
});