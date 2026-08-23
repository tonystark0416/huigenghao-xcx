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

    // 前往购买：实时请求转链接口，获取 weapp_url 跳转唯品会小程序
    async onBuyTap() {
      const { goods } = this.data;
      if (!goods || !goods.destUrl) {
        wx.showToast({ title: '暂无购买链接', icon: 'none' });
        return;
      }
      if (this._buying) return;
      this._buying = true;

      const uid = getApp().globalData.userId || getApp().globalData.openid || '';
      if (!uid) {
        this._buying = false;
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

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
