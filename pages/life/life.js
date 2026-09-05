const api = require('../../utils/api');

// 美团外卖小程序 appId（跳转目标）
const MEITUAN_APP_ID = 'wxde8ac0a21135c07d';
// 转链返回中 key=4 对应小程序路径
const MINI_PROGRAM_LINK_KEY = '4';
const PAGE_SIZE = 20;
// 排序方式：1=综合排序，2=价格升序，6=离我最近
const SORT_COMPREHENSIVE = 1;
const SORT_PRICE_ASC = 2;
const SORT_NEARBY = 6;

Component({
  data: {
    // banner
    bannerList: [],
    loading: true,
    loaded: false,
    // 搜索
    searchText: '',
    goodsList: [],
    searching: false,
    searchDone: false, // 是否已搜索过（用于区分展示 banner 还是搜索结果）
    pageNo: 1,
    hasNext: false,
    searchId: '',
    loadMoreLoading: false,
    empty: false,
    goodsJumping: false,
    // 排序
    sortOptions: [
      { label: '综合排序', value: SORT_COMPREHENSIVE },
      { label: '价格升序', value: SORT_PRICE_ASC },
      { label: '离我最近', value: SORT_NEARBY },
    ],
    sortField: SORT_COMPREHENSIVE,
    longitude: '',
    latitude: '',
    // 登录弹窗
    showLoginModal: false,
  },

  lifetimes: {
    attached() {
      this.loadBanners();
      // 进入页面即获取定位并缓存，后续搜索/翻页携带经纬度
      this.loadLocation();
      // 未登录时提示登录（转链等操作需要用户 uid）
      this.checkLogin();
    },
  },

  methods: {
    // ==================== 登录 ====================

    /**
     * 检查登录状态，未登录弹出登录弹窗
     */
    checkLogin() {
      const app = getApp();
      if (app.globalData.needPhoneLogin && !app.globalData.isLogin) {
        this.setData({ showLoginModal: true });
      }
    },

    /**
     * 确保用户已登录，未登录则弹出登录弹窗并存储回调
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
        console.warn('[Life] 用户拒绝手机号授权:', errMsg);
        wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      console.log('[Life] 获取到手机号 code:', code);

      try {
        wx.showLoading({ title: '登录中...', mask: true });

        // Step 1: 用手机号 code 换取真实手机号码
        const purePhoneNumber = await this.getPhoneNumber(code);
        if (!purePhoneNumber) {
          wx.hideLoading();
          wx.showToast({ title: '获取手机号失败', icon: 'none' });
          return;
        }

        console.log('[Life] 获取到手机号:', purePhoneNumber);

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
          api.setUserConfig({ uid: app.globalData.userId });

          wx.setStorageSync('token', app.globalData.token);
          wx.setStorageSync('userId', app.globalData.userId);
          wx.setStorageSync('userInfo', app.globalData.userInfo);

          this.setData({ showLoginModal: false });
          wx.showToast({ title: '登录成功', icon: 'success' });
          console.log('[Life] 注册登录成功，userId:', app.globalData.userId);

          // 执行登录前的待办动作（如转链跳转）
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
        console.error('[Life] 手机号登录异常:', err);
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
            console.log('[Life] /api/weixin/getPhone 响应:', res.data);
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
            console.error('[Life] /api/weixin/getPhone 请求失败:', err);
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

    // ==================== Banner ====================

    async loadBanners() {
      this.setData({ loading: true });
      const list = await api.getBanners();
      this.setData({
        bannerList: list,
        loading: false,
        loaded: true,
      });
    },

    async onBannerTap(e) {
      const { id, extraId, title } = e.currentTarget.dataset;
      if (!extraId) {
        wx.showToast({ title: '活动信息缺失', icon: 'none' });
        return;
      }

      // 转链需要用户 uid，未登录先弹出登录
      if (!this.ensureLogin(() => this.onBannerTap(e))) return;

      wx.showLoading({ title: '获取活动链接...', mask: true });
      const res = await api.getMeituanReferralLink(extraId);
      wx.hideLoading();

      if (!res || !res.success || !res.data || !res.data.referralLinkMap) {
        console.error('[Life] 转链失败:', res);
        wx.showToast({ title: '获取活动链接失败，请稍后重试', icon: 'none' });
        return;
      }

      const miniProgramPath = res.data.referralLinkMap[MINI_PROGRAM_LINK_KEY];
      if (!miniProgramPath) {
        wx.showToast({ title: '该活动暂不支持跳转', icon: 'none' });
        return;
      }

      console.log('[Life] 跳转美团小程序, banner:', title, '路径:', miniProgramPath);
      wx.navigateToMiniProgram({
        appId: MEITUAN_APP_ID,
        path: miniProgramPath,
        success: () => {
          console.log('[Life] 跳转成功');
        },
        fail: (err) => {
          console.error('[Life] 跳转失败:', err);
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
        },
      });
    },

    onImageError(e) {
      const { index } = e.currentTarget.dataset;
      console.error(`[Life] 第${index + 1}张图片加载失败:`, e.detail);
    },

    // ==================== 搜索 ====================

    onSearchInput(e) {
      this.setData({ searchText: e.detail.value });
    },

    onSearchTap() {
      this.doSearch();
    },

    async doSearch() {
      const keyword = (this.data.searchText || '').trim();
      if (!keyword) {
        wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
        return;
      }
      if (this.data.searching) return;

      this.setData({ searchDone: true });
      await this.fetchFirstPage(keyword);
    },

    // 排序切换
    async onSortTap(e) {
      const field = Number(e.currentTarget.dataset.field);
      if (this.data.searching || field === this.data.sortField) return;

      const keyword = (this.data.searchText || '').trim();
      if (!keyword) {
        wx.showToast({ title: '请先输入搜索关键词', icon: 'none' });
        return;
      }

      this.setData({ sortField: field });
      await this.fetchFirstPage(keyword);
    },

    // 获取当前位置（模糊定位，页面加载时调用，缓存到 data 供搜索/翻页使用）
    getLocation() {
      return new Promise((resolve) => {
        wx.getFuzzyLocation({
          type: 'gcj02',
          success: (res) => resolve({ longitude: String(res.longitude), latitude: String(res.latitude) }),
          fail: (err) => {
            console.error('[Life] wx.getFuzzyLocation 失败:', err);
            resolve({ longitude: '', latitude: '' });
          },
        });
      });
    },

    // 页面加载时获取定位并缓存
    async loadLocation() {
      const loc = await this.getLocation();
      if (loc.longitude) {
        this.setData({
          longitude: loc.longitude,
          latitude: loc.latitude,
        });
        console.log('[Life] 模糊定位成功, 经度:', loc.longitude, '纬度:', loc.latitude);
      } else {
        console.warn('[Life] 模糊定位失败，后续请求不带经纬度');
      }
    },

    // 搜索第一页（首次搜索 / 切换排序时复用）
    async fetchFirstPage(keyword) {
      const { sortField, longitude, latitude } = this.data;

      // 使用已缓存的经纬度；「离我最近」排序时若定位尚未就绪则重新获取一次
      let locLongitude = longitude;
      let locLatitude = latitude;
      if (!locLongitude && sortField === SORT_NEARBY) {
        const loc = await this.getLocation();
        locLongitude = loc.longitude;
        locLatitude = loc.latitude;
        if (!locLongitude) {
          wx.showToast({ title: '定位失败，无法按距离排序', icon: 'none' });
        }
      }

      this.setData({
        searching: true,
        goodsList: [],
        empty: false,
        pageNo: 1,
        hasNext: false,
        searchId: '',
        longitude: locLongitude,
        latitude: locLatitude,
      });

      const res = await api.searchMeituanGoods({
        searchText: keyword,
        longitude: locLongitude,
        latitude: locLatitude,
        pageNo: 1,
        pageSize: PAGE_SIZE,
        searchId: '',
        sortField,
      });

      this.setData({
        searching: false,
        goodsList: res.list,
        hasNext: res.hasNext,
        searchId: res.searchId,
        empty: res.list.length === 0,
      });
    },

    onClearSearch() {
      this.setData({
        searchText: '',
        goodsList: [],
        searchDone: false,
        empty: false,
        pageNo: 1,
        hasNext: false,
        searchId: '',
        sortField: SORT_COMPREHENSIVE,
        longitude: '',
        latitude: '',
      });
    },

    // 页面触底加载更多（Component 构造页面时在 methods 中定义）
    onReachBottom() {
      this.loadMoreGoods();
    },

    // 上拉加载更多
    async loadMoreGoods() {
      if (!this.data.searchDone || this.data.loadMoreLoading || !this.data.hasNext) return;

      const nextPage = this.data.pageNo + 1;
      this.setData({ loadMoreLoading: true });

      const res = await api.searchMeituanGoods({
        searchText: (this.data.searchText || '').trim(),
        longitude: this.data.longitude,
        latitude: this.data.latitude,
        pageNo: nextPage,
        pageSize: PAGE_SIZE,
        searchId: this.data.searchId,
        sortField: this.data.sortField,
      });

      this.setData({
        loadMoreLoading: false,
        goodsList: [...this.data.goodsList, ...res.list],
        pageNo: nextPage,
        hasNext: res.hasNext,
        searchId: res.searchId,
      });
    },

    onGoodsImageError(e) {
      const { index } = e.currentTarget.dataset;
      console.error(`[Life] 商品第${index + 1}张图片加载失败:`, e.detail);
    },

    // 点击商品卡片：实时获取推广链接并跳转美团小程序
    async onGoodsTap(e) {
      const { sign } = e.currentTarget.dataset;
      if (!sign) {
        wx.showToast({ title: '商品信息缺失', icon: 'none' });
        return;
      }

      // 转链需要用户 uid，未登录先弹出登录
      if (!this.ensureLogin(() => this.onGoodsTap(e))) return;

      if (this.data.goodsJumping) return;
      this.setData({ goodsJumping: true });

      wx.showLoading({ title: '获取推广链接...', mask: true });
      const res = await api.getMeituanGoodsReferralLink(sign);
      wx.hideLoading();
      this.setData({ goodsJumping: false });

      if (!res || !res.success || !res.data || !res.data.referralLinkMap) {
        console.error('[Life] 商品转链失败:', res);
        wx.showToast({ title: '获取推广链接失败，请稍后重试', icon: 'none' });
        return;
      }

      const miniProgramPath = res.data.referralLinkMap[MINI_PROGRAM_LINK_KEY];
      if (!miniProgramPath) {
        wx.showToast({ title: '该商品暂不支持跳转', icon: 'none' });
        return;
      }

      console.log('[Life] 跳转美团小程序, 商品推广路径:', miniProgramPath);
      wx.navigateToMiniProgram({
        appId: MEITUAN_APP_ID,
        path: miniProgramPath,
        success: () => {
          console.log('[Life] 商品跳转成功');
        },
        fail: (err) => {
          console.error('[Life] 商品跳转失败:', err);
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
        },
      });
    },
  },
});
