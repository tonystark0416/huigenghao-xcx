// pages/search/search.js
const { searchProducts } = require('../../utils/api');

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

Component({
  data: {
    keyword: '',
    platform: 'all',
    platforms: [
      { key: 'all', name: '全部', color: '#333' },
      { key: 'vip', name: '唯品会', color: '#E4007F' },
      { key: 'taobao', name: '淘宝', color: '#ff5000' },
      { key: 'jd', name: '京东', color: '#c91623' },
      { key: 'pdd', name: '拼多多', color: '#e02e24' },
      { key: 'douyin', name: '抖音', color: '#000000' },
    ],
    productList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    refreshing: false,
    searchHistory: [],
    showHistory: false,
    empty: false,
    firstLoad: true,
    inputFocus: false,
  },

  lifetimes: {
    attached() {
      // 读取搜索历史
      this.loadHistory();
    },
  },

  methods: {
    // ==================== 搜索历史 ====================

    loadHistory() {
      try {
        const history = wx.getStorageSync(SEARCH_HISTORY_KEY) || [];
        this.setData({
          searchHistory: history,
          showHistory: history.length > 0,
        });
      } catch (e) {
        this.setData({ searchHistory: [], showHistory: false });
      }
    },

    saveHistory(keyword) {
      if (!keyword.trim()) return;
      let history = this.data.searchHistory.slice();
      // 去重：如果已存在则移到最前
      const idx = history.indexOf(keyword);
      if (idx > -1) history.splice(idx, 1);
      history.unshift(keyword);
      // 最多保留 MAX_HISTORY 条
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      this.setData({ searchHistory: history });
      wx.setStorageSync(SEARCH_HISTORY_KEY, history);
    },

    clearHistory() {
      this.setData({ searchHistory: [] });
      wx.removeStorageSync(SEARCH_HISTORY_KEY);
    },

    deleteHistoryItem(e) {
      const { index } = e.currentTarget.dataset;
      const history = this.data.searchHistory.slice();
      history.splice(index, 1);
      this.setData({ searchHistory: history });
      wx.setStorageSync(SEARCH_HISTORY_KEY, history);
    },

    // ==================== 搜索框 ====================

    onSearchInput(e) {
      const keyword = e.detail.value;
      this.setData({
        keyword,
        showHistory: !keyword,
        empty: false,
      });
    },

    onSearchFocus() {
      const { keyword } = this.data;
      this.setData({
        showHistory: !keyword && this.data.searchHistory.length > 0,
        inputFocus: true,
      });
    },

    onSearchBlur() {
      // 延迟收起，给历史词点击留时间
      setTimeout(() => {
        this.setData({ showHistory: false, inputFocus: false });
      }, 200);
    },

    onSearchConfirm() {
      const { keyword } = this.data;
      if (!keyword.trim()) return;
      this.saveHistory(keyword.trim());
      this.setData({ showHistory: false });
      this.doSearch();
    },

    onClearInput() {
      this.setData({
        keyword: '',
        productList: [],
        empty: false,
        firstLoad: true,
        showHistory: this.data.searchHistory.length > 0,
      });
    },

    onHistoryTap(e) {
      const keyword = e.currentTarget.dataset.keyword;
      this.setData({ keyword, showHistory: false });
      this.doSearch();
    },

    // ==================== 平台切换 ====================

    onPlatformChange(e) {
      const platform = e.currentTarget.dataset.key;
      if (platform === this.data.platform) return;
      this.setData({ platform });
      if (this.data.keyword.trim()) {
        this.doSearch();
      }
    },

    // ==================== 核心搜索 ====================

    /**
     * 格式化商品列表：预处理不在模板中支持的运算
     */
    formatProductList(list) {
      return list.map(item => ({
        ...item,
        salesText: item.sales > 10000 
          ? (item.sales / 10000).toFixed(1) + '万' 
          : String(item.sales),
      }));
    },

    async doSearch() {
      const { keyword, platform, pageSize } = this.data;
      if (this.data.loading) return;

      this.setData({
        page: 1,
        loading: true,
        empty: false,
        firstLoad: false,
      });

      try {
        const res = await searchProducts({
          keyword: keyword.trim(),
          platform,
          page: 1,
          pageSize,
        });

        if (res.code === 0) {
          const list = this.formatProductList(res.data.list || []);
          this.setData({
            productList: list,
            hasMore: res.data.hasMore,
            loading: false,
            empty: list.length === 0,
          });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
        }
      } catch (err) {
        console.error('搜索失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    },

    async loadMore() {
      const { loading, hasMore, page, keyword, platform, pageSize } = this.data;
      if (loading || !hasMore) return;

      const nextPage = page + 1;
      this.setData({ loading: true });

      try {
        const res = await searchProducts({
          keyword: keyword.trim(),
          platform,
          page: nextPage,
          pageSize,
        });

        if (res.code === 0) {
          const newList = this.formatProductList(res.data.list || []);
          this.setData({
            productList: [...this.data.productList, ...newList],
            page: nextPage,
            hasMore: res.data.hasMore,
            loading: false,
          });
        } else {
          this.setData({ loading: false });
        }
      } catch (err) {
        console.error('加载更多失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    },

    // ==================== 下拉刷新 / 上拉加载 ====================

    async onRefresh() {
      const { keyword } = this.data;
      if (!keyword.trim()) {
        this.setData({ refreshing: false });
        return;
      }

      this.setData({ refreshing: true });

      try {
        const res = await searchProducts({
          keyword: keyword.trim(),
          platform: this.data.platform,
          page: 1,
          pageSize: this.data.pageSize,
        });

        if (res.code === 0) {
          const list = this.formatProductList(res.data.list || []);
          this.setData({
            productList: list,
            page: 1,
            hasMore: res.data.hasMore,
            refreshing: false,
            empty: list.length === 0,
          });
        } else {
          this.setData({ refreshing: false });
        }
      } catch (err) {
        this.setData({ refreshing: false });
        wx.showToast({ title: '刷新失败', icon: 'none' });
      }
    },

    onScrollToLower() {
      this.loadMore();
    },

    // ==================== 商品点击 ====================

    onProductTap(e) {
      const { id } = e.currentTarget.dataset;
      if (id) {
        wx.navigateTo({ url: `/pages/goods/goods?id=${id}` });
      }
    },
  },
});
