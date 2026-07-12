/**
 * API 服务层
 * 优先调用真实接口，失败/无数据时 fallback 到 mock
 */

const BASE_URL = 'http://localhost:3000';

// 调试开关：true=仅mock false=优先真实接口
const MOCK_ONLY = false;

const PLATFORM_NAMES = {
  vip: '唯品会',
  taobao: '淘宝',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖音',
};

// 用户标识，后续从登录态获取
let USER_CONFIG = {
  uid: 'mike004',
  pid: 'mike0416',
  chanTag: 'default_pid',
  openid: 'default_openid',
};

/**
 * 设置用户配置（登录后调用）
 * @param {Object} config - { uid, pid }
 */
function setUserConfig(config) {
  USER_CONFIG = { ...USER_CONFIG, ...config };
}

// ==================== 真实接口适配层 ====================

/**
 * 将真实接口的商品数据映射为内部统一结构
 * 
 * 真实字段 → 内部字段：
 *   imageUrl   → image    (商品主图)
 *   commission → rebate   (返利金额)
 *   items      → list     (商品列表)
 *   success    → code     (状态码)
 */
function mapProduct(item) {
  const price = parseFloat(item.price) || 0;
  const commission = parseFloat(item.commission) || 0;

  return {
    id: item.id || '',
    title: item.title || '',
    image: item.imageUrl || '',
    price: price,
    // 真实接口无原价，按返利比例反推
    originalPrice: commission > 0 ? +(price + commission).toFixed(2) : price,
    rebate: commission,
    platform: item.platform || 'vip',
    sales: item.sales || 0,
    couponAmount: item.couponAmount || 0,
  };
}

/**
 * 适配真实接口响应 → 统一内部格式
 */
function adaptResponse(rawData) {
  if (!rawData || !rawData.success) {
    return null;
  }

  const d = rawData.data || {};
  const items = d.items || [];
  const list = items.map(mapProduct);

  return {
    code: 0,
    data: {
      list: list,
      total: list.length,
      // 当页有数据就认为还有下一页（接口 pageSize 固定 10，空页 = 到底）
      hasMore: list.length > 0,
    },
  };
}

// ==================== 网络请求 ====================

/**
 * 发起 GET 请求
 */
function request(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
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
}

/**
 * 发起 POST 请求
 */
function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data,
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
}

// ==================== Mock 数据 ====================

const MOCK_IMAGES = [
  'https://img.alicdn.com/bao/uploaded/i3/2207658164719/O1CN01cFvEyT1oIAyQPKFwl_!!2207658164719.jpg',
  'https://img.alicdn.com/bao/uploaded/i4/2207658164719/O1CN01f0qxjC1oIAyRnLBSx_!!2207658164719.jpg',
  'https://img.alicdn.com/bao/uploaded/i1/2207658164719/O1CN01KtDnPq1oIAyOFELpp_!!2207658164719.jpg',
  'https://img.alicdn.com/bao/uploaded/i2/2207658164719/O1CN01l5QvPr1oIAyQPKY0p_!!2207658164719.jpg',
];

const ADJECTIVES = ['新款', '春季', '爆款', '热卖', '品质', '高端', '超值', '限时'];
const PRODUCTS = ['连衣裙', '运动鞋', '手机壳', '蓝牙耳机', 'T恤', '背包', '护肤品', '零食大礼包', '家纺四件套', '充电宝'];

function generateMockProducts(keyword, platform, count) {
  const list = [];
  const platforms = platform === 'all'
    ? ['taobao', 'jd', 'pdd', 'douyin', 'vip']
    : [platform];

  for (let i = 0; i < count; i++) {
    const p = platforms[i % platforms.length];
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const prod = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const originalPrice = Math.floor(Math.random() * 30000 + 3000) / 100;
    const price = Math.floor(originalPrice * (Math.random() * 0.4 + 0.35) * 100) / 100;
    const rebateRate = Math.random() * 0.15 + 0.02;

    list.push({
      id: `mock_${Date.now()}_${i}`,
      title: keyword ? `${adj}${keyword}${prod}` : `${adj}${prod} 品质保证`,
      image: MOCK_IMAGES[i % MOCK_IMAGES.length],
      price: price,
      originalPrice: originalPrice,
      rebate: Math.floor(price * rebateRate * 100) / 100,
      platform: p,
      sales: Math.floor(Math.random() * 50000 + 100),
      couponAmount: Math.floor(originalPrice - price),
    });
  }

  return list;
}

function mockSearch({ keyword, platform, page, pageSize }) {
  return new Promise((resolve) => {
    const delay = 300 + Math.random() * 500;
    const TOTAL_MOCK = 83;
    const totalPages = Math.ceil(TOTAL_MOCK / pageSize);
    const isLastPage = page >= totalPages;
    const count = isLastPage ? TOTAL_MOCK - (page - 1) * pageSize : pageSize;

    setTimeout(() => {
      resolve({
        code: 0,
        data: {
          list: generateMockProducts(keyword, platform, count),
          total: TOTAL_MOCK,
          hasMore: !isLastPage,
        },
      });
    }, delay);
  });
}

// ==================== 公开接口 ====================

/**
 * 搜索商品
 * 
 * 真实接口 (GET): http://localhost:3000/api/search
 * 请求参数 (query):
 *   - keyword  {string}  搜索关键词
 *   - uid      {string}  用户标识
 *   - pid      {string}  项目标识
 *   - page     {number}  页码，从1开始
 * 
 * 内部统一返回格式:
 *   { code: 0, data: { list: Product[], total: number, hasMore: boolean } }
 * 
 * @param {Object} params
 * @param {string} params.keyword   - 搜索关键词
 * @param {string} params.platform  - 平台筛选: 'all' | 'vip' | 'taobao' | 'jd' | 'pdd' | 'douyin'
 * @param {number} params.page      - 页码，从1开始
 * @param {number} params.pageSize  - 每页条数，默认20
 */
