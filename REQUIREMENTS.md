# 值物APP (huigenghao) 需求文档

> 多平台 CPS 返利小程序 | 版本 v0.14.5  
> 最后更新：2026-10-03

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [页面清单与功能说明](#3-页面清单与功能说明)
4. [API 接口规范](#4-api-接口规范)
5. [数据字典](#5-数据字典)
6. [设计规范](#6-设计规范)
7. [开发路线图](#7-开发路线图)
8. [变更日志](#8-变更日志)

---

## 1. 项目概述

### 1.1 产品定位

值物APP（原惠更好，工程名 huigenghao）是一款集成多家主流电商平台 CPS 联盟的微信小程序，用户可通过本小程序搜索商品、获取优惠券、完成购买后获得返利。

### 1.2 集成的电商平台

| 平台 | 标识 | 品牌色 | CPS 状态 |
|------|------|--------|----------|
| 淘宝/天猫 | `taobao` | `#ff5000` | 待接入 |
| 京东 | `jd` | `#c91623` | 待接入 |
| 拼多多 | `pdd` | `#e02e24` | 已接入（转链 + 商品列表；无商品详情页，首页卡片直接转链跳小程序） |
| 唯品会 | `vip` | `#E4007F` | 已接入（转链 + 商品列表 + 商品详情） |
| 抖音 | `douyin` | `#000000` | 待接入 |

### 1.3 核心用户流程

```
进入首页 → 浏览精选好物/搜索商品/链接转链/点击平台入口 → 按需触发登录 → 浏览商品列表 → 查看详情 → 复制链接/领券 → 跳转购买 → 获得返利
```

> 登录采用按需拦截模式（`ensureLogin`）：打开小程序不会自动弹登录窗，当用户执行搜索、转链、点击平台或商品时，才检测登录态并引导登录。

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | 微信原生小程序 |
| 渲染引擎 | WebView（默认） |
| 组件框架 | Exparser（默认） |
| 基础库 | >= 2.32.3 |
| 页面模式 | Component（非 Page） |
| 样式方案 | WXSS + Style V2 |
| 导航方案 | 全局 `navigationStyle: custom`；首页/详情页自绘顶部，吃喝玩乐 / 我的订单用原生导航栏，搜索页 / 日志页用 `components/navigation-bar` 组件 |
| 数据持久化 | wx.Storage（本地） |

> ⚠️ **历史记录**：项目最初使用 Skyline 渲染引擎 + glass-easel 组件框架，因兼容性问题已于 v0.1.2 切回传统 WebView 模式。

### 2.2 项目目录结构

```
huigenghao/
├── app.js                  # 应用入口（onLaunch：请求守卫 + 静默登录）
├── app.json                # 页面路由、tabBar、跳转小程序白名单、权限声明
├── app.wxss                # 全局样式
├── REQUIREMENTS.md         # 本需求文档
├── pages/
│   ├── index/              # 首页（tab1：搜索入口 + 链接转链 + 活动坑位 + 精选好物三 tab）
│   ├── life/               # 吃喝玩乐（tab2：美团活动 banner + 商品搜索）
│   ├── orders/             # 我的订单（tab3：唯品会 / 美团订单）
│   ├── search/             # 商品搜索列表页
│   ├── goods/              # 商品详情页（唯品会）
│   ├── meituan-goods/      # 美团团购商品详情页
│   └── logs/               # 启动日志（调试用）
├── components/
│   └── navigation-bar/     # 通用自定义导航栏（仅搜索页 / 日志页使用）
├── images/
│   └── tabbar/             # 底部 tabBar 图标（含 *-active 选中态）
└── utils/
    ├── config.js           # 接口 Host 唯一来源（BASE_URL / FORCE_ENV / 开发环境请求守卫）
    ├── api.js              # API 统一接口层
    └── util.js             # 通用工具函数
```

---

## 3. 页面清单与功能说明

### 3.1 首页 (`pages/index/`)

**状态**：✅ 已完成基础版本

**功能描述**：

- **登录流程**：采用按需拦截模式（`ensureLogin`），打开小程序不自动弹登录窗。用户执行转链、点击活动坑位或商品时触发登录检测（判定条件 `isLogin && userId`），弹窗文案「欢迎使用值物APP，为了能体验完整的服务，请您进行登录」。登录成功后自动重试之前触发的操作
- **顶部布局**：移除独立标题导航栏，页面内容从屏幕最顶开始；搜索框置顶固定（`position: sticky`），头部整块橙色渐变 `#ff4d00 → #ff9402` 背景（含状态栏区域），顶部间距动态读取胶囊按钮上边缘使其与搜索框同高、水平对齐，右侧自动避让胶囊宽度，页面滑动时头部固定不随内容滚动
- 搜索入口：点击置顶搜索框（静态占位文案「搜索全网好物」，非 input placeholder）跳转商品搜索页（`goToSearch`）
- 转链按钮文案「查找专属优惠」（转换中显示「正在转换...」），样式为主色渐变胶囊（`linear-gradient(135deg, #ff4d00, #ff9402)` + 白字）；下方「粘贴购物链接」区块收窄为主色系圆角留白卡片
- **精选好物（唯品好货 / 美团热销 / 多多好货三 tab）**：精选好物区改为三个 tab——「唯品好货」调用 `GET {BASE_URL}/api/indexList?tab=1&uid=xxx&offset=0&pageSize=10`，携带 `offset/nextPageOffset` 触底翻页加载唯品会推荐，双列瀑布流展示（券后价 + 删除线原价），点击卡片跳商品详情页；「美团热销」调用 `GET {BASE_URL}/api/indexList?tab=2&longitude=..&latitude=..`，携带首页模糊定位经纬度加载附近美团热销团购（接口一次返回暂不分页），卡片展示主图/标题/门店·品牌/券后价/原价，点击卡片进入美团团购商品详情页 `/pages/meituan-goods`（转链购买在详情页「前往购买」进行，见 [3.8](#38-美团团购商品详情页-pagesmeituan-goods-)）；第三个 tab「多多好货」调用 `GET {BASE_URL}/api/indexList?tab=3`（一次返回暂不分页，返回结构与 tab=1/2 不同，为顶层数组 `[{ id, goods_name, goods_image_url, market_price, sale_price, platform:'pdd', goods_platform_id, update_time, create_time }]`），双列瀑布流展示（券后价 `sale_price` + 删除线原价 `market_price`），点击卡片不进商品详情，依次校验：未登录先弹手机号登录 → 已登录则调 `GET /api/thirdAuth/checkAuth?uid=xxx&platform=pdd`（`pid` 不下发由后端处理）校验拼多多授权，未授权弹「去授权」提示窗，确认后调 `GET /api/thirdAuth/genAuthUrl?uid=xxx&platform=pdd` 取 `weapp_url`（appId 兜底 `wxa918198f16869201`）跳拼多多小程序授权页；已授权则调 `GET {BASE_URL}/api/tranUrl/genUrlByGoodsId?platform=pdd&goodsId=xxx&uid=xxx`（`goodsId` 取商品 `goods_platform_id`，`pid` 不下发由后端处理），成功后取 `urls.weapp_url`（小程序路径）与 `urls.weapp_app_id`（缺失兜底拼多多 appId `wxa918198f16869201`）跳拼多多小程序；三 tab 数据源为同一聚合接口 `/api/indexList`（Host 统一取自 `utils/config.js` 的 `BASE_URL`，不再硬编码联调地址）；平台筛选参数（`jxCode` / `platform` / `listTopiId`）已下沉到后端按 `tab` 判断，前端不再下发；唯品好货（tab=1）额外携带当前用户 `uid`（取自 `USER_CONFIG.uid`，未登录为空时不下发该参数）；首次进入页面默认加载唯品好货，切换美团热销/多多好货时首次才发起请求；手机号登录成功后会携带新 `uid` 重新拉取一次唯品好货列表
- **链接转换**：支持粘贴拼多多和唯品会商品链接，调 `GET /api/tranUrl` 获取推广链接；结果卡片**当前只展示 `h5_url`（H5 推广链接）**，小程序路径 / App 唤起链接暂不展示（`linkResult` 仍保留字段备用）；输入框占位文案「支持粘贴唯品会/拼多多 商品链接查找优惠」，输入区为压缩高度圆角灰底卡片，右下角「粘贴」按钮加宽（`min-width: 172rpx`）便于点击
- **分享**：支持右上角转发好友 / 分享到朋友圈（`onShareAppMessage` / `onShareTimeline`，标题「精选好物 · 超值返利」）
- **今日最优惠活动**：原「电商购物」五个 icon 入口下线，改为首页一行两个活动坑位（外层不展示区块大标题），每张卡片为「左侧商品大图 + 右侧主标题 / 子标题」横向布局，缺图时显示「商品图占位」色块；数据由 `GET {BASE_URL}/api/banner/indexBannerList` 下发（`attached` 调用 `loadActivityBanners()`），按 `sort` 降序取前 **2** 条，不足 2 条或接口异常时整区隐藏（无内置占位数据）
  - 返回契约：`[{ id, type, title, sub_text, banner_img_url, extra_id, extra_url, sort }]`
  - 点击行为：`extra_url` 非空 → 唯品会活动（校验登录 + 唯品会授权 → `convertLink` 转链 → 跳唯品会小程序）；`extra_url` 为空且 `extra_id` 非空 → 美团活动（`getMeituanReferralLink` 转链 → 跳美团小程序）
  - 跳转小程序 appId：唯品会 `wxe9714e742209d35f`、美团 `wxde8ac0a21135c07d`、拼多多 `wxa918198f16869201`（三者均需登记在 `app.json` 的 `navigateToMiniProgramAppIdList` 中）

**登录流程**：

| 步骤 | 操作 | 接口 | 接口方法 | 本地存储 Key | globalData 字段 |
|------|------|------|------|-------------|-----------------|
| ① | `wx.login` 获取临时 code | - | - | `code` | `code` |
| ② | 用 code 换取 openid | `/api/weixin/openid` | GET | `code`, `openid`, `session_key` | `code`, `openid`, `session_key` |
| ③ | openid 登录获取 token | `/api/user/loginByOpenid` | POST | `token`, `userInfo` | `token`, `userInfo`, `isLogin` |

- 步骤 ③ 失败（新用户未注册）时，`app.js` 仅置 `globalData.needPhoneLogin = true`（不弹窗）；由各页面（首页 / 吃喝玩乐 / 我的订单 / 商品详情）在进入或操作时检测 `needPhoneLogin && !isLogin` 自行弹窗，引导用户通过微信手机号授权完成注册/登录
- 弹窗支持「微信手机号快捷登录」按钮（`open-type="getPhoneNumber"`）和「暂不登录」跳过
- 获取手机号 code 后，先调 `GET /api/weixin/getPhone` 获取真实手机号，再 POST `/api/user/register` 注册

**第三方授权入口**（原「平台入口」五个 icon 区块已于 v0.10.6 下线，现仅以下两处需要授权）：

| 入口 | 平台标识 | 触发时机 | 授权后行为 |
|------|----------|----------|-----------|
| 今日最优惠活动·唯品会坑位 | `vip` | 点击带 `extra_url` 的坑位 | `convertLink` 转链 → 跳唯品会小程序 |
| 精选好物·多多好货卡片 | `pdd` | 点击拼多多商品卡片 | `genUrlByGoodsId` 转链 → 跳拼多多小程序 |

- 授权校验：`GET /api/thirdAuth/checkAuth?uid=xxx&platform=vip|pdd`
- 获取授权链接：`GET /api/thirdAuth/genAuthUrl?uid=xxx&platform=vip|pdd`（pid 不下发，由后端处理）
- 未授权时不直接跳转：先弹统一的授权提示弹窗（标题「授权提醒」，文案「为了能同步你的购物记录，前往购物前需要你进行第三方服务平台授权，以获得更优惠的价格」——弱化营销表述以规避微信审核风险），确认后取 `weapp_url` 跳对应小程序授权页

**统一授权弹窗封装**（v0.14.5，首页与商品详情页一致）：
- 弹窗状态：`showAuthModal` + `authPlatform`（弹窗携带待授权平台，当前支持 `vip` / `pdd`）
- 打开：`openAuthModal(platform)`——platform 由触发场景决定：场景固定平台时传常量（如首页唯品会坑位传 `vip`、多多好货传 `pdd`），或透传上一接口返回的 `needAuthPlatform`（如转链接口 `/api/tranUrl` 的未授权返回）
- 确认「去授权」：`onConfirmAuth()` 按弹窗携带的 `authPlatform` 调 `GET /api/thirdAuth/genAuthUrl?uid=xxx&platform=xxx` 获取 `weapp_url`，跳对应小程序授权页（跳转 appId：返回 `weapp_app_id` 优先，缺失兜底 vip=`wxe9714e742209d35f` / pdd=`wxa918198f16869201`）
- 关闭：`closeAuthModal()`（同时清空 `authPlatform`）

**待优化**：
- [ ] 添加个人中心入口（订单、收益、设置等）

---

### 3.2 吃喝玩乐页 (`pages/life/`)

**状态**：✅ 已完成基础版本（v0.8.6）

**功能描述**：
- 底部第二个 tab，标题「吃喝玩乐」
- 页面顶部为搜索栏：关键词输入 + 一键清空 + 搜索按钮（点击或键盘确认触发）
- 活动 banner 列表常驻显示在搜索栏下方；搜索后商品结果列表展示在 banner 下方，清空搜索词后仅保留 banner
- 进入页面调用 `GET {BASE_URL}/api/banner` 获取活动 banner 列表
- 按 `sort` 降序展示活动卡片：图片（`banner_img_url`）+ 标题（`title`）+ 子标题（`sub_text`）+ 箭头
- 点击卡片：调用 `GET /api/meituan/referral-link-by-act-id?actId={extra_id}&uid={uid}` 获取转链（转链依赖当前登录用户 uid）
- 从响应 `referralLinkMap` 中取 key=4 的小程序路径，调用 `wx.navigateToMiniProgram` 跳转美团外卖小程序（appId: `wxde8ac0a21135c07d`）
- 搜索商品：调用 `GET /api/meituan/goods`，返回商品列表，卡片展示图片（`headUrl`）、标题（`name`）、品牌、门店、销量、售价（`sellPrice`）、原价（`originalPrice`）、佣金（`commissionInfo.commission`）
- 点击商品卡片：进入美团团购商品详情页 `/pages/meituan-goods?sign=xxx`（转链购买在详情页「前往购买」进行，见 [3.8](#38-美团团购商品详情页-pagesmeituan-goods-)）
- 搜索结果上方提供排序栏：综合排序（`sortField=1`）、价格升序（`sortField=2`）、离我最近（`sortField=6`），切换排序后重新搜索第一页
- 进入页面时即调用 `wx.getFuzzyLocation`（模糊定位，type=gcj02）获取定位并缓存到 data，控制台打印经纬度；搜索第一页、翻页、切换排序均携带缓存的 `longitude`/`latitude` 传给接口；「离我最近」排序时若定位尚未就绪则重新获取一次，定位失败时提示并继续按空经纬度请求
- 商品列表分页：上拉触底加载下一页，翻页回传上一页返回的 `searchId`，`hasNext=false` 时停止加载
- **登录拦截**：进入页面即检查登录态，`needPhoneLogin && !isLogin` 时弹出手机号快捷登录弹窗（标题「欢迎使用值物APP」，描述「登录后即可获取推广链接，请先登录」，支持「暂不登录」跳过）；登录成功同步真实 uid 并自动重试此前被拦截的操作

**接口**（Base URL 统一取 `utils/config.js` 的 `BASE_URL`：开发环境走本地 `http://localhost:3000`，线上走 `https://hgh.pangpai-car.com`）：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/banner` | GET | 获取活动 banner 列表 |
| `/api/meituan/referral-link-by-act-id?actId=xxx&uid=xxx` | GET | 获取活动转链（带当前登录 uid），`referralLinkMap` 中 key=4 为小程序路径 |
| `/api/meituan/referral-link-by-goods-id?productViewSign=xxx` | GET | 获取商品推广链接（点击搜索商品卡片时调用），`referralLinkMap` 中 key=4 为小程序路径 |
| `/api/meituan/goods?searchText=xxx&longitude=&latitude=&pageSize=20&pageNo=1&searchId=&sortField=` | GET | 搜索美团吃喝玩乐商品（Host 取 `BASE_URL`）；参数 `sortField`：1=综合排序、2=价格升序、6=离我最近；返回 `{ success, data: { code, data: [...], hasNext, searchId } }`，`data[].couponPackDetail` 为商品信息、`brandInfo` 为品牌、`commissionInfo` 为佣金、`deliverablePoiInfo` 为门店/距离 |

**前置要求**：
- `app.json` 已配置 `navigateToMiniProgramAppIdList: ["wxde8ac0a21135c07d", "wxe9714e742209d35f", "wxa918198f16869201"]`（美团 / 唯品会 / 拼多多）
- `hgh.pangpai-car.com` 已加入小程序后台 request 合法域名

### 3.3 商品搜索列表页 (`pages/search/`)

**状态**：✅ 已完成基础版本（已接真实接口 `/api/search`，仅在请求异常 / 空数据时回落 Mock）

**接口**：`GET {BASE_URL}/api/search?keyword=xxx&uid=xxx&pid=xxx&page=n`（`utils/api.js` `searchProducts`，`uid`/`pid` 取自 `USER_CONFIG`）；页面通过 `onLoad` 接收 `keyword` / `platform` 参数（分享进入时自动搜索）

**分享**：`onShareAppMessage` 携带 `keyword + platform`，`onShareTimeline` 同参

#### 3.3.1 搜索栏

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 关键词输入 | 圆角搜索框，支持输入任意文本 | ✅ |
| 一键清空 | 输入框右侧 × 按钮清空内容 | ✅ |
| 搜索触发 | 点击「搜索」按钮或键盘确认触发，**输入时不自动搜索** | ✅ |
| 搜索防抖 | ~~输入变化后 400ms 防抖延迟~~ → 已改为手动搜索 | ❌ 已废弃 |
| 聚焦态 | 搜索框白底 + 主色描边 + 光晕，聚焦时边框/光晕高亮为主橙色 `#ff5000`；「搜索」按钮为白底黑字黑框胶囊 | ✅ |

#### 3.3.2 搜索历史

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 自动记录 | 搜索触发后自动保存关键词（去重） | ✅ |
| 历史展示 | **进入页面即展示**，输入时自动隐藏，清空后恢复 | ✅ |
| 历史点击 | 点击历史词快速搜索 | ✅ |
| 逐条删除 | 每个历史标签可单独删除 | ✅ |
| 清空全部 | 一键清空所有搜索历史 | ✅ |
| 存储上限 | 最多保留 10 条 | ✅ |
| 持久化 | 基于 wx.Storage 本地存储 | ✅ |

#### 3.3.3 平台筛选 Tab

| 功能点 | 说明 | 状态 |
|--------|------|------|
| Tab 切换 | 全部（默认）/ 唯品会 / 淘宝 / 京东 / 拼多多 / 抖音 | ✅ |
| 横向滚动 | 支持左右滑动查看所有平台 | ✅ |
| 选中态 | 品牌色下划线 + 文字加粗 | ✅ |
| 自动搜索 | 切换平台后以当前关键词自动重新搜索（重置为第 1 页） | ✅ |

#### 3.3.4 商品卡片列表

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 双列网格 | 每行 2 个卡片，间距均匀 | ✅ |
| 商品图片 | 主图展示，宽高比 1:1，懒加载 | ✅ |
| 平台标签 | 左上角品牌色标签，标出所属平台 | ✅ |
| 商品标题 | 最多显示 2 行，超出省略号 | ✅ |
| 券后价 | 大号主色（`#ff5000`）字体突出显示 | ✅ |
| 原价 | 灰色删除线字号较小 | ✅ |
| 返利金额 | 已隐藏（商品卡片底部不再展示「返¥XX.XX」标签） | ✅ |
| 销量 | 已隐藏（卡片不再显示「已售xx」） | ✅ |
| 点击跳转 | `onProductTap` 已实现：跳转 `/pages/goods/goods?id=xxx` | ✅ |

#### 3.3.5 下拉刷新 & 上拉加载

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 下拉刷新 | refresher-enabled，重置为第 1 页重新搜索 | ✅ |
| 上拉加载 | 触底加载下一页，pageSize = 20 | ✅ |
| 加载完毕 | hasMore = false 时显示「已经到底了」 | ✅ |

#### 3.3.6 状态视图

| 状态 | 展示内容 | 状态 |
|------|----------|------|
| 初始状态 | 🔍 图标 + 「输入关键词搜索全网好物」 | ✅ |
| 搜索无结果 | 📦 图标 + 「暂无相关商品，试试其他关键词吧」 | ✅ |

---

### 3.4 商品详情页 (`pages/goods/`)

**状态**：✅ 基础版本完成（仅唯品会商品；拼多多商品不走详情页，直接在首页转链跳小程序）

**功能描述**：
- **顶部布局**：去除顶部导航栏，商品主图从屏幕最顶展示；左上角悬浮半透明圆形返回按钮（SVG 箭头图标），位置与右上角胶囊垂直居中对齐（`initNavBackStyle` 读取胶囊矩形动态计算 top），点击返回上一页（失败时回首页）
- **主图轮播**：`images` 多图时启用轮播（圆点指示、自动播放、循环），单图降级为普通大图；点击图片调用 `wx.previewImage` 全屏预览、支持左右切换
- **价格**：券后价大号主色（`#ff5000`）+ 原价删除线；价格计算方式文案 `priceDesc`（如「¥167-超V折扣 ¥3」）以「-」拆为两段展示于浅橙底胶囊内，后半段高亮为强调色
- **详情长图**：`detailImages` 按 `widthFix` 顺序拼接展示（懒加载），点击可全屏预览切换
- 返利信息（金额 + 比例）、完整标题、主色系胶囊标签、元信息展示
- 底部栏：返利金额 + 「前往购买」白底黑字黑框按钮，点击后先校验登录与唯品会授权，再调按商品 ID 转链接口获取 `urls.weapp_url` 跳转唯品会小程序
- 登录成功（手机号快捷登录）后同步调用 `setUserConfig({ uid })`
- 分享：`onShareAppMessage` 携带 `id`（标题取商品名），`onShareTimeline` 携带 `query=id=xxx`

**API**：`GET {BASE_URL}/api/goods/getDetail?goodsId=xxx&pid=xxx&uid=xxx&platform=vip`
- 参数取值：`pid` / `uid` 取自 `USER_CONFIG`，`platform` 默认 `vip`（原先的 `chanTag` / `openid` 参数已不再使用）
- 适配函数：`adaptGoodsDetail` 适配真实接口新结构 `{ result: true, data: { goodsId, goodsName, images, detailImages, prices, commission, tags, url } }` → 内部统一格式
- 按商品 ID 转链：`GET /api/tranUrl/genUrlByGoodsId?platform=vip&goodsId=xxx&uid=xxx&pid=xxx`，返回 `{ result: true, urls: { weapp_url } }`；同一接口也用于首页多多好货（`platform=pdd`，不下发 `pid`，返回多带 `weapp_app_id`，详见 3.1）
- Mock 兜底：`mockGoodsDetail`

---

### 3.5 个人中心 (`pages/mine/`)

**状态**：🔜 待开发

**计划功能**：
- [ ] 用户头像/昵称展示
- [ ] 累计返利金额
- [ ] 待入账/已到账收益
- [ ] 订单列表（待返利/已返利）
- [ ] 提现入口
- [ ] 设置（账号安全、关于等）

---

### 3.6 我的订单 (`pages/orders/`)

**状态**：✅ 已完成基础版本（v0.9.0；v0.10.1 新增平台 Tab）

**功能描述**：
- 底部第三个 tab，标题「我的订单」，图标为订单/收据线性风格（`images/tabbar/order.png` / `order-active.png`）
- 进入页面先校验登录态：未登录（`needPhoneLogin && !isLogin` 或无 uid）→ 弹出手机号快捷登录弹窗；已登录 → 自动加载订单
- **平台 Tab**：订单列表顶部提供「唯品会 / 美团」两个平台 Tab（选中态为平台色下划线 + 文字加粗），仅支持唯品会（`vip`）与美团（`meituan`）两类订单，默认选中唯品会；切换 Tab 即按新平台重新加载（重置为第 1 页），空状态文案随平台展示「暂无唯品会订单 / 暂无美团订单」
- 订单列表：调用 `GET {BASE_URL}/api/order/getList`，入参 `uid`（当前用户 uid）、`page`（翻页查询，从 1 开始）与 `platform`（平台标识：`vip`=唯品会、`meituan`=美团）
- 订单卡片渲染：商品图（`goods_img_url`）、商品名（`goods_name`）、平台名（`platform`，卡片内显示中文如「唯品会」）、订单号（`order_sn`）、订单状态（`status`，0=已失效/1=待结算/2=已结算）、实付金额（`order_amount`）、下单时间（`create_time`）；返利信息（`commission`）已隐藏，卡片尾部仅展示「实付」金额并靠右对齐
- 下单时间格式化为 `2026/8/20 13:22:23`（月/日不补零，时分秒补零）
- 上拉触底加载下一页（`totalPages` 判断是否还有更多），空列表展示空状态 + 刷新按钮
- **下拉刷新**：支持页面下拉刷新（`enablePullDownRefresh`），刷新期间保持当前列表可见不闪加载页，静默重新拉取当前平台第 1 页并整页替换；已有列表加载/上拉加载进行中时忽略下拉
- 登录成功后自动重新加载订单列表

**接口**（Base URL 统一取 `utils/config.js` 的 `BASE_URL`：开发环境走本地 `http://localhost:3000`，线上走 `https://hgh.pangpai-car.com`）：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/order/getList?uid=xxx&page=1&platform=vip` | GET | 获取当前用户指定平台订单列表，`platform` 取值：`vip`=唯品会、`meituan`=美团；返回 `{ list, page, pageSize, total, totalPages }`，`list[].create_time` 为毫秒时间戳 |

---

### 3.7 启动日志页 (`pages/logs/`)

**状态**：✅ 已完成（示例/调试页面）

**功能描述**：展示小程序历史启动时间记录，用于开发调试。后续可移除或改造。

---

### 3.8 美团团购商品详情页 (`pages/meituan-goods/`)

**状态**：✅ 已完成基础版本（v0.14.0；与唯品会商品详情页 `pages/goods` 相互独立）

**功能描述**：
- 首页「美团热销」tab 卡片与吃喝玩乐页搜索结果卡片点击后均 `wx.navigateTo` 进入本页（路由参数 `sign` = 商品 `productViewSign`），转链购买动作从列表页下沉到详情页「前往购买」按钮
- 详情加载：`GET {BASE_URL}/api/meituan/goodsDetail?productViewSignList=xxx`（`utils/api.js` `getMeituanGoodsDetail`），返回 `{ success, data: { code: 0, data: [商品...] } }` 取首个商品，内部 `mapMeituanGoodsDetail` 将 `couponPackDetail / brandInfo / commissionInfo / deliverablePoiInfo / availablePoiInfo / couponValidTimeInfo` 扁平化为展示字段
- 页面结构：商品主图（点击 `wx.previewImage` 预览，浅橙渐变底价格区展示券后价/删除线原价/价格力标签/预估返利）→ 标题+销量 → 门店信息卡片（logo/店名/距离/可用门店数）→ 购买须知（有效期/品牌/使用方式，有效期文案由 `couponValidTimeInfo` 格式化：`couponValidTimeType=1` 为「购买后N天内有效」，否则按起止时间展示）→ 底部「前往购买」按钮
- 顶部无导航栏，主图置顶 + 左上角悬浮半透明返回按钮（与胶囊垂直居中对齐，`initNavBackStyle`）
- **前往购买**：先校验登录（未登录弹手机号快捷登录弹窗，成功后自动重试购买动作），再实时调 `GET /api/meituan/referral-link-by-goods-id?productViewSign=xxx` 转链，取 `referralLinkMap` key=4 小程序路径跳美团小程序（appId `wxde8ac0a21135c07d`）
- 分享：`onShareAppMessage` / `onShareTimeline` 携带 `sign`，好友点开直达本商品详情

**接口**：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/meituan/goodsDetail?productViewSignList=xxx` | GET | 美团团购商品详情（券包/品牌/佣金/门店/有效期） |

---

## 4. API 接口规范

### 4.1 通用约定

- **基础路径（统一由 `utils/config.js` 按环境下发）**：
  - 开发环境（开发者工具 / 真机调试，`envVersion=develop`）：`http://localhost:3000`
  - 线上环境（体验版 `trial` / 正式版 `release`）：`https://hgh.pangpai-car.com`
  - 运行时自动识别 `wx.getAccountInfoSync().miniProgram.envVersion` 选择 Host；如需临时强制，可在 `utils/config.js` 把 `FORCE_ENV` 改为 `'develop' | 'trial' | 'release'`（留空 `''` 即自动）
  - 全项目所有请求（`app.js` openid、各页面 `getPhone`/`register`、`utils/api.js` 全部接口）统一 `require` 该模块取 `BASE_URL` 拼接，**不得再写死域名**
- **开发环境请求守卫**：`utils/config.js` 导出 `setupRequestGuard()`，由 `app.js` onLaunch 调用，仅在 `develop` 环境给 `wx.request` 打代理——每条请求打印真实 URL（`[Guard] GET http://localhost:3000/...`），若 host 不是本地 `BASE_URL` 则红字告警并输出调用栈，用于快速定位漏网请求；线上环境不生效，图片资源（`<image>`）不经过该守卫（后端下发的图片绝对地址仍走线上，属预期）
- 请求方式：GET（Query String 传参）为主，少数接口用 POST（JSON body）
- 认证方式：通过 URL Query 参数传递 `uid` / `token` / `openid`
- 兜底处理：`wx.request` 返回的 `res.data` 若为字符串，自动尝试 `JSON.parse` 解析（防止后端 `Content-Type` 不规范导致解析失败）
- **console 日志规范**：打印接口响应等对象时，先输出一行纯文本说明（如 `console.log('[API] xxx 响应:')`），下一行再单独打印数据对象（`console.log(result)`）；不得把对象与前缀文本拼在一条日志，也不得 `JSON.stringify` 后打印，保证 console 中对象可折叠、结构化查看

### 4.2 商品搜索接口

**接口路径**：`GET {BASE_URL}/api/search`

**请求参数**（Query）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| uid | string | 是 | 用户标识 |
| pid | string | 是 | 项目标识 |
| page | number | 是 | 页码，从 1 开始 |

**真实响应结构**：

```json
{
  "success": true,
  "data": {
    "page": "1",
    "total": 10,
    "items": [
      {
        "id": "6921874324909840973",
        "title": "商品标题",
        "price": "282",
        "imageUrl": "https://...",
        "commission": "7",
        "platform": "vip"
      }
    ]
  }
}
```

**内部统一格式**（api.js 适配后，页面层使用的格式）：

| 字段 | 来源 | 说明 |
|------|------|------|
| id | items[].id | 商品 ID |
| title | items[].title | 商品标题 |
| image | items[].imageUrl | 商品主图 |
| price | parseFloat(items[].price) | 券后价 |
| rebate | parseFloat(items[].commission) | 返利金额 |
| platform | items[].platform | 来源平台 |
| originalPrice | price + rebate | 估算原价 |
| hasMore | list.length >= pageSize | 是否还有更多 |

**返回 data**：

```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 83,
    "hasMore": true
  }
}
```

**单条商品结构**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 商品唯一 ID |
| title | string | 商品标题 |
| image | string | 主图 CDN 地址 |
| price | number | 券后价（单位：元） |
| originalPrice | number | 原价（单位：元） |
| rebate | number | 返利金额（单位：元） |
| platform | string | 来源平台：`taobao` / `jd` / `pdd` / `vip` / `douyin` |
| sales | number | 历史销量 |
| couponAmount | number | 优惠券面额（单位：元） |

**Mock 说明**：`utils/api.js` 的 `searchProducts` 已对接真实接口（`MOCK_ONLY = false`）；仅当响应缺少 `success` 字段或请求异常时，才回落 `mockSearch` 兜底（含 300-800ms 模拟延迟），页面层无感知。

### 4.3 用户登录接口 ✅

**完整登录流程**（`app.js` onLaunch 自动执行）：

```
setupRequestGuard() → wx.login → 保存 code → GET /api/weixin/openid → 保存 openid, session_key
                    → POST /api/user/loginByOpenid
                           → 成功? → 保存 token, userId, userInfo → 完成
                           → 失败? → 仅置 globalData.needPhoneLogin = true（不弹窗）
                                   → 各页面进入 / 操作时检测 needPhoneLogin && !isLogin 自行弹手机号登录窗
                                   → 用户授权手机号(getPhoneNumber)
                                   → GET /api/weixin/getPhone → 获取 purePhoneNumber
                                   → POST /api/user/register → 保存 token, userId, userInfo → 完成
```

**接口详情**：

| 步骤 | 接口 | 方法 | 参数 | 响应格式 |
|------|------|------|------|----------|
| ① | `/api/weixin/openid` | GET | `?code=xxx` | `{ openid, session_key }` |
| ② | `/api/user/loginByOpenid` | POST | `{ openid }` | `{ result: true, data: { user: { id, phone, nickname, avatar }, token } }` |
| ③ | `/api/weixin/getPhone` | GET | `?code=xxx` | `{ errcode: 0, phone_info: { purePhoneNumber } }` |
| ④ | `/api/user/register` | POST | `{ openid, phone }` | `{ result: true, data: { user: { id, phone, nickname, avatar }, token } }` |

> 步骤 ② 失败（新用户未注册）时，前端弹窗引导用户授权手机号，依次走步骤 ③④ 完成注册。
> 成功判断兼容 `result` / `success` / `code === 0` 三种格式。
> userId 提取兼容 `data.user.id` / `data.userId` / `data.id`。

**登录态存储清单**：

| 存储 Key | 来源 | 存储位置 |
|----------|------|----------|
| `code` | wx.login 返回值 | Storage + globalData.code |
| `openid` | /api/weixin/openid 返回值 | Storage + globalData.openid + api.setUserConfig |
| `session_key` | /api/weixin/openid 返回值 | Storage + globalData.session_key |
| `token` | loginByOpenid / register 返回值 | Storage + globalData.token |
| `userId` | loginByOpenid / register 返回 `data.user.id` | Storage + globalData.userId |
| `userInfo` | loginByOpenid / register 返回 `data.user` | Storage + globalData.userInfo |

> 每步获取的数据都同时写入 `wx.Storage`（持久化）和 `globalData`（内存），确保数据不丢失。

### 4.4 第三方平台授权接口 ✅

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/thirdAuth/checkAuth` | GET | 校验是否已授权，参数 `?uid=xxx&platform=xxx`（pid 不下发，由后端处理），返回 `{ isAuth: true/false }` |
| `/api/thirdAuth/genAuthUrl` | GET | 生成授权链接，参数 `?uid=xxx&platform=xxx`（pid 不下发，由后端处理），返回 `{ authUrl: { weapp_url } }` |

**跳转流程**：
```
点击唯品会/拼多多 icon → checkAuth → isAuth=true? → navigateToMiniProgram(购物首页)
                                      → isAuth=false? → genAuthUrl → navigateToMiniProgram(授权页)
```

### 4.5 后续待定接口

| 接口 | 路径 | 说明 | 状态 |
|------|------|------|------|
| 用户信息 | `GET /api/user/info` | 获取用户信息和返利汇总 | 🔜 |
| 订单列表 | `GET /api/order/getList?uid=xxx&page=1&platform=vip` | 按平台查询订单与返利记录，`platform` 支持 `vip`=唯品会、`meituan`=美团（已实现，见 [3.6](#36-我的订单-pagesorders-)） | ✅ |
| 提现 | `POST /api/withdraw` | 申请提现 | 🔜 |

---

### 4.6 链接转换接口 ✅

> 已实现，支持拼多多和唯品会链接。

**接口路径**：`GET {BASE_URL}/api/tranUrl`

**请求参数**（Query）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uid | string | 是 | 当前用户 uid |
| pid | string | 是 | 推广位 ID，固定 `43384525_317172887` |
| source_url | string | 是 | 用户粘贴的原始商品链接（需 URL Encode） |

> 后端自动识别链接所属平台，无需传入 `platform` 参数。

**请求示例**：
```
GET /api/tranUrl?uid=xxx&pid=43384525_317172887&source_url=https%3A%2F%2Fp.pinduoduo.com%2FbpAqG3HP
```

**响应结构**：

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 状态码：200=成功，-1=转换失败，-2=平台不支持 |
| urls.h5_url | string | H5 推广链接 |
| urls.weapp_url | string | 小程序跳转路径 |
| urls.weapp_short_link | string | 小程序短链接（可能为空） |
| urls.deeplink_url | string | App 唤起链接 |

**成功响应示例**：
```json
{
    "code": 200,
    "urls": {
        "h5_url": "https://t.vip.com/r5qot2",
        "weapp_url": "pages/productDetail/productDetail?brandId=1711324120&goodsId=6919236010500463512&tra_from=adp%3A...",
        "weapp_short_link": "",
        "deeplink_url": "vipshop://showGoodsDetail?pid=6919236010500463512&..."
    }
}
```

**转换失败**：
```json
{
    "code": -1,
    "urls": {
        "h5_url": "",
        "weapp_url": "",
        "weapp_short_link": "",
        "deeplink_url": ""
    }
}
```

**不支持该平台**（如京东、淘宝）：
```json
{
    "code": -2,
    "urls": { "h5_url": "", "weapp_url": "", "weapp_short_link": "", "deeplink_url": "" }
}
```

**用户未授权该链接对应平台**（v0.14.4 新增）：接口会判断当前用户粘贴链接对应的平台是否已完成第三方授权，未授权时返回：
```json
{
    "result": true,
    "code": -1,
    "needAuthPlatform": "vip",
    "message": "用户未授权"
}
```
- `needAuthPlatform`：需要授权的平台标识（`vip`=唯品会 / `pdd`=拼多多），前端据此弹出对应平台的授权提示窗（同 4.4 的「授权提醒」弹窗）引导用户去授权，授权完成后再重新转链

**前端处理逻辑**（`utils/api.js` `convertLink()`）：
1. 校验 `url` 和 `uid` 是否有效
2. 发起 GET 请求（不传 `platform`，后端自动识别）
3. 判断 `code === 200` 且 `urls.h5_url` 存在 → 成功
4. `code === -2` → 提示「暂不支持该平台的链接」
5. 返回 `needAuthPlatform`（用户未授权该平台）→ 透传 `{ code: -1, needAuthPlatform, message }` 给页面层，页面按平台弹授权提示窗（`openAuthModal`）引导用户去授权（首页 `onFindCoupon` 转链、`openVipActivity` 坑位兜底均已接入）
6. 其他情况 → 提示转换失败

**UI 交互**：
- 首页「粘贴购物链接」输入框 → 点击「查找专属优惠」→ 按钮显示「正在转换...」loading 态
- 转换成功后展示结果卡片：原始链接 / H5 推广链接（**当前仅展示 `h5_url`**；小程序路径与 App 唤起链接暂不展示，数据仍保留在 `linkResult` 中备用）
- 卡片底部仅保留「一键复制推广链接」按钮（复制 `h5_url`），不再提供单独的字段复制按钮
- 点击 ✕ 可清除结果回到输入状态

---

### 4.7 商品详情接口 ✅

**接口路径**：`GET {BASE_URL}/api/goods/getDetail`

**请求参数**（Query）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| goodsId | string | 是 | 商品唯一 ID |
| pid | string | 是 | 推广位 ID（取 `USER_CONFIG.pid`） |
| uid | string | 是 | 当前用户 uid（取 `USER_CONFIG.uid`） |
| platform | string | 是 | 平台标识，当前固定 `vip` |

**响应结构**（内部适配后）：

| 字段 | 类型 | 来源 |
|------|------|------|
| id | string | data.goodsId |
| title | string | data.goodsName |
| image / images | string / string[] | data.images（首张为主图，多图用于轮播） |
| detailImages | string[] | data.detailImages（详情长图列表） |
| price | number | data.prices.salePrice |
| originalPrice | number | data.prices.marketPrice |
| priceDesc | string | data.prices.priceDesc（价格计算方式文案） |
| rebate | number | data.commission.amount |
| rebateRate | number | data.commission.rate |
| discount | number | 内部按 salePrice / marketPrice 计算 |
| tags | string[] | data.tags |
| platform | string | data.platform |
| destUrl | string | data.url（用于按商品 ID 转链） |

---

## 5. 数据字典

### 5.1 商品对象 (Product)

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| id | string | 是 | 商品唯一标识 | `"tb_20240601_001"` |
| title | string | 是 | 商品标题 | `"夏季新款连衣裙女..."` |
| image | string | 是 | 商品主图 URL | `"https://img.example.com/..."` |
| price | number | 是 | 券后价（元） | `79.90` |
| originalPrice | number | 是 | 原始标价（元） | `199.00` |
| rebate | number | 是 | 预计返利金额（元） | `12.35` |
| platform | string | 是 | 平台标识 | `"taobao"` |
| sales | number | 否 | 累计销量 | `15800` |
| couponAmount | number | 否 | 优惠券面额（元） | `50.00` |

### 5.2 平台映射

| 标识 | 名称 | 品牌色 | 说明 |
|------|------|--------|------|
| `all` | 全部 | - | 不限制平台 |
| `taobao` | 淘宝 | `#ff5000` | 含天猫 |
| `jd` | 京东 | `#c91623` | - |
| `pdd` | 拼多多 | `#e02e24` | - |
| `vip` | 唯品会 | `#E4007F` | - |
| `douyin` | 抖音 | `#000000` | 抖音电商 |

> 注：`all`（全部）仅用于搜索页筛选 Tab；`utils/api.js` 的 `PLATFORM_NAMES` 只包含 `vip` / `taobao` / `jd` / `pdd` / `douyin` 五个真实平台。

### 5.3 登录态存储

| Key | 类型 | 说明 |
|-----|------|------|
| `code` | string | wx.login 返回的临时 code |
| `openid` | string | 用户的微信 openid |
| `session_key` | string | 微信会话密钥 |
| `token` | string | 登录凭证 JWT token |
| `userId` | number | 用户 ID（来自 `data.user.id`） |
| `userInfo` | object | 用户信息 `{ id, phone, nickname, avatar }` |

### 5.4 搜索历史存储

- **Key**：`search_history`
- **存储**：`wx.setStorageSync` / `wx.getStorageSync`
- **结构**：`string[]`，按时间倒序排列，最多 10 条

---

## 6. 设计规范

### 6.1 色彩系统

| 颜色 | 色值 | 用途 |
|------|------|------|
| UI 主色 | `#ff5000` | 头部渐变底色、搜索框聚焦态、价格与强调文字（淘宝橙色系） |
| UI 渐变 | `#ff4d00 → #ff9402` | 头部背景、tab、tab 选中胶囊、主按钮渐变（首页「查找专属优惠」转链按钮） |
| 主文字 | `#333333` | 标题、主要信息 |
| 次文字 | `#999999` | 辅助说明、历史标签 |
| 辅助文字 | `#bbbbbb` | 占位符、弱化信息 |
| 页面背景 | `#f5f5f5` | 整体背景 |
| 卡片背景 | `#ffffff` | 商品卡片、面板（统一 20rpx 圆角、轻阴影） |
| 搜索框 | 纯白胶囊，无描边，柔和橙阴影 | 输入框默认态；聚焦态边框高亮 `#ff5000` |
| 主操作按钮 | 主色渐变 `linear-gradient(135deg, #ff4d00, #ff9402)` + 白字 + 橙色投影 | 全站主 CTA 统一（转链、复制推广链接、前往购买、手机号快捷登录、登录弹窗确认），圆角胶囊（v0.14.0 起统一，原白底黑框样式废弃） |
| 次要按钮 | 白底 `#fff` / 主色描边（如首页「粘贴」按钮） | 辅助操作，圆角胶囊 |
| 卡片浮层 | 白卡 + 橙色柔光阴影（如 `0 8rpx 30rpx rgba(255,77,0,.12)`） | 悬浮于头部渐变延伸区之上的卡片（首页转链区） |
| 按压反馈 | `hover-class` 轻微缩放（0.97~0.98）+ 透明度 | 商品卡 / 活动坑位 / 粘贴按钮 |
| 弹窗 | 白底 32rpx 圆角 + `dialogPopIn` 缩放弹入动画 | 登录 / 授权确认弹窗全站统一 |

### 6.2 字体规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| H1 | 36rpx | bold | 页面大标题 |
| H2 | 32rpx | bold | 区域标题 |
| H3 | 28rpx | medium | 卡片标题 |
| Body | 28rpx | normal | 正文 |
| Caption | 24rpx | normal | 辅助说明 |
| Price | 36rpx | bold | 价格数字 |
| Small | 22rpx | normal | 原价删除线、销量 |

### 6.3 圆角规范

| 元素 | 圆角 |
|------|------|
| 搜索框 | 40rpx |
| 商品卡片 | 16rpx |
| 按钮 | 16rpx |
| 标签（Tag） | 28rpx |

### 6.4 间距规范

| 层级 | 数值 |
|------|------|
| 页面内边距 | 24rpx |
| 卡片间距 | 16rpx |
| 组件内边距 | 20-24rpx |

---

## 7. 开发路线图

### Phase 1：核心浏览链路 ✅

| 任务 | 说明 | 状态 |
|------|------|------|
| 项目基础结构 | app.json / 全局样式 / navigation-bar | ✅ |
| API 服务层 | utils/api.js Mock 层搭建 | ✅ |
| 商品搜索列表页 | 搜索框 + 历史 + 平台 Tab + 商品列表 + 分页 | ✅ |
| 首页搜索入口 | index 页跳转按钮 | ✅ |

### Phase 2：商品详情与转化 ✅

| 任务 | 说明 | 状态 |
|------|------|------|
| 商品详情页 | 大图、价格、返利、详情图文 | ✅ |
| 领券 / 转链 | 生成推广链接，支持拼多多+唯品会 | ✅ |
| 平台跳转 | 唤起对应电商小程序（拼多多/唯品会） | ✅ |
| 首页精选好物 | 三 tab 双列瀑布流（唯品好货 / 美团热销 / 多多好货） | ✅ |
| API 真实对接 | 切换 Mock 为真实接口 | ✅ |

### Phase 3：用户与返利体系 🔜

| 任务 | 说明 | 状态 |
|------|------|------|
| 微信登录 | 静默登录 + Token 管理 | ✅ |
| 个人中心 | 用户信息、收益展示 | 🔜 |
| 订单列表 | 订单与返利状态查询（底部 tab「我的订单」） | ✅ |
| 提现功能 | 提现申请与记录 | 🔜 |

### Phase 4：体验增强 🔜

| 任务 | 说明 | 状态 |
|------|------|------|
| 首页重新设计 | 热门推荐、Banner、分类入口（头部重构 + 活动坑位 + 精选好物三 tab 已完成，分类入口未做） | ✅ 部分完成 |
| 收藏功能 | 商品收藏 | 🔜 |
| 分享功能 | 商品分享卡片 | 🔜 |
| 异常监控 | 接口异常、错误边界处理 | 🔜 |

---

## 8. 变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-10-03 | v0.14.5 | **第三方授权弹窗统一封装**：首页与商品详情页的 vip/pdd 两套授权弹窗及处理方法（`showVipAuthModal`/`showPddAuthModal`、`onConfirmVipAuth`/`onConfirmPddAuth` 等）合并为一套通用弹窗 `showAuthModal` + `authPlatform`——`openAuthModal(platform)` 打开弹窗并携带平台（场景写死或透传上一接口的 `needAuthPlatform`，支持 vip/pdd），「去授权」统一走 `onConfirmAuth()` 按携带平台调 `/api/thirdAuth/genAuthUrl` 获取 `weapp_url` 跳对应小程序授权页（appId 返回 `weapp_app_id` 优先，兜底 vip/pdd 固定值），`closeAuthModal()` 关闭并清空平台；覆盖场景：首页唯品会坑位、首页多多好货、转链未授权（needAuthPlatform 透传）、商品详情页前往购买 | [3.1](#31-首页-pagesindex-)、[3.4](#34-商品详情页-pagesgoods-)、[4.4](#44-第三方平台授权接口-) |
| 2026-10-03 | v0.14.4 | **「查找专属优惠」转链接入未授权拦截**：`/api/tranUrl` 新增用户授权判定，未授权时返回 `{ result: true, code: -1, needAuthPlatform: 'vip'|'pdd', message: '用户未授权' }`；`utils/api.js` `convertLink()` 识别 `needAuthPlatform` 并透传给页面层；首页新增 `openAuthModal(platform)` 按平台弹授权提示窗（vip→唯品会 / pdd→拼多多，文案同 v0.14.2 的「授权提醒」），`onFindCoupon`（转链按钮）与 `openVipActivity`（唯品会坑位，兜底 checkAuth 与后端判定不一致场景）均接入该处理，引导用户去授权后可重新转链 | [3.1](#31-首页-pagesindex-)、[4.6](#46-链接转换接口-) |
| 2026-10-03 | v0.14.3 | **console 接口日志统一为结构化输出**：全项目（`utils/api.js` 12 处、`app.js` 2 处）接口响应日志改为「先一行纯文本说明、下一行单独打印对象」两段式，移除所有 `JSON.stringify` 打印，保证开发者工具 console 中对象可折叠树形查看；并在 4.1 新增 console 日志规范作为后续开发约定 | [4.1](#41-通用约定) |
| 2026-10-03 | v0.14.2 | **第三方授权弹窗文案调整（规避审核过度营销风险）**：三处第三方授权提示弹窗（首页唯品会坑位 / 首页多多好货卡片 / 唯品会商品详情页「前往购买」）标题统一改为「授权提醒」，描述统一改为「为了能同步你的购物记录，前往购物前需要你进行第三方服务平台授权，以获得更优惠的价格」（原「前往唯品会/拼多多授权」+「获取专属推广链接」表述下线） | [3.1](#31-首页-pagesindex-)、[3.4](#34-商品详情页-pagesgoods-)、[4.4](#44-第三方平台授权接口-) |
| 2026-10-03 | v0.14.1 | **代码清理（无功能变更）**：删除死代码 `utils/api.js` 的 `USER_CONFIG.chanTag`（值 `default_pid`，pid 类参数已下沉到后端处理，前端全项目无读取方） | [2.2](#22-目录结构) |
| 2026-10-02 | v0.14.0 | **新增美团团购商品详情页 `pages/meituan-goods`**：首页「美团热销」卡片与吃喝玩乐搜索结果卡片点击改为 `navigateTo` 进详情页（参数 `sign`=productViewSign），转链购买下沉到详情页「前往购买」（登录校验 + `/api/meituan/referral-link-by-goods-id` 转链跳美团小程序）；`utils/api.js` 新增 `getMeituanGoodsDetail()`（`GET /api/meituan/goodsDetail?productViewSignList=xxx`）与字段映射 `mapMeituanGoodsDetail`；详情页含主图预览、浅橙渐变价格区（券后价/原价/价格力标签/预估返利）、标题销量、门店卡片（logo/距离/可用门店数）、购买须知（有效期格式化）、悬浮返回按钮、分享（好友/朋友圈带 sign）；`app.json` 注册页面路由。**全站 UI 改版（视觉统一）**：主操作按钮体系统一为主色渐变胶囊（`#ff4d00→#ff9402` + 白字 + 橙色投影），废弃白底黑框样式——覆盖首页转链/复制按钮、唯品会与美团详情页「前往购买」、搜索页「搜索」按钮、吃喝玩乐页「搜索」按钮、订单页空状态「刷新」按钮、全站手机号快捷登录按钮；首页头部新增渐变延伸块（`.page-hero`，header 渐变同步改垂直方向保证无缝衔接），转链卡片负 margin 上浮悬浮其上；首页商品卡价格行新增「券后」小标签、原价右对齐、卡片与活动坑位增加按压缩放反馈（`hover-class`）；精选好物 tab 激活渐变方向统一为 135deg 并加橙色投影；「粘贴」按钮改主色描边胶囊；登录/授权弹窗统一 32rpx 圆角 + `dialogPopIn` 弹入动画；美团详情页底部栏适配 `env(safe-area-inset-bottom)` 并加上投影、购买须知区增加标题。**搜索页/订单页/吃喝玩乐页换肤收尾**：清理残留青绿系（搜索页搜索栏渐变底 `#dcf4ef`→`#ffe9db`、聚焦光晕、空状态图标底色，吃喝玩乐页排序栏选中态底色）；搜索页商品卡改 20rpx 圆角 + 按压反馈；订单页背景统一 `#f5f5f5`、空状态图标改圆形浅橙底；唯品会详情页价格区改浅橙渐变底、底部栏适配安全区；吃喝玩乐页 banner/商品卡圆角统一 20rpx。**tabBar 订单图标重绘**：`order.png` / `order-active.png` 由线性描边风格改为面性风格（实心小票 + 白色横线），色值取样自现有 home 图标（灰 `#999999` / 橙 `#e04600`），与首页/吃喝玩乐图标风格统一 | [2.2](#22-目录结构)、[3.1](#31-首页-pagesindex-)、[3.2](#32-吃喝玩乐页-pageslife-)、[3.8](#38-美团团购商品详情页-pagesmeituan-goods-)、[6.1](#61-色彩系统) |
| 2026-09-29 | v0.13.4 | **代码清理（无功能变更）**：删除死代码 `utils/api.js` 的 `getTranUrl()`（全项目无调用方，内部 `pid` 硬编码 `default_pid`，能力已由 `convertLink` 覆盖）及其导出项；删除 `pages/orders/orders.js` 未使用的常量 `PAGE_SIZE`；删除空目录 `pages/webview/`、`tools/`（无文件、未在 `app.json` 注册、无引用）；删除无引用素材 `images/fashion-icon.png`、`images/meituan-redpacket.png`；`utils/api.js` 注释中残留的线上域名统一改写为 `{BASE_URL}` 表述 | [2.2](#22-目录结构)、[4.6](#46-链接转换接口-) |
| 2026-09-29 | v0.13.3 | **需求文档与代码全量对齐审计**：修正 3.1（「今日最优惠活动」改为已接入 `/api/banner/indexBannerList`、取前 2 条不足即隐藏、卡片为左图右文，删除「接口开发中 / 三条占位数据」描述；平台入口五 icon 表格改为当前实际的唯品会坑位 + 多多好货卡片授权入口，补充首页分享）；3.2（banner 域名改 `{BASE_URL}`、跳转白名单补全三个 appId）；3.3/3.4（修正章节编号重复：搜索页子节 3.2.x→3.3.x、商品详情页独立为 3.4 并同步全部锚点；搜索页改为「已接真实接口 `/api/search`」、平台 Tab 顺序改为实际值、点击跳转由「预留」改「已实现」）；3.4（详情接口改为 `GET /api/goods/getDetail`，参数 `goodsId/pid/uid/platform`，删去废弃的 `chanTag/openid`，按钮文案「立即购买」→「前往购买」）；4.2/4.3/4.6/4.7（域名统一 `{BASE_URL}`、Mock 说明更正、登录失败仅置 `needPhoneLogin` 由页面弹窗）；2.1/2.2（导航方案与目录结构补全 `pages/life`、`utils/config.js`、`images/tabbar`）；5.2（补 `all` 仅搜索筛选 Tab 说明）；1.2 与路线图状态同步。**代码修复**：`app.json` 的 `navigateToMiniProgramAppIdList` 补登记拼多多小程序 `wxa918198f16869201`（此前缺失，会导致多多好货跳转失败） | [2.1](#21-技术栈)、[3.1](#31-首页-pagesindex-)、[4.7](#47-商品详情接口-) |
| 2026-09-20 | v0.13.2 | **多多好货点击增加登录 + 拼多多授权双重校验**：点击卡片依次校验未登录（弹手机号登录）→ `GET /api/thirdAuth/checkAuth?uid=xxx&platform=pdd` 授权状态，未授权弹「前往拼多多授权」提示窗，确认后 `GET /api/thirdAuth/genAuthUrl?uid=xxx&platform=pdd` 取 `weapp_url`（appId 兜底 `wxa918198f16869201`）跳拼多多小程序授权页，已授权才继续转链跳商品；**checkAuth / genAuthUrl 接口去掉 pid 参数**（pid 由后端处理，全站调用方均不再下发） | [3.1](#31-首页-pagesindex-)、[4.4](#44-第三方平台授权接口-) |
| 2026-09-20 | v0.13.1 | **多多好货点击直接转链跳拼多多小程序**：卡片不进商品详情，未登录先弹手机号登录，登录后调 `GET /api/tranUrl/genUrlByGoodsId?platform=pdd&goodsId=xxx&uid=xxx`（`goodsId` 取 `goods_platform_id`，`pid` 不下发由后端处理），成功取 `urls.weapp_url` + `urls.weapp_app_id`（兜底 `wxa918198f16869201`）`navigateToMiniProgram` 跳拼多多小程序；`getGoodsTranUrlByGoodsId` 调整为 pid 仅 vip 平台默认下发 | [3.1](#31-首页-pagesindex-)、[3.4](#34-商品详情页-pagesgoods-) |
| 2026-09-20 | v0.13.0 | **首页精选好物新增第三个 tab「多多好货」（拼多多）**：调用 `GET {BASE_URL}/api/indexList?tab=3`，返回为顶层数组（与 tab=1/2 的包装结构不同）`[{ id, goods_name, goods_image_url, market_price, sale_price, platform:'pdd', goods_platform_id }]`，`utils/api.js` 新增 `fetchPddIndexGoods()`，首页新增 `loadPddGoods()` / `formatPddList()`，首次切到该 tab 才请求（一次返回暂不分页），双列瀑布流展示（券后价 sale_price + 删除线原价 market_price）；点击卡片暂提示「跳转即将上线」（拼多多转链/跳转待后端接口就绪后接入） | [3.1](#31-首页-pagesindex-)、[4.1](#41-通用约定) |
| 2026-09-14 | v0.12.7 | **首页转链区文案与按钮样式微调**：粘贴框占位文案改为「支持粘贴唯品会/拼多多 商品链接查找优惠」（收窄为支持的平台）；「粘贴」按钮加宽至 `min-width: 172rpx`（字号 26rpx、高度 56rpx）便于点击；「查找专属优惠」按钮由白底黑框改为主色渐变胶囊（`linear-gradient(135deg, #ff4d00, #ff9402)` + 白字） | [3.1](#31-首页-pagesindex-)、[6.1](#61-色彩系统) |
| 2026-09-13 | v0.12.6 | **首页唯品好货登录后刷新 + 清理废弃接口**：手机号登录成功后调用 `loadVipGoods()` 重新拉取唯品好货（携带新 `uid`，覆盖首屏未登录时的结果）；移除已废弃的 `/api/vip/goodsList` 接口封装 `getGoodsList`（含导出，全项目无调用方） | [3.1](#31-首页-pagesindex-)、[4.1](#41-通用约定) |
| 2026-09-13 | v0.12.5 | **`/api/indexList` 参数调整**：平台筛选参数下沉到后端——tab=1（唯品好货）移除 `jxCode`、新增 `uid`（取 `USER_CONFIG.uid`，未登录不下发），tab=2（美团热销）移除 `platform` / `listTopiId`，前端仅保留 `tab` 与分页/定位参数；首页两处 `fetchVipIndexGoods` 调用同步去掉 `jxCode` | [3.1](#31-首页-pagesindex-)、[4.1](#41-通用约定) |
| 2026-09-13 | v0.12.4 | **首页转链结果卡片按钮精简**：移除单独的「复制 H5 链接」按钮，仅保留底部「一键复制推广链接」（复制 `h5_url`）；清理随之失效的 `onCopyField` 方法（含 `data-field` 通用复制逻辑）与 `.result-link-copy-btn` 样式 | [3.1](#31-首页-pagesindex-)、[4.6](#46-链接转换接口-) |
| 2026-09-13 | v0.12.3 | **首页转链结果精简**：链接转换结果卡片只展示 `h5_url`（H5 推广链接），移除「小程序路径」「App 唤起链接」两个区块及相应分隔线；`utils/api.js` 返回结构与 `linkResult` 数据字段（weapp_url/weapp_short_link/deeplink_url）保留不变，后续需要展示时放开 wxml 即可 | [3.1](#31-首页-pagesindex-)、[4.6](#46-链接转换接口-) |
| 2026-09-13 | v0.12.2 | **开发环境请求守卫**：`utils/config.js` 新增 `setupRequestGuard()`（`app.js` onLaunch 调用），仅 `develop` 环境给 `wx.request` 打代理——打印每条请求真实 URL，非本地 host 请求红字告警并输出调用栈，用于定位「接口仍走线上」类问题；`FORCE_ENV` 当前置为 `'develop'`，开发阶段全量走本地 `http://localhost:3000`；明确后端下发的图片绝对地址（banner/商品图）不在治理范围，继续走线上 | [4.1](#41-通用约定) |
| 2026-09-13 | v0.12.1 | **接口 Host 统一治理**：新增 `utils/config.js` 作为唯一接口地址来源，按 `wx.getAccountInfoSync().miniProgram.envVersion` 自动切换环境——开发版（开发者工具/真机调试）走本地 `http://localhost:3000`，体验版/正式版走线上 `https://hgh.pangpai-car.com`，支持 `FORCE_ENV` 手动强制指定；改造 `utils/api.js`（BASE_URL 与 indexList 聚合接口）、`app.js`（openid）、首页/吃喝玩乐/商品详情/我的订单四页的 `getPhone` / `register` 共 11 处硬编码域名为统一 `BASE_URL` 拼接 | [4.1](#41-通用约定) |
| 2026-09-13 | v0.12.0 | 全站换肤为淘宝橙色系，主色 #ff5000，头部渐变 #ff4d00→#ff9402 | [6.1](#61-色彩系统) |
| 2026-09-10 | v0.11.0 | **产品更名**：惠更好 → 值物APP。全站登录弹窗与需求文档品牌文案统一改为「值物APP」，产品定位不变（多平台 CPS 返利小程序）；代码工程目录与配置标识保留 `huigenghao` | [1.1](#11-产品定位) |
| 2026-09-10 | v0.10.9 | **唯品会第三方授权改为弹窗确认再跳转**：首页唯品会坑位与商品详情「前往购买」未授权（checkAuth=false）时不再直接跳转，先弹「前往唯品会授权」提示窗，确认后调 `/api/thirdAuth/genAuthUrl` 取 `authUrl.weapp_url` 跳唯品会小程序完成授权；授权链接解析兼容顶层 / authUrl / data 结构；登录判定收紧为 `isLogin && userId`（首页/商品详情），uid 取值移除 openid 兜底 | [3.1](#31-首页-pagesindex-)、[3.4](#34-商品详情页-pagesgoods-)、[4.4](#44-第三方平台授权接口-) |
| 2026-09-06 | v0.10.8 | **首页精选好物改为双 tab**：「唯品好货 / 美团热销」共用聚合接口 `GET /api/indexList` 各请求一次——tab=1 带 `jxCode=4vojhsp2&offset&pageSize` 按 offset 触底翻页（返回 `returnCode:0/result{goodsInfoList,nextPageOffset,lastPage}`）；tab=2 带首页定位 `longitude/latitude/platform=2/listTopiId=2` 一次加载（返回 `code:0/data[]`），卡片为美团团购结构（主图/标题/门店·品牌/券后价/原价），点击经转链跳美团小程序；首页进入默认加载唯品好货、首次切美团热销才发定位请求；首页打开同时获取模糊定位经纬度缓存备用 | [3.1](#31-首页-pagesindex-) |
| 2026-09-06 | v0.10.7 | **今日最优惠活动 banner 结构定型**：按截图样式把每个坑位改为「标题 + 子标题 + 商品大图」三段式卡片，移除区块大标题；数据契约同步扩展为 `{ id, iconBg, icon, title, subtitle, image }`；内置三条占位数据（限时狂秒 / 3折疯抢 / 天天低价）方便预览，缺图时降级为「商品图占位」色块 | [3.1](#31-首页-pagesindex-) |
| 2026-09-06 | v0.10.6 | **首页入口重构：电商购物 → 今日最优惠活动**：原「电商购物」五个 icon（唯品会/拼多多/淘宝/京东/抖音商城）下线，改为标题「今日最优惠活动」+ 一行三个 banner 坑位（图标 + 促销文案）；数据接口开发中，先保留占位 UI 与数据契约（`[{ id, image, title }]`），连带清理首页 `platforms` 数据、`onPlatformTap`/`jumpToThirdPlatform` 等死代码与「未授权」授权弹窗 | [3.1](#31-首页-pagesindex-) |
| 2026-09-06 | v0.10.5 | **全页面支持转发（我的订单除外）**：首页、吃喝玩乐、商品详情、搜索、日志页均支持右上角转发给好友/分享到朋友圈；商品详情转发携带 `id`，搜索转发携带 `keyword+platform` 且对方打开自动搜索；`pages/orders` 不实现分享钩子保持不可转发 | [3.1](#31-首页-pagesindex-)、[3.2](#32-吃喝玩乐页-pageslife-)、[3.3](#33-商品搜索列表页-pagessearch-)、[3.4](#34-商品详情页-pagesgoods-)、[3.7](#37-启动日志页-pageslogs-) |
| 2026-09-06 | v0.10.4 | **搜索结果列表隐藏已售**：搜索列表商品卡片移除「已售xx」文本及样式，券后价与删除线原价合并为同一行（原价居右） | [3.3](#33-商品搜索列表页-pagessearch-) |
| 2026-09-06 | v0.10.3 | **搜索结果列表隐藏返利**：搜索列表商品卡片移除「返¥XX.XX」返利标签及对应样式，仅保留券后价、优惠券角标、原价删除线 | [3.3](#33-商品搜索列表页-pagessearch-) |
| 2026-09-06 | v0.10.2 | **我的订单页新增下拉刷新**：开启页面级下拉刷新（`enablePullDownRefresh`），下拉时静默重拉当前平台第 1 页、保持列表可见不闪整页加载，完成后整页替换并停止刷新动画；触底加载/初始加载进行中忽略下拉 | [3.6](#36-我的订单-pagesorders-) |
| 2026-09-06 | v0.10.1 | **我的订单迭代**：订单列表顶部新增平台 Tab（唯品会 `vip` / 美团 `meituan`，默认唯品会），切换 Tab 重置分页并按新平台重新加载；`GET /api/order/getList` 新增 `platform` 参数区分平台（唯品会/美团）；订单卡片隐藏预计返利、尾部仅「实付」金额靠右对齐，空状态文案带当前平台名（暂无xx订单）。**首页调整**：淘宝/京东/抖音平台入口点击改为弹窗「敬请期待」（待接入）不再跳搜索页，拼多多入口顺序前移；链接转链输入框占位文案改为「粘贴淘宝/唯品会/京东/拼多多/抖音 链接查找优惠」并压缩输入区高度；精选好物卡片隐藏返利金额标签 | [3.1](#31-首页-pagesindex-) [3.6](#36-我的订单-pagesorders-) [4.5](#45-后续待定接口) |
| 2026-09-06 | v0.10.0 | **全站视觉换肤**：UI 主色由橙红系（`#ff5000`/`#e02e24`）改为青绿系（主色 `#81D8CF` + 强调 `#0ea294`）；主按钮统一为白底黑字黑框胶囊；搜索框白底+主色描边+光晕；价格/返利/状态/标签等强调文字全部换主色；tabBar 选中色同步 `#0ea294`。**首页头部重构**：移除顶部标题导航栏，搜索框置顶并固定（整块主色背景无渐变、与胶囊同高且水平对齐、右侧避让胶囊），占位文案「搜索全网好物」，转链按钮文案「查找专属优惠」，下方入口区块收窄为圆角留白卡片。**商品详情页升级**：适配真实详情接口新结构（`{result, data:{goodsId, goodsName, images, detailImages, prices, commission, tags, url}}`）；主图轮播+点击预览、详情长图展示+预览、价格计算方式 `priceDesc` 分段高亮；移除导航栏改悬浮返回按钮（与胶囊垂直对齐）；购买按钮实时调用按商品 ID 转链 `GET /api/tranUrl/genUrlByGoodsId` 获取 `weapp_url`。**用户 uid 真实化**：移除 Mock uid `mike004`，登录成功同步 `setUserConfig({ uid })`，美团活动转链接口带 uid。**吃喝玩乐页**：进入页面未登录弹出手机号快捷登录弹窗（可暂不登录跳过） | [3.1](#31-首页-pagesindex-) [3.2](#32-吃喝玩乐页-pageslife-) [3.4](#34-商品详情页-pagesgoods-) [6.1](#61-色彩系统) |
| 2026-08-30 | v0.9.0 | 新增底部 tab「我的订单」：新增 `pages/orders/` 页面，未登录（无 uid）弹出手机号快捷登录弹窗，已登录调 `GET /api/order/getList?uid=xxx&page=1` 分页加载订单，渲染订单卡片（商品图/名称/平台/订单号/状态/实付/返利/下单时间），`create_time` 格式化为 `2026/8/20 13:22:23`；设计并生成 tabBar 图标（order.png/order-active.png）；`app.json` 注册页面与 tabBar 项；api.js 新增 `getOrderList` | [3.6](#36-我的订单-pagesorders-) |
| 2026-08-23 | v0.8.6 | 点击搜索商品卡片实时获取推广链接：搜索列表项映射 `productViewSign`，点击调 `/api/meituan/referral-link-by-goods-id?productViewSign=xxx`，取 `referralLinkMap` key=4 小程序路径跳转美团 | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.5 | 美团商品搜索接口域名从本地 `http://localhost:3000` 切回线上 `https://hgh.pangpai-car.com`（后端已发布） | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.4 | 移除 `wx.getLocation` 降级逻辑（该接口平台审核中），仅使用 `wx.getFuzzyLocation`；`requiredPrivateInfos` 只保留 `getFuzzyLocation` | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.3 | 吃喝玩乐页定位改为模糊定位：`wx.getLocation` → `wx.getFuzzyLocation`（type=gcj02），`app.json` 权限声明改为 `scope.userFuzzyLocation`，定位成功在控制台打印经纬度 | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.2 | 吃喝玩乐页进入即定位：页面加载时调用 `wx.getLocation` 缓存经纬度，搜索/翻页/排序均携带 `longitude`/`latitude` 传美团搜索接口；离我最近排序定位未就绪时重新获取 | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.1 | 吃喝玩乐页搜索增强：搜索商品域名暂切本地 `http://localhost:3000` 调试；搜索结果上方新增排序栏（综合排序=1/价格升序=2/离我最近=6，传 `sortField`），离我最近排序自动定位传经纬度，`app.json` 增加 `scope.userLocation` 权限声明 | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.8.0 | 吃喝玩乐页新增美团商品搜索：顶部搜索栏，调 `/api/meituan/goods`（searchText/longitude/latitude/pageSize/pageNo/searchId）返回商品列表，卡片展示图片/标题/品牌/门店/售价/原价/佣金，上拉触底分页加载（回传 searchId，hasNext 控制） | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.7.1 | 活动服务全部迁移线上：吃喝玩乐 banner 与美团转链接口改走 `https://hgh.pangpai-car.com`，移除 localhost 配置与 app.js lifeApiBase | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-23 | v0.7.0 | 新增底部 tabBar（首页/吃喝玩乐）；新增吃喝玩乐页：调 /api/banner 展示活动卡片（图片+标题+子标题），点击调 /api/meituan/referral-link-by-act-id 获取转链，取 referralLinkMap key=4 小程序路径跳转美团外卖小程序；app.json 增加 navigateToMiniProgramAppIdList | [3.2](#32-吃喝玩乐页-pageslife-) |
| 2026-08-10 | v0.6.4 | 需求文档同步代码：新增唯品会到平台表/映射表/设计规范；更新 3.1 首页描述（ensureLogin 按需登录、精选好物、链接转链支持拼多多+唯品会）；调整 4.1 通用约定为实际 base URL 和 GET 方式；修正 4.4 授权接口为 GET；更新 Phase 2 路线图状态 | - |
| 2026-08-09 | v0.6.3 | 修复转链接口 wx.request 响应解析问题：后端 Content-Type 不规范时 res.data 为字符串导致 code 判断失败，增加 JSON.parse 兜底；正式移除 platform 参数 | [4.6](#46-链接转换接口-) |
| 2026-08-09 | v0.6.2 | 修复拼多多短链接（如 p.pinduoduo.com）转链失败：前端恢复 detectPlatform 检测并传 platform 参数给后端作为辅助识别 | [4.6](#46-链接转换接口-) |
| 2026-08-09 | v0.6.1 | 链接转换接口升级：返回格式改为 `{ code, urls: { h5_url, weapp_url, weapp_short_link, deeplink_url } }`，后端自动识别平台，无需前端传 platform；新增支持唯品会链接；code=-2 表示平台不支持 | [4.6](#46-链接转换接口-) |
| 2026-08-09 | v0.6.0 | 链接转换功能：用户在首页粘贴拼多多商品链接（如 p.pinduoduo.com），调 GET /api/tranUrl（uid/pid/platform/source_url），判断 result===true 取 h5_url，结果卡片展示原始链接和转换链接，支持一键复制；其他平台暂不支持 | [4.6](#46-链接转换接口-) |
| 2026-07-26 | v0.5.0 | 第三方平台跳转：点击唯品会/拼多多 icon 校验授权(checkAuth)，已授权直跳对应小程序，未授权获取链接(genAuthUrl)跳转授权；淘宝/京东/抖音仍跳搜索页 | - |
| 2026-07-19 | v0.4.0 | 完整登录注册链路调通：对接真实接口格式 `{ result, data: { user: { id }, token } }`，兼容多种返回格式(result/success/code)，userId提取自 data.user.id，五步流程(wx.login→openid→loginByOpenid→getPhone→register)全部跑通 | - |
| 2026-07-19 | v0.3.2 | 新增手机号登录：loginByOpenid 失败时首页弹出登录窗口，支持微信手机号授权(getPhoneNumber)，先 GET `/api/weixin/getPhone` 获取真实手机号，再 POST `/api/user/register` 完成注册 | - |
| 2026-07-19 | v0.3.1 | 对接 code换openid 接口 `/api/weixin/openid`，完整登录链路：wx.login→保存code→换openid→保存openid→loginByOpenid→保存token/userInfo，所有登录态数据持久化到本地 Storage | - |
| 2026-07-13 | v0.3.0 | 实现登录功能：app.js onLaunch 中自动执行 wx.login→换openid→loginByOpenid 流程，新增 api.loginByOpenid()，登录态写入 globalData/Storage，api.js 新增 postRequest；首页标题改为「惠更好」 | - |
| 2026-06-21 | v0.2.1 | 搜索体验优化：进入页面即展示历史，改为手动搜索（输入不自动搜）；修复详情页参数传递 | - |
| 2026-06-21 | v0.2.0 | 新增商品详情页 pages/goods/，对接 GET /api/goods，搜索列表点击跳转详情 | - |
| 2026-06-21 | v0.1.4 | 首页改版：去掉默认模板，顶部放搜索框，其余留白；搜索页加返回按钮 | - |
| 2026-06-21 | v0.1.3 | 对接真实搜索接口 `GET /api/search`，实现真实调用优先+Mock兜底策略 | - |
| 2026-06-21 | v0.1.2 | 切换渲染模式：Skyline → WebView，移除 glass-easel，恢复标准 CSS | - |
| 2026-06-21 | v0.1.1 | 修复 Skyline 兼容性 CSS 问题 | - |
| 2026-06-21 | v0.1 | 初版需求文档创建，商品搜索页完成 | - |

---

> 💡 **文档使用说明**  
> - 每次新增页面或修改核心功能后，更新对应章节和变更日志  
> - API 接口变更时同步更新第 4 节  
> - 开发路线图任务完成后将状态改为 ✅  
> - 本文件作为团队开发参考，保持与代码同步
