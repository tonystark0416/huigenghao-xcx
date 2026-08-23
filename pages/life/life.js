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
    // 排序
    sortOptions: [
      { label: '综合排序', value: SORT_COMPREHENSIVE },
      { label: '价格升序', value: SORT_PRICE_ASC },
      { label: '离我最近', value: SORT_NEARBY },
    ],
    sortField: SORT_COMPREHENSIVE,
    longitude: '',
    latitude: '',
  },

  lifetimes: {
    attached() {
      this.loadBanners();
      // 进入页面即获取定位并缓存，后续搜索/翻页携带经纬度
      this.loadLocation();
    },
  },

  methods: {
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
  },
});
