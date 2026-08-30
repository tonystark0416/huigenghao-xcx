// pages/orders/orders.js
const { getOrderList } = require('../../utils/api');

const PAGE_SIZE = 10;

// 平台名称映射
const PLATFORM_MAP = {
  vip: '唯品会',
  taobao: '淘宝',
  tmall: '天猫',
  jd: '京东',
  pdd: '拼多多',
  meituan: '美团',
};

// 订单状态映射
const STATUS_MAP = {
  0: '已失效',
  1: '待结算',
  2: '已结算',
};

/**
 * 毫秒时间戳转 2026/8/20 13:22:23 格式
 * @param {string|number} ts - 毫秒时间戳
 */
function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return '';

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  data: {
    loading: false,
    orderList: [],
    page: 1,
    totalPages: 0,
    hasMore: false,
    loadMoreLoading: false,
    empty: false,
    showLoginModal: false,
  },

  lifetimes: {
    attached() {
      this.checkAndLoad();
    },
  },

  methods: {
    /**
     * 校验登录状态：
     * 未登录（无 uid）→ 弹出登录弹窗；已登录 → 加载订单
     */
    checkAndLoad() {
      const app = getApp();
      const uid = app.globalData.userId || app.globalData.openid || '';
      if (app.globalData.needPhoneLogin && !app.globalData.isLogin) {
        this.setData({ showLoginModal: true });
        return;
      }
      if (!uid) {
        this.setData({ showLoginModal: true });
        return;
      }
      this.loadOrders(1, true);
    },

    /**
     * 加载订单列表
     * @param {number} page - 页码
     * @param {boolean} reset - 是否重置列表
     */
    async loadOrders(page, reset) {
      const app = getApp();
      const uid = app.globalData.userId || app.globalData.openid || '';
      if (!uid) {
        this.setData({ showLoginModal: true });
        return;
      }

      if (reset) {
        this.setData({ loading: true, orderList: [], page: 1, totalPages: 0, hasMore: false, empty: false });
      } else {
        this.setData({ loadMoreLoading: true });
      }

      try {
        const res = await getOrderList(uid, page);

        const orderList = res.list.map((item) => ({
          ...item,
          createTimeText: formatTime(item.createTime),
          platformText: PLATFORM_MAP[item.platform] || item.platform || '',
          statusText: STATUS_MAP[item.status] !== undefined ? STATUS_MAP[item.status] : '处理中',
        }));

        this.setData({
          orderList: reset ? orderList : this.data.orderList.concat(orderList),
          page: res.page || page,
          totalPages: res.totalPages || 0,
          hasMore: (res.page || page) < (res.totalPages || 0),
          empty: reset && orderList.length === 0,
          loading: false,
          loadMoreLoading: false,
        });
      } catch (err) {
        console.error('[Orders] 加载订单失败:', err);
        this.setData({
          loading: false,
          loadMoreLoading: false,
          empty: reset && this.data.orderList.length === 0,
        });
        wx.showToast({ title: '订单加载失败', icon: 'none' });
      }
    },

    // 下拉加载更多
    onReachBottom() {
      const { hasMore, loadMoreLoading, loading } = this.data;
      if (!hasMore || loadMoreLoading || loading) return;
      this.loadOrders(this.data.page + 1, false);
    },

    // 点击重试
    onRetryTap() {
      this.checkAndLoad();
    },

    // ==================== 登录弹窗 ====================

    closeLoginModal() {
      this.setData({ showLoginModal: false });
    },

    noop() {},

    /**
     * 手机号快捷登录回调
     */
    async onGetPhoneNumber(e) {
      const { code, errMsg } = e.detail;

      if (errMsg !== 'getPhoneNumber:ok' || !code) {
        console.warn('[Orders] 用户拒绝手机号授权:', errMsg);
        wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
        return;
      }

      console.log('[Orders] 获取到手机号 code:', code);

      try {
        wx.showLoading({ title: '登录中...', mask: true });

        // Step 1: 用手机号 code 换取真实手机号码
        const purePhoneNumber = await this.getPhoneNumber(code);
        if (!purePhoneNumber) {
          wx.hideLoading();
          wx.showToast({ title: '获取手机号失败', icon: 'none' });
          return;
        }

        console.log('[Orders] 获取到手机号:', purePhoneNumber);

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
          console.log('[Orders] 注册登录成功，userId:', app.globalData.userId);

          // 登录成功后加载订单
          setTimeout(() => this.checkAndLoad(), 500);
        } else {
          wx.showToast({ title: (res && res.message) || '登录失败，请重试', icon: 'none' });
        }
      } catch (err) {
        wx.hideLoading();
        console.error('[Orders] 手机号登录异常:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    },

    /**
     * 用手机号 code 换取真实手机号
     */
    getPhoneNumber(code) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `https://hgh.pangpai-car.com/api/weixin/getPhone?code=${code}`,
          method: 'GET',
          timeout: 5000,
          success: (res) => {
            console.log('[Orders] /api/weixin/getPhone 响应:', res.data);
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
            console.error('[Orders] /api/weixin/getPhone 请求失败:', err);
            reject(err);
          },
        });
      });
    },

    /**
     * 注册
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
  },
});
