/**
 * 全局环境配置（统一接口 Host）
 *
 * 环境识别优先级（从高到低）：
 *   1. FORCE_ENV —— 手动强制指定环境（本地调试/临时切换线上时使用）
 *   2. 自动识别 —— 依据 wx.getAccountInfoSync().miniProgram.envVersion
 *        · develop（开发者工具 / 真机调试）→ 本地接口 host
 *        · trial  （体验版）              → 线上接口 host
 *        · release（正式版）              → 线上接口 host
 *
 * 使用方式：
 *   const { BASE_URL } = require('../../utils/config');
 *   wx.request({ url: `${BASE_URL}/api/xxx` })
 *
 * 切换方式：
 *   - 默认无需改动：开发者工具里自动走本地，上传到线上（体验版/正式版）自动走线上
 *   - 需要强制指定时，把 FORCE_ENV 改成 'develop' | 'trial' | 'release' 即可
 */

const ENV = {
  DEVELOP: 'develop',
  TRIAL: 'trial',
  RELEASE: 'release',
};

// 各环境接口 Host（末尾不带 /）
const API_HOSTS = {
  [ENV.DEVELOP]: 'http://localhost:3000',
  [ENV.TRIAL]: 'https://hgh.pangpai-car.com',
  [ENV.RELEASE]: 'https://hgh.pangpai-car.com',
};

// 手动强制指定环境：'' = 自动识别；'develop' | 'trial' | 'release' = 强制走该环境
const FORCE_ENV = 'release';

/**
 * 识别当前运行环境
 * wx.getAccountInfoSync 在部分基础库/场景下可能不可用，兜底为线上 release
 * @returns {'develop'|'trial'|'release'}
 */
function detectEnv() {
  if (FORCE_ENV && API_HOSTS[FORCE_ENV]) {
    return FORCE_ENV;
  }
  try {
    const info = wx.getAccountInfoSync();
    const version = info && info.miniProgram && info.miniProgram.envVersion;
    return API_HOSTS[version] ? version : ENV.RELEASE;
  } catch (err) {
    console.warn('[Config] 环境识别失败，兜底为线上:', err && err.message);
    return ENV.RELEASE;
  }
}

const currentEnv = detectEnv();
const BASE_URL = API_HOSTS[currentEnv];

console.log(`[Config] 当前环境: ${currentEnv}，接口 Host: ${BASE_URL}`);

// ==================== 开发环境请求守卫 ====================
// 作用：给 wx.request 打一层代理，开发环境下打印每条请求的真实 URL；
//      若发现请求没走本地 BASE_URL，打红字告警并输出调用栈，便于定位漏网请求。
// 说明：仅开发环境生效，线上（体验版/正式版）不受影响；图片资源（<image>）不经过此守卫。
const DEV_REQUEST_GUARD = true;

function setupRequestGuard() {
  if (!DEV_REQUEST_GUARD || currentEnv !== ENV.DEVELOP) {
    return;
  }
  if (typeof wx === 'undefined' || !wx.request || wx.__requestGuarded) {
    return;
  }

  const rawRequest = wx.request;
  wx.request = function (options) {
    const opts = options || {};
    const url = opts.url || '';
    const method = (opts.method || 'GET').toUpperCase();

    if (url.indexOf(BASE_URL) === 0) {
      console.log(`[Guard] ${method} ${url}`);
    } else {
      console.warn(`[Guard] 警告：开发环境出现非本地请求 ${method} ${url}`);
      if (typeof console.trace === 'function') {
        console.trace('[Guard] 调用栈');
      }
    }
    return rawRequest.call(wx, opts);
  };
  wx.__requestGuarded = true;

  console.log('[Guard] 请求守卫已启用：开发环境将打印每条 wx.request 的真实 URL');
}

module.exports = {
  ENV,
  API_HOSTS,
  FORCE_ENV,
  BASE_URL,
  currentEnv,
  detectEnv,
  setupRequestGuard,
};
