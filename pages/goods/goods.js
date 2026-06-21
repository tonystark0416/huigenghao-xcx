// pages/goods/goods.js
const { getProductDetail } = require('../../utils/api');

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
      }
    },

    // 复制链接
    onCopyLink() {
      const { goods } = this.data;
      if (!goods || !goods.destUrl) {
        wx.showToast({ title: '暂无购买链接', icon: 'none' });
        return;
      }
      wx.setClipboardData({
        data: goods.destUrl,
        success: () => {
          wx.showToast({ title: '链接已复制，请打开浏览器购买', icon: 'none', duration: 2000 });
        },
      });
    },
  },
});