async function searchProducts({ keyword = '', platform = 'all', page = 1, pageSize = 20 }) {
  if (MOCK_ONLY) {
    return mockSearch({ keyword, platform, page, pageSize });
  }

  try {
    const query = [
      `keyword=${encodeURIComponent(keyword)}`,
      `uid=${USER_CONFIG.uid}`,
      `pid=${USER_CONFIG.pid}`,
      `page=${page}`,
    ].join('&');

    const rawData = await request(`${BASE_URL}/api/search?${query}`);
    const result = adaptResponse(rawData);

    if (result) {
      return result;
    }

    console.warn('[API] 真实接口返回空数据，使用 mock 兜底');
    return mockSearch({ keyword, platform, page, pageSize });
  } catch (err) {
    console.warn('[API] 真实接口调用失败，使用 mock 兜底:', err.message);
    return mockSearch({ keyword, platform, page, pageSize });
  }
}

// ==================== 商品详情 ====================

/**
 * 适配真实商品详情接口 → 内部统一格式
 */
function adaptGoodsDetail(rawData) {
  if (!rawData || !rawData.success) return null;

  const r = rawData.data && rawData.data.result;
  if (!r) return null;

  const promo = r.goodsPromotionInfo || {};

  return {
    code: 0,
    data: {
      id: r.goodsId || '',
      title: r.goodsName || '',
      shortTitle: r.shortTitle || '',
      image: r.goodsMainPicture || r.goodsThumbUrl || '',
      images: [r.goodsMainPicture, r.goodsThumbUrl].filter(Boolean),
      price: parseFloat(promo.salePrice || r.vipPrice) || 0,
      originalPrice: parseFloat(r.marketPrice) || 0,
      rebate: parseFloat(r.commission) || 0,
      rebateRate: parseFloat(r.commissionRate) || 0,
      discount: parseFloat(r.discount) || 0,
      brandName: r.brandName || '',
      brandLogo: r.brandLogoFull || '',
      storeName: (r.storeInfo && r.storeInfo.storeName) || '',
      sales: r.productSales || '',
      tags: r.tagNames || [],
      categoryName: r.categoryName || '',
      destUrl: r.destUrl || r.destUrlPc || '',
      platform: 'vip',
    },
  };
}

/**
 * Mock 商品详情
 */
function mockGoodsDetail(goodsId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        data: {
          id: goodsId,
          title: '商品详情示例 - ' + goodsId.slice(-6),
          shortTitle: '示例商品',
          image: 'https://a.vpimg4.com/upload/merchandise/pdcvis/667296/2026/0409/170/74a66dfe-a895-4e99-85a9-4cdbaf9fc6c4.jpg',
          images: ['https://a.vpimg4.com/upload/merchandise/pdcvis/667296/2026/0409/170/74a66dfe-a895-4e99-85a9-4cdbaf9fc6c4.jpg'],
          price: 69.00,
          originalPrice: 139.00,
          rebate: 2.07,
          rebateRate: 3,
          discount: 0.5,
          brandName: '示例品牌',
          brandLogo: '',
          storeName: '示例店铺',
          sales: '5000+',
          tags: ['春季', '热卖'],
          categoryName: '运动户外',
          destUrl: '',
          platform: 'vip',
        },
      });
    }, 300);
  });
}

/**
 * 获取商品详情
 * 
 * 真实接口 (GET): http://localhost:3000/api/goods
 * 请求参数 (query):
 *   - goodsId  {string}  商品ID
 *   - chanTag  {string}  渠道标签
 *   - openid   {string}  用户openid
 * 
 * @param {string} goodsId - 商品ID
 * @returns {Promise<{code: number, data: Object}>}
 */
async function getProductDetail(goodsId) {
  if (!goodsId) {
    return { code: -1, message: '缺少 goodsId' };
  }

  if (MOCK_ONLY) {
    return mockGoodsDetail(goodsId);
  }

  try {
    const query = [
      `goodsId=${goodsId}`,
      `chanTag=${USER_CONFIG.chanTag || 'default_pid'}`,
      `openid=${USER_CONFIG.openid || 'default_openid'}`,
    ].join('&');

    const rawData = await request(`${BASE_URL}/api/goods?${query}`);
    const result = adaptGoodsDetail(rawData);

    if (result) return result;

    console.warn('[API] 商品详情返回空，使用 mock 兜底');
    return mockGoodsDetail(goodsId);
  } catch (err) {
    console.warn('[API] 商品详情接口失败，使用 mock 兜底:', err.message);
    return mockGoodsDetail(goodsId);
  }
}

// ==================== 用户登录 ====================

/**
 * 通过 openid 登录
 * POST http://localhost:3000/api/user/loginByOpenid
 * @param {string} openid - 用户 openid
 * @returns {Promise<Object>}
 */
async function loginByOpenid(openid) {
  if (!openid) {
    return { success: false, message: '缺少 openid' };
  }

  try {
    const result = await postRequest(`${BASE_URL}/api/user/loginByOpenid`, { openid });
    return result;
  } catch (err) {
    console.error('[API] 登录请求失败:', err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  searchProducts,
  getProductDetail,
  loginByOpenid,
  setUserConfig,
  PLATFORM_NAMES,
};
