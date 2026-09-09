// index.js
const {
  fetchVipIndexGoods,
  fetchMeituanIndexGoods,
  getMeituanGoodsReferralLink,
  getMeituanReferralLink,
  getIndexActivityBanners,
  convertLink,
  checkAuth,
  genAuthUrl,
  setUserConfig,
} = require('../../utils/api');

// 美团外卖小程序 appId（跳转目标，同吃喝玩乐页）
const MEITUAN_APP_ID = 'wxde8ac0a21135c07d';
// 唯品会小程序 appId（跳转目标）
const VIP_APP_ID = 'wxe9714e742209d35f';
// 唯品会第三方授权平台标识（/api/thirdAuth/* 的 platform 参数）
const VIP_AUTH_PLATFORM = 'vip';
// 转链返回中 key=4 对应小程序路径
const MINI_PROGRAM_LINK_KEY = '4';

Component({
  data: {
    // 置顶搜索栏避让参数
    navTopPad: 20,
    capsuleGap: 0,
    // 模糊定位经纬度（进入页面即获取，供后续接口携带）
    longitude: '',
    latitude: '',
    showLoginModal: false,
    // 唯品会第三方授权提示弹窗（未授权时提示用户去授权，确认后才跳转）
    showVipAuthModal: false,
    // 今日最优惠活动：由 /api/banner/indexBannerList 下发；不足两条或请求失败时整区隐藏（保持空数组）
    activityBanners: [],
    linkInput: '',
    // 链接转换
    linkConverting: false,
    linkResult: null,
    showLinkResult: false,
    // 精选商品双 tab：1=唯品好货 2=美团热销
    activeTab: 1,
    // 唯品好货（tab=1，offset 分页）
    vipList: [],
    vipOffset: 0,
    vipPageSize: 10,
    vipHasMore: true,
    vipLoading: false,
    // 美团热销（tab=2，切换时按定位加载一次）
    mtList: [],
    mtLoading: false,
    mtLoaded: false,
    mtJumping: false,
  },

  lifetimes: {
    attached() {
      // 适配置顶搜索栏（状态栏高度、胶囊按钮右侧避让）
      this.setNavTopLayout();
      // 进入页面即获取定位并缓存（与吃喝玩乐页面一致，美团热销 tab 携带经纬度）
      this.loadLocation();
      // 默认加载「唯品好货」tab
      this.loadVipGoods();
      // 加载首页活动坑位（数据不足两条或接口异常时整区隐藏）
      this.loadActivityBanners();
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

    // ==================== 定位 ====================

    // 获取当前位置（模糊定位，页面加载时调用，缓存到 data 供后续接口携带）
    getLocation() {
      return new Promise((resolve) => {
        wx.getFuzzyLocation({
          type: 'gcj02',
          success: (res) => resolve({ longitude: String(res.longitude), latitude: String(res.latitude) }),
          fail: (err) => {
            console.error('[Index] wx.getFuzzyLocation 失败:', err);
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
        console.log('[Index] 模糊定位成功, 经度:', loc.longitude, '纬度:', loc.latitude);
      } else {
        console.warn('[Index] 模糊定位失败，后续请求不带经纬度');
      }
    },

    // ==================== 今日最优惠活动 ====================

    /**
     * 加载首页活动坑位（GET /api/banner/indexBannerList）
     * - 返回不足两条或请求失败时：置空数组，配合 wxml 的 wx:if 整区隐藏
     * - 成功时按 sort 降序渲染，最多展示两个（一行两坑布局）
     */
    async loadActivityBanners() {
      const list = await getIndexActivityBanners();

      if (!Array.isArray(list) || list.length < 2) {
        console.warn('[Index] 首页活动 banner 数据不足两条或接口异常，隐藏活动区:', list);
        this.setData({ activityBanners: [] });
        return;
      }

      const banners = list.slice(0, 2).map((item) => ({
        id: item.id,
        title: item.title || '',
        subtitle: item.sub_text || '',
        image: item.banner_img_url || '',
        extraId: item.extra_id != null ? String(item.extra_id) : '',
        extraUrl: item.extra_url || '',
      }));
      console.log('[Index] 首页活动 banner 渲染:', banners.length, '条');
      this.setData({ activityBanners: banners });
    },

    /**
     * 活动坑位点击
     * - 美团活动：extra_url 为空、extra_id 为活动 id → 按 actId 转美团活动推广链接并跳美团小程序
     * - 唯品会等带官网/落地页 url：用 extra_url 调 /api/tranUrl 转链，取 weapp_url 跳对应小程序
     */
    onActivityTap(e) {
      const { item } = e.currentTarget.dataset;
      if (!item) return;

      if (item.extraUrl) {
        this.openVipActivity(item);
      } else if (item.extraId) {
        this.openMeituanActivity(item);
      } else {
        wx.showToast({ title: '该活动暂不支持跳转', icon: 'none' });
      }
    },

    /**
     * 唯品会坑位：点击后先校验登录，再校验唯品会第三方授权：
     * 1. 未登录 → ensureLogin 弹手机号登录
     * 2. 已登录但未在唯品会授权 → 弹「去授权」提示窗，确认后再调
     *    /api/thirdAuth/genAuthUrl 跳唯品会小程序完成授权（不直接跳转）
     * 3. 已授权 → extra_url → /api/tranUrl 转链（带 uid），weapp_url 跳唯品会小程序
     */
    async openVipActivity(item) {
      const url = (item.extraUrl || '').trim();
      if (!url) return;

      // Step 1: 校验登录（与美团坑一致，未登录先弹登录弹窗）
      if (!this.ensureLogin(() => this.openVipActivity(item))) return;
      if (this._activityJumping) return;
      this._activityJumping = true;

      wx.showLoading({ title: '加载中...', mask: true });
      try {
        const app = getApp();
        const uid = app.globalData.userId || '';
        if (!uid) {
          wx.showToast({ title: '请先完成登录授权', icon: 'none' });
          return;
        }

        // Step 2: 校验唯品会第三方授权状态（已授权则直接转链，不再调 genAuthUrl）
        const authRes = await checkAuth(uid, VIP_AUTH_PLATFORM);
        console.log('[Index] 唯品会授权状态响应:', authRes);
        // 真实结构示例: { result: true, authStatus: { isAuth: true } }
        // 兼容顶层 isAuth / authStatus.isAuth / data.isAuth / result 多种返回
        const authBody = authRes && (authRes.authStatus || authRes.data || authRes);
        const authFlag = authBody && (authBody.isAuth !== undefined ? authBody.isAuth : (authRes && authRes.result));
        const isVipAuthed = authFlag === true || authFlag === 1 || authFlag === '1' || authFlag === 'true';

        if (!isVipAuthed) {
          // 未授权：不直接跳转，先弹窗提示用户去授权，确认后才跳唯品会小程序授权页
          console.log('[Index] 唯品会未授权，弹出授权提示');
          this.setData({ showVipAuthModal: true });
          return;
        }

        // Step 3: 已授权，转链后跳转唯品会小程序
        const res = await convertLink(url, uid);
        if (!res || res.code !== 0 || !res.data || !res.data.weapp_url) {
          console.error('[Index] 唯品会坑位转链失败:', res);
          wx.showToast({ title: '获取推广链接失败，请稍后重试', icon: 'none' });
          return;
        }

        const weappUrl = res.data.weapp_url;
        console.log('[Index] 唯品会坑位小程序路径:', weappUrl);
        wx.navigateToMiniProgram({
          appId: VIP_APP_ID,
          path: weappUrl,
          fail: (err) => {
            console.error('[Index] 跳转唯品会小程序失败:', err);
            wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
          },
        });
      } catch (err) {
        console.error('[Index] 唯品会坑位异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      } finally {
        wx.hideLoading();
        this._activityJumping = false;
      }
    },

    /**
     * 美团活动坑位：extra_id(actId) → /api/meituan/referral-link-by-act-id（带 uid）
     * 取 referralLinkMap key=4 的小程序路径跳美团外卖小程序
     */
    async openMeituanActivity(item) {
      const actId = item.extraId;
      if (!actId) return;

      // 转链依赖当前用户 uid，未登录先弹出登录
      if (!this.ensureLogin(() => this.openMeituanActivity(item))) return;
      if (this._activityJumping) return;
      this._activityJumping = true;

      wx.showLoading({ title: '获取推广链接...', mask: true });
      try {
        const res = await getMeituanReferralLink(actId);

        if (!res || !res.success || !res.data || !res.data.referralLinkMap) {
          console.error('[Index] 美团活动转链失败:', res);
          wx.showToast({ title: '获取推广链接失败，请稍后重试', icon: 'none' });
          return;
        }

        const miniProgramPath = res.data.referralLinkMap[MINI_PROGRAM_LINK_KEY];
        if (!miniProgramPath) {
          wx.showToast({ title: '该活动暂不支持跳转', icon: 'none' });
          return;
        }

        console.log('[Index] 跳转美团小程序, 活动路径:', miniProgramPath);
        wx.navigateToMiniProgram({
          appId: MEITUAN_APP_ID,
          path: miniProgramPath,
          fail: (err) => {
            console.error('[Index] 跳转美团小程序失败:', err);
            wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
          },
        });
      } catch (err) {
        console.error('[Index] 美团活动转链异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      } finally {
        wx.hideLoading();
        this._activityJumping = false;
      }
    },

    // ==================== 登录 ====================

    /**
     * 确保用户已授权登录并持有真实 uid，否则弹出手机号登录弹窗并存储回调
     * 转链接口（referral-link-by-act-id / tranUrl）都依赖当前用户 uid：
     * 仅 isLogin 不代表授权完成（静默登录可能没带出 userId），必须同时校验 userId
     * @param {Function} callback - 登录成功后要执行的回调
     * @returns {boolean} true=已授权可直接执行，false=已拦截需等待登录
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
     * 空事件处理（阻止登录弹窗内触摸冒泡）
     */
    noop() {},

    /**
     * 关闭登录弹窗（同时清除待执行动作）
     */
    closeLoginModal() {
      this._pendingAction = null;
      this.setData({ showLoginModal: false });
    },

    /**
     * 关闭唯品会授权提示弹窗
     */
    closeVipAuthModal() {
      this.setData({ showVipAuthModal: false });
    },

    /**
     * 唯品会授权提示弹窗「去授权」：
     * 先 /api/thirdAuth/genAuthUrl 获取小程序授权路径，再跳转唯品会小程序完成授权
     */
    async onConfirmVipAuth() {
      if (this._authJumping) return;
      this._authJumping = true;
      this.setData({ showVipAuthModal: false });

      const uid = getApp().globalData.userId || '';
      if (!uid) {
        this._authJumping = false;
        wx.showToast({ title: '请先完成登录授权', icon: 'none' });
        return;
      }

      wx.showLoading({ title: '获取授权链接...', mask: true });
      try {
        const urlRes = await genAuthUrl(uid, VIP_AUTH_PLATFORM);
        // 真实结构示例: { result: true, authUrl: { h5_url, weapp_url, deeplink_url } }
        // 用 weapp_url 跳唯品会小程序授权页；兼容字段位于顶层 / authUrl / data 的多种返回
        const urlBody = urlRes && (urlRes.authUrl || urlRes.data || urlRes);
        const authPath = (urlBody && (urlBody.weapp_url || (urlBody.authUrl && urlBody.authUrl.weapp_url))) || '';
        if (!authPath) {
          console.error('[Index] 获取唯品会授权链接失败:', urlRes);
          wx.showToast({ title: '获取授权链接失败，请稍后重试', icon: 'none' });
          return;
        }
        console.log('[Index] 跳转唯品会授权页, 路径:', authPath);
        wx.navigateToMiniProgram({
          appId: VIP_APP_ID,
          path: authPath,
          fail: (err) => {
            console.error('[Index] 跳转唯品会授权页失败:', err);
            wx.showToast({ title: '跳转授权页失败，请重试', icon: 'none' });
          },
        });
      } catch (err) {
        console.error('[Index] 获取唯品会授权链接异常:', err);
        wx.showToast({ title: '获取授权链接失败，请重试', icon: 'none' });
      } finally {
        wx.hideLoading();
        this._authJumping = false;
      }
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
     * 页面触底加载更多（唯品好货支持 offset 分页；美团热销接口暂不分页）
     */
    onReachBottom() {
      if (this.data.activeTab === 1) {
        this.loadMoreVipGoods();
      }
    },

    // ==================== 商品列表（双 tab） ====================

    /**
     * 切换商品 tab
     * @param {Event} e - data-tab: 1=唯品好货 2=美团热销
     */
    onSwitchTab(e) {
      const tab = Number(e.currentTarget.dataset.tab);
      if (!tab || tab === this.data.activeTab) return;
      this.setData({ activeTab: tab });
      // 美团热销首次进入才按定位加载
      if (tab === 2 && !this.data.mtLoaded && !this.data.mtLoading) {
        this.loadMeituanGoods();
      }
    },

    /**
     * 加载唯品好货第一页（tab=1）
     */
    async loadVipGoods() {
      if (this.data.vipLoading) return;
      this.setData({ vipLoading: true });

      try {
        const res = await fetchVipIndexGoods({
          jxCode: '4vojhsp2',
          offset: 0,
          pageSize: this.data.vipPageSize,
        });

        console.log('[Index] loadVipGoods 商品数:', res.list.length, 'hasMore:', res.hasMore);
        this.setData({
          vipList: this.formatGoodsList(res.list),
          vipOffset: res.nextOffset,
          vipHasMore: res.hasMore,
          vipLoading: false,
        });
      } catch (err) {
        console.error('[Index] 加载唯品好货失败:', err);
        this.setData({ vipLoading: false });
      }
    },

    /**
     * 唯品好货翻页（触底加载更多）
     */
    async loadMoreVipGoods() {
      const { vipLoading, vipHasMore, vipOffset, vipPageSize, vipList } = this.data;
      if (vipLoading || !vipHasMore) return;

      console.log('[Index] loadMoreVipGoods offset:', vipOffset);
      this.setData({ vipLoading: true });

      try {
        const res = await fetchVipIndexGoods({
          jxCode: '4vojhsp2',
          offset: vipOffset,
          pageSize: vipPageSize,
        });

        console.log('[Index] loadMoreVipGoods 新增:', res.list.length);
        this.setData({
          vipList: [...vipList, ...this.formatGoodsList(res.list)],
          vipOffset: res.nextOffset,
          vipHasMore: res.hasMore,
          vipLoading: false,
        });
      } catch (err) {
        console.error('[Index] 唯品好货翻页失败:', err);
        this.setData({ vipLoading: false });
      }
    },

    /**
     * 加载美团热销（tab=2，一次请求，携带首页定位经纬度）
     */
    async loadMeituanGoods() {
      if (this.data.mtLoading) return;
      this.setData({ mtLoading: true });

      try {
        const { longitude, latitude } = this.data;
        const res = await fetchMeituanIndexGoods({ longitude, latitude });

        console.log('[Index] loadMeituanGoods 商品数:', res.list.length);
        this.setData({
          mtList: this.formatMeituanList(res.list),
          mtLoaded: true,
          mtLoading: false,
        });
      } catch (err) {
        console.error('[Index] 加载美团热销失败:', err);
        this.setData({ mtLoading: false });
      }
    },

    /**
     * 格式化唯品会商品（tab=1）
     */
    formatGoodsList(list) {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        const price = parseFloat(item.vipPrice || item.price) || 0;
        const originalPrice = parseFloat(item.marketPrice || item.originalPrice) || 0;
        return {
          id: item.goodsId || item.id || '',
          type: 'vip',
          title: item.goodsName || item.title || '',
          image: item.goodsMainPicture || item.goodsThumbUrl || item.whiteImage || item.image || '',
          price: price,
          priceText: price > 0 ? '¥' + price.toFixed(2) : '',
          originalPrice: originalPrice,
          originalPriceText: originalPrice > price ? '¥' + originalPrice.toFixed(2) : '',
        };
      });
    },

    /**
     * 格式化美团热销商品（tab=2）：美团团购字段 → 双列卡展示结构
     */
    formatMeituanList(list) {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        const price = parseFloat(item.price) || 0;
        const originalPrice = parseFloat(item.originalPrice) || 0;
        return {
          id: item.skuViewId || item.productViewSign || '',
          sign: item.productViewSign || '',
          type: 'meituan',
          title: item.title || '',
          image: item.image || '',
          subtitle: [item.poiName, item.brandName].filter(Boolean).join(' · '),
          priceText: price > 0 ? '¥' + price.toFixed(2) : '',
          originalPriceText: originalPrice > price ? '¥' + originalPrice.toFixed(2) : '',
        };
      });
    },

    /**
     * 点击商品卡片：唯品好货跳详情页，美团热销转链后跳美团小程序
     */
    onGoodsTap(e) {
      const { item } = e.currentTarget.dataset;
      if (!item) return;
      if (item.type === 'meituan') {
        this.openMeituanGoods(item);
        return;
      }
      this._doVipGoodsTap(item.id);
    },

    /**
     * 唯品好货：进入商品详情页
     */
    _doVipGoodsTap(id) {
      if (!id) return;
      wx.navigateTo({ url: `/pages/goods/goods?id=${id}` });
    },

    /**
     * 美团热销：转链后跳转美团外卖小程序（与吃喝玩乐页逻辑一致）
     */
    async openMeituanGoods(item) {
      const sign = item && item.sign;
      if (!sign) {
        wx.showToast({ title: '商品信息缺失', icon: 'none' });
        return;
      }

      // 转链需要用户 uid，未登录先弹出登录
      if (!this.ensureLogin(() => this.openMeituanGoods(item))) return;

      if (this.data.mtJumping) return;
      this.setData({ mtJumping: true });

      wx.showLoading({ title: '获取推广链接...', mask: true });
      const res = await getMeituanGoodsReferralLink(sign);
      wx.hideLoading();
      this.setData({ mtJumping: false });

      if (!res || !res.success || !res.data || !res.data.referralLinkMap) {
        console.error('[Index] 美团商品转链失败:', res);
        wx.showToast({ title: '获取推广链接失败，请稍后重试', icon: 'none' });
        return;
      }

      const miniProgramPath = res.data.referralLinkMap[MINI_PROGRAM_LINK_KEY];
      if (!miniProgramPath) {
        wx.showToast({ title: '该商品暂不支持跳转', icon: 'none' });
        return;
      }

      console.log('[Index] 跳转美团小程序, 商品推广路径:', miniProgramPath);
      wx.navigateToMiniProgram({
        appId: MEITUAN_APP_ID,
        path: miniProgramPath,
        success: () => {
          console.log('[Index] 美团商品跳转成功');
        },
        fail: (err) => {
          console.error('[Index] 美团商品跳转失败:', err);
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
        },
      });
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