const api = require('../../utils/api');

// 美团外卖小程序 appId（跳转目标）
const MEITUAN_APP_ID = 'wxde8ac0a21135c07d';
// 转链返回中 key=4 对应小程序路径
const MINI_PROGRAM_LINK_KEY = '4';

Component({
  data: {
    bannerList: [],
    loading: true,
    loaded: false,
  },

  lifetimes: {
    attached() {
      this.loadBanners();
    },
  },

  methods: {
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
  },
});
