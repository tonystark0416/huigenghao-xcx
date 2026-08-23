/**
 * API 服务层
 * 优先调用真实接口，失败/无数据时 fallback 到 mock
 */

const BASE_URL = 'https://hgh.pangpai-car.com';

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
 * 解析响应数据：wx.request 默认 "json" 模式，
 * 但当后端 Content-Type 不规范时 res.data 可能是字符串，需要兜底解析
 */
function parseResponseData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn('[API] JSON 解析失败，保留原始字符串');
      return data;
    }
  }
  return data;
}

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
          resolve(parseResponseData(res.data));
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
          resolve(parseResponseData(res.data));
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
 * 真实接口 (GET): http://hgh.pangpai-car.com/api/search
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
 * 真实接口 (GET): http://hgh.pangpai-car.com/api/goods
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
 * POST http://hgh.pangpai-car.com/api/user/loginByOpenid
 * @param {string} openid - 用户 openid
 * @returns {Promise<Object>}
 */
async function loginByOpenid(openid) {
  if (!openid) {
    return { success: false, message: '缺少 openid' };
  }

  try {
    const result = await postRequest(`${BASE_URL}/api/user/loginByOpenid`, { openid });
    console.log('[API] loginByOpenid 响应:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('[API] 登录请求失败:', err.message);
    return { success: false, message: err.message };
  }
}

// ==================== 首页商品列表 ====================

/**
 * 获取首页商品列表（唯品会）
 * GET /api/vip/goodsList
 * @param {Object} params
 * @param {string} params.jxCode   - 精选 code
 * @param {number} params.offset   - 偏移量
 * @param {number} params.pageSize - 每页数量
 */
async function getGoodsList({ jxCode = '4vojhsp2', offset = 0, pageSize = 10 } = {}) {
  try {
    const query = `jxCode=${jxCode}&offset=${offset}&pageSize=${pageSize}`;
    console.log('[API] getGoodsList 请求URL:', `${BASE_URL}/api/vip/goodsList?${query}`);
    const result = await request(`${BASE_URL}/api/vip/goodsList?${query}`);
    console.log('[API] getGoodsList 响应:', result);
    return result;
  } catch (err) {
    console.error('[API] getGoodsList 失败:', err.message);
    return null;
  }
}

// ==================== 第三方授权 ====================

const THIRD_PID = '43384525_317172887';

/**
 * 校验第三方平台是否已授权
 * GET /api/thirdAuth/checkAuth?uid=xxx&pid=xxx
 * @param {string} uid - 用户标识
 * @param {string} pid - 推广位ID，默认 gh_8ed2afad9972
 */
async function checkAuth(uid, platform, pid = THIRD_PID) {
  try {
    const query = `uid=${uid || ''}&platform=${platform}&pid=${pid}`;
    const fullRes = await new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/api/thirdAuth/checkAuth?${query}`,
        method: 'GET',
        timeout: 5000,
        success: resolve,
        fail: reject,
      });
    });
    console.log('[API] checkAuth data:', fullRes.data);
    return fullRes.data;
  } catch (err) {
    console.error('[API] checkAuth 失败:', err.message);
    return { isAuth: false };
  }
}

/**
 * 生成第三方平台授权链接
 * GET /api/thirdAuth/genAuthUrl?uid=xxx&pid=xxx
 * @param {string} uid - 用户标识
 * @param {string} pid - 推广位ID，默认 gh_8ed2afad9972
 */
async function genAuthUrl(uid, platform, pid = THIRD_PID) {
  try {
    const query = `uid=${uid || ''}&platform=${platform}&pid=${pid}`;
    const result = await request(`${BASE_URL}/api/thirdAuth/genAuthUrl?${query}`);
    console.log('[API] genAuthUrl 响应:', result);
    return result;
  } catch (err) {
    console.error('[API] genAuthUrl 失败:', err.message);
    return null;
  }
}

// ==================== 链接转换 ====================

const TRAN_URL_PID = '43384525_317172887';

/**
 * 识别链接所属平台
 * @param {string} url - 原始链接
 * @returns {string} 平台标识
 */
function detectPlatform(url) {
  if (!url) return '';
  const u = url.toLowerCase();
  if (u.includes('yangkeduo.com') || u.includes('pinduoduo.com')) return 'pdd';
  if (u.includes('taobao.com') || u.includes('tmall.com')) return 'taobao';
  if (u.includes('jd.com')) return 'jd';
  if (u.includes('vip.com')) return 'vip';
  return '';
}

/**
 * 链接转换：将电商商品链接转为 CPS 推广链接
 *
 * 接口: GET https://hgh.pangpai-car.com/api/tranUrl
 * 参数:
 *   - uid        {string} 当前用户 uid
 *   - pid        {string} 推广位ID，固定 43384525_317172887
 *   - source_url {string} 用户输入的原始链接
 *
 * 成功返回: { code: 200, urls: { h5_url, weapp_url, weapp_short_link, deeplink_url } }
 * 失败返回: { code: -1, urls: { ... 全空 } }
 * 不支持:   { code: -2, urls: { ... 全空 } }
 *
 * @param {string} url - 原始电商链接
 * @param {string} uid - 当前用户 uid
 */
async function convertLink(url, uid) {
  // 校验链接
  if (!url || !url.trim()) {
    return { code: -1, message: '请输入商品链接' };
  }

  // 校验 uid
  if (!uid) {
    return { code: -1, message: '请先登录' };
  }

  try {
    const query = [
      `uid=${encodeURIComponent(uid)}`,
      `pid=${encodeURIComponent(TRAN_URL_PID)}`,
      `source_url=${encodeURIComponent(url.trim())}`,
    ].join('&');

    const fullUrl = `${BASE_URL}/api/tranUrl?${query}`;
    console.log('[API] convertLink 请求:', fullUrl);

    const result = await request(fullUrl);
    console.log('[API] convertLink 原始响应类型:', typeof result);
    console.log('[API] convertLink 响应:', JSON.stringify(result));

    if (!result) {
      return { code: -3, message: '网络异常，请重试' };
    }

    const resCode = result.code;
    console.log('[API] convertLink resCode:', resCode, 'hasUrls:', !!result.urls, 'hasH5:', !!(result.urls && result.urls.h5_url));

    // 成功
    if (resCode === 200 && result.urls && result.urls.h5_url) {
      return {
        code: 0,
        data: {
          originalUrl: url.trim(),
          h5_url: result.urls.h5_url,
          weapp_url: result.urls.weapp_url || '',
          weapp_short_link: result.urls.weapp_short_link || '',
          deeplink_url: result.urls.deeplink_url || '',
        },
      };
    }

    // 平台不支持
    if (resCode === -2) {
      return { code: -2, message: '暂不支持该平台的链接' };
    }

    // 转换失败
    return { code: -3, message: '链接转换失败，请检查链接是否有效' };
  } catch (err) {
    console.warn('[API] convertLink 失败:', err.message);
    return { code: -3, message: '网络异常，请重试' };
  }
}

/**
 * 获取唯品会商品推广链接（商品详情页「前往购买」用）
 * GET /api/tranUrl?uid=xxx&pid=default_pid&source_url=xxx
 *
 * 成功返回: { code: 200, urls: { h5_url, weapp_url, weapp_short_link, deeplink_url } }
 *
 * @param {string} sourceUrl - 商品原始链接（详情接口的 destUrl）
 * @param {string} uid - 当前用户 uid
 * @returns {Promise<Object|null>} 原始响应，失败返回 null
 */
async function getTranUrl(sourceUrl, uid) {
  if (!sourceUrl || !uid) return null;

  try {
    const query = [
      `uid=${encodeURIComponent(uid)}`,
      `pid=${encodeURIComponent('default_pid')}`,
      `source_url=${encodeURIComponent(sourceUrl)}`,
    ].join('&');

    const url = `${BASE_URL}/api/tranUrl?${query}`;
    console.log('[API] getTranUrl 请求:', url);
    const result = await request(url);
    console.log('[API] getTranUrl 响应:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('[API] getTranUrl 失败:', err.message);
    return null;
  }
}

// ==================== 吃喝玩乐 Banner ====================

/**
 * 获取吃喝玩乐 Banner 活动列表
 * GET /api/banner
 * @returns {Promise<Array>} banner 列表 [{ id, extra_id, title, sub_text, banner_img_url, sort }]
 */
async function getBanners() {
  try {
    const result = await request(`${BASE_URL}/api/banner`);
    console.log('[API] getBanners 响应:', JSON.stringify(result));
    if (Array.isArray(result)) {
      return result.sort((a, b) => (b.sort || 0) - (a.sort || 0));
    }
    return [];
  } catch (err) {
    console.warn('[API] getBanners 失败:', err.message);
    return [];
  }
}

/**
 * 获取美团活动转链（referralLinkMap 中 key=4 为小程序路径）
 * GET /api/meituan/referral-link-by-act-id?actId=xxx
 * @param {string|number} actId - 活动 ID（banner 的 extra_id）
 * @returns {Promise<Object|null>} 转链结果
 */
async function getMeituanReferralLink(actId) {
  try {
    const url = `${BASE_URL}/api/meituan/referral-link-by-act-id?actId=${encodeURIComponent(actId)}`;
    const result = await request(url);
    console.log('[API] getMeituanReferralLink 响应:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('[API] getMeituanReferralLink 失败:', err.message);
    return null;
  }
}

/**
 * 获取美团商品推广链接（referralLinkMap 中 key=4 为小程序路径）
 * GET /api/meituan/referral-link-by-goods-id?productViewSign=xxx
 * @param {string} productViewSign - 商品推广标识（搜索列表项的 productViewSign 字段）
 * @returns {Promise<Object|null>} 转链结果
 */
async function getMeituanGoodsReferralLink(productViewSign) {
  try {
    const url = `${BASE_URL}/api/meituan/referral-link-by-goods-id?productViewSign=${encodeURIComponent(productViewSign)}`;
    const result = await request(url);
    console.log('[API] getMeituanGoodsReferralLink 响应:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('[API] getMeituanGoodsReferralLink 失败:', err.message);
    return null;
  }
}

// ==================== 吃喝玩乐商品搜索 ====================

/**
 * 将美团搜索接口的商品字段映射为内部统一结构
 *
 * 真实字段 → 内部字段：
 *   couponPackDetail.name          → title       (商品名)
 *   couponPackDetail.headUrl       → image       (商品图)
 *   couponPackDetail.sellPrice     → price       (售价)
 *   couponPackDetail.originalPrice → originalPrice (原价)
 *   couponPackDetail.saleVolume    → sales       (销量文案)
 *   couponPackDetail.categoryName  → category    (分类)
 *   couponPackDetail.skuViewId     → skuViewId   (商品标识)
 *   couponPackDetail.productViewSign → productViewSign (商品推广标识，点击转链用)
 *   brandInfo.brandName            → brandName   (品牌)
 *   brandInfo.brandLogoUrl         → brandLogo   (品牌logo)
 *   commissionInfo.commission      → rebate      (佣金)
 *   commissionInfo.commissionPercent → rebatePercent (佣金比例)
 *   deliverablePoiInfo.poiName     → poiName     (门店名)
 *   deliverablePoiInfo.deliveryDistance → distance (配送距离)
 */
function mapMeituanGoods(item) {
  const coupon = item.couponPackDetail || {};
  const brand = item.brandInfo || {};
  const commission = item.commissionInfo || {};
  const poi = item.deliverablePoiInfo || {};

  return {
    skuViewId: coupon.skuViewId || '',
    productViewSign: coupon.productViewSign || '',
    title: coupon.name || '',
    image: coupon.headUrl || '',
    price: coupon.sellPrice || '',
    originalPrice: coupon.originalPrice || '',
    sales: coupon.saleVolume || '',
    category: coupon.categoryName || '',
    brandName: brand.brandName || '',
    brandLogo: brand.brandLogoUrl || '',
    rebate: commission.commission || '',
    rebatePercent: commission.commissionPercent || '',
    poiName: poi.poiName || '',
    distance: poi.deliveryDistance || '',
  };
}

/**
 * 搜索美团吃喝玩乐商品
 *
 * 接口: GET ${BASE_URL}/api/meituan/goods
 * 请求参数 (query):
 *   - searchText  {string}  搜索关键词
 *   - longitude   {string}  经度（可为空）
 *   - latitude    {string}  纬度（可为空）
 *   - pageSize    {number}  每页条数，默认20
 *   - pageNo      {number}  页码，从1开始
 *   - searchId    {string}  分页标识，翻页时回传上一页返回的 searchId
 *   - sortField   {number}  排序方式：1=综合排序，2=价格升序，6=离我最近（默认1）
 *
 * 成功返回: { success: true, data: { code: 0, message, data: [商品...], hasNext, searchId } }
 *
 * @param {Object} params
 * @param {string} params.searchText - 搜索关键词
 * @param {string} [params.longitude=''] - 经度
 * @param {string} [params.latitude=''] - 纬度
 * @param {number} [params.pageNo=1] - 页码，从1开始
 * @param {number} [params.pageSize=20] - 每页条数
 * @param {string} [params.searchId=''] - 分页标识
 * @param {number} [params.sortField=1] - 排序方式：1综合、2价格升序、6离我最近
 * @returns {Promise<{list: Array, hasNext: boolean, searchId: string}>}
 */
async function searchMeituanGoods({ searchText = '', longitude = '', latitude = '', pageNo = 1, pageSize = 20, searchId = '', sortField = 1 } = {}) {
  try {
    const query = [
      `searchText=${encodeURIComponent(searchText)}`,
      `longitude=${encodeURIComponent(longitude)}`,
      `latitude=${encodeURIComponent(latitude)}`,
      `pageSize=${pageSize}`,
      `pageNo=${pageNo}`,
      `searchId=${encodeURIComponent(searchId)}`,
      `sortField=${sortField}`,
    ].join('&');

    const url = `${BASE_URL}/api/meituan/goods?${query}`;
    console.log('[API] searchMeituanGoods 请求URL:', url);
    const result = await request(url);
    console.log('[API] searchMeituanGoods 响应:', JSON.stringify(result));

    if (!result || !result.success || !result.data || result.data.code !== 0) {
      console.warn('[API] searchMeituanGoods 返回异常:', result);
      return { list: [], hasNext: false, searchId: '' };
    }

    const d = result.data;
    const rawList = Array.isArray(d.data) ? d.data : [];
    const list = rawList.map(mapMeituanGoods);

    return {
      list,
      hasNext: !!d.hasNext,
      searchId: d.searchId || '',
    };
  } catch (err) {
    console.warn('[API] searchMeituanGoods 失败:', err.message);
    return { list: [], hasNext: false, searchId: '' };
  }
}

module.exports = {
  searchProducts,
  getProductDetail,
  getGoodsList,
  loginByOpenid,
  checkAuth,
  genAuthUrl,
  convertLink,
  getTranUrl,
  detectPlatform,
  getBanners,
  getMeituanReferralLink,
  getMeituanGoodsReferralLink,
  searchMeituanGoods,
  setUserConfig,
  PLATFORM_NAMES,
};
