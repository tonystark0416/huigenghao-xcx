# 惠更好 (huigenghao) 需求文档

> 多平台 CPS 返利小程序 | 版本 v0.4.0  
> 最后更新：2026-07-19

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

惠更好 (huigenghao) 是一款集成多家主流电商平台 CPS 联盟的微信小程序，用户可通过本小程序搜索商品、获取优惠券、完成购买后获得返利。

### 1.2 集成的电商平台

| 平台 | 标识 | 品牌色 | CPS 状态 |
|------|------|--------|----------|
| 淘宝/天猫 | `taobao` | `#ff5000` | 待接入 |
| 京东 | `jd` | `#c91623` | 待接入 |
| 拼多多 | `pdd` | `#e02e24` | 待接入 |
| 抖音 | `douyin` | `#000000` | 待接入 |

### 1.3 核心用户流程

```
进入首页 → 静默登录(wx.login→/api/weixin/openid换openid→loginByOpenid) → 搜索商品 → 浏览商品列表 → 查看详情 → 复制口令/领券 → 跳转购买 → 获得返利
```

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
| 导航方案 | 自定义 navigation-bar 组件 |
| 数据持久化 | wx.Storage（本地） |

> ⚠️ **历史记录**：项目最初使用 Skyline 渲染引擎 + glass-easel 组件框架，因兼容性问题已于 v0.1.2 切回传统 WebView 模式。

### 2.2 项目目录结构

```
boboshop/
├── app.js                  # 应用入口、全局生命周期
├── app.json                # 页面路由、窗口配置
├── app.wxss                # 全局样式
├── REQUIREMENTS.md         # 本需求文档
├── pages/
│   ├── index/              # 首页（入口 + 用户信息）
│   ├── logs/               # 启动日志（调试用）
│   └── search/             # 商品搜索列表页
├── components/
│   └── navigation-bar/     # 通用自定义导航栏
└── utils/
    ├── api.js              # API 统一接口层（含 Mock）
    └── util.js             # 通用工具函数
```

---

## 3. 页面清单与功能说明

### 3.1 首页 (`pages/index/`)

**状态**：✅ 已完成基础版本

**功能描述**：
- 进入首页自动执行完整登录流程，每一步数据都持久化到本地

**登录流程**：

| 步骤 | 操作 | 接口 | 本地存储 Key | globalData 字段 |
|------|------|------|-------------|-----------------|
| ① | `wx.login` 获取临时 code | - | `code` | `code` |
| ② | 用 code 换取 openid | `POST /api/weixin/openid` | `code`, `openid`, `session_key` | `code`, `openid`, `session_key` |
| ③ | openid 登录获取 token | `POST /api/user/loginByOpenid` | `token`, `userInfo` | `token`, `userInfo`, `isLogin` |

- 搜索入口：点击模拟搜索框跳转至商品搜索页
- 导航栏标题「惠更好」，无返回按钮
- **登录失败处理**：如果 `loginByOpenid` 返回失败（新用户未注册），首页弹出登录窗口，引导用户通过微信手机号授权完成注册/登录
  - 弹窗包含「微信手机号快捷登录」按钮（`open-type="getPhoneNumber"`）
  - 获取手机号 code 后，调用 `POST /api/user/loginByPhone` 注册/登录
  - 支持「暂不登录」跳过

**待优化**：
- [ ] 首页整体重新设计为电商风格（热门推荐、平台快捷入口等）
- [ ] 添加个人中心入口（订单、收益、设置等）

---

### 3.2 商品搜索列表页 (`pages/search/`)

**状态**：✅ 已完成基础版本（使用 Mock 数据）

#### 3.2.1 搜索栏

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 关键词输入 | 圆角搜索框，支持输入任意文本 | ✅ |
| 一键清空 | 输入框右侧 × 按钮清空内容 | ✅ |
| 搜索触发 | 点击「搜索」按钮或键盘确认触发，**输入时不自动搜索** | ✅ |
| 搜索防抖 | ~~输入变化后 400ms 防抖延迟~~ → 已改为手动搜索 | ❌ 已废弃 |
| 聚焦态 | 聚焦时搜索框边框高亮为橙色 | ✅ |

#### 3.2.2 搜索历史

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 自动记录 | 搜索触发后自动保存关键词（去重） | ✅ |
| 历史展示 | **进入页面即展示**，输入时自动隐藏，清空后恢复 | ✅ |
| 历史点击 | 点击历史词快速搜索 | ✅ |
| 逐条删除 | 每个历史标签可单独删除 | ✅ |
| 清空全部 | 一键清空所有搜索历史 | ✅ |
| 存储上限 | 最多保留 10 条 | ✅ |
| 持久化 | 基于 wx.Storage 本地存储 | ✅ |

#### 3.2.3 平台筛选 Tab

| 功能点 | 说明 | 状态 |
|--------|------|------|
| Tab 切换 | 全部 / 淘宝 / 京东 / 拼多多 / 抖音 | ✅ |
| 横向滚动 | 支持左右滑动查看所有平台 | ✅ |
| 选中态 | 品牌色下划线 + 文字加粗 | ✅ |
| 自动搜索 | 切换平台后以当前关键词自动重新搜索（重置为第 1 页） | ✅ |

#### 3.2.4 商品卡片列表

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 双列网格 | 每行 2 个卡片，间距均匀 | ✅ |
| 商品图片 | 主图展示，宽高比 1:1，懒加载 | ✅ |
| 平台标签 | 左上角品牌色标签，标出所属平台 | ✅ |
| 商品标题 | 最多显示 2 行，超出省略号 | ✅ |
| 券后价 | 大号橙色字体突出显示 | ✅ |
| 原价 | 灰色删除线字号较小 | ✅ |
| 返利金额 | 橙色标签样式「返¥XX.XX」 | ✅ |
| 销量 | 显示已售件数 | ✅ |
| 点击跳转 | 预留 `onProductTap`，目标路径 `/pages/goods/goods` | 🚧 预留 |

#### 3.2.5 下拉刷新 & 上拉加载

| 功能点 | 说明 | 状态 |
|--------|------|------|
| 下拉刷新 | refresher-enabled，重置为第 1 页重新搜索 | ✅ |
| 上拉加载 | 触底加载下一页，pageSize = 20 | ✅ |
| 加载完毕 | hasMore = false 时显示「已经到底了」 | ✅ |

#### 3.2.6 状态视图

| 状态 | 展示内容 | 状态 |
|------|----------|------|
| 初始状态 | 🔍 图标 + 「输入关键词搜索全网好物」 | ✅ |
| 搜索无结果 | 📦 图标 + 「暂无相关商品，试试其他关键词吧」 | ✅ |

---

### 3.3 商品详情页 (`pages/goods/`)

**状态**：✅ 基础版本完成

**功能描述**：
- 商品主图大图展示
- 券后价（大号橙色）+ 原价（删除线）+ 折扣标签
- 返利信息（金额 + 比例）
- 商品完整标题
- 标签列表（品牌色底色）
- 品牌 / 店铺 / 分类 / 销量等元信息
- 底部栏：返利金额 + 「复制链接去购买」按钮（复制 destUrl 到剪贴板）

**API**：`GET /api/goods?goodsId=xxx&chanTag=xxx&openid=xxx`
- 适配函数：`adaptGoodsDetail` 负责 `data.result` → 内部统一格式
- Mock 兜底：`mockGoodsDetail`

---

### 3.4 个人中心 (`pages/mine/`)

**状态**：🔜 待开发

**计划功能**：
- [ ] 用户头像/昵称展示
- [ ] 累计返利金额
- [ ] 待入账/已到账收益
- [ ] 订单列表（待返利/已返利）
- [ ] 提现入口
- [ ] 设置（账号安全、关于等）

---

### 3.5 订单/返利记录 (`pages/orders/`)

**状态**：🔜 待开发

**计划功能**：
- [ ] 订单列表（所有平台汇总）
- [ ] 订单状态筛选（待付款/已付款/已结算/已失效）
- [ ] 平台筛选
- [ ] 每笔订单显示：商品图、标题、下单时间、金额、返利状态

---

### 3.6 启动日志页 (`pages/logs/`)

**状态**：✅ 已完成（示例/调试页面）

**功能描述**：展示小程序历史启动时间记录，用于开发调试。后续可移除或改造。

---

## 4. API 接口规范

### 4.1 通用约定

- 基础路径：`https://api.boboshop.example.com/v1`（后续替换）
- 请求方式：POST（JSON body）
- 认证方式：Header 携带 `Authorization: Bearer <token>`
- 通用返回结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

| code | 含义 |
|------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | 未登录 / token 过期 |
| 2001 | 搜索服务异常 |
| 9999 | 系统异常 |

### 4.2 商品搜索接口

**接口路径**：`GET http://localhost:3000/api/search`

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
| platform | string | 来源平台：`taobao` / `jd` / `pdd` / `douyin` |
| sales | number | 历史销量 |
| couponAmount | number | 优惠券面额（单位：元） |

**Mock 说明**：当前 `utils/api.js` 中的 `searchProducts` 函数模拟了上述接口行为（300-800ms 延迟）。后续对接真实接口，只需修改该函数的内部实现，页面代码无需改动。

### 4.3 用户登录接口 ✅

**完整登录流程**（`app.js` onLaunch 自动执行）：

```
wx.login → 保存 code → GET /api/weixin/openid → 保存 openid, session_key
         → POST /api/user/loginByOpenid
                → 成功? → 保存 token, userId, userInfo → 完成
                → 失败? → 弹出手机号登录窗口
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

### 4.4 后续待定接口

| 接口 | 路径 | 说明 | 状态 |
|------|------|------|------|
| 领券/转链 | `POST /api/goods/link` | 生成推广链接/口令 | 🔜 |
| 用户信息 | `GET /api/user/info` | 获取用户信息和返利汇总 | 🔜 |
| 订单列表 | `GET /api/orders` | 查询订单与返利记录 | 🔜 |
| 提现 | `POST /api/withdraw` | 申请提现 | 🔜 |

---

### 4.4 商品详情接口 ✅

**接口路径**：`GET http://localhost:3000/api/goods`

**请求参数**（Query）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| goodsId | string | 是 | 商品唯一 ID |
| chanTag | string | 是 | 渠道标签 |
| openid | string | 是 | 用户 openid |

**响应结构**（内部适配后）：

| 字段 | 类型 | 来源 |
|------|------|------|
| id | string | result.goodsId |
| title | string | result.goodsName |
| image | string | result.goodsMainPicture |
| price | number | result.vipPrice / goodsPromotionInfo.salePrice |
| originalPrice | number | result.marketPrice |
| rebate | number | result.commission |
| rebateRate | number | result.commissionRate |
| brandName | string | result.brandName |
| storeName | string | result.storeInfo.storeName |
| sales | string | result.productSales |
| tags | string[] | result.tagNames |
| destUrl | string | result.destUrl |

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
| `douyin` | 抖音 | `#000000` | 抖音电商 |

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
| 品牌主色 | `#ff5000` | 搜索按钮、价格、返利标签、下划线 |
| 品牌渐变 | `#ff5000` → `#ff6b35` | 首页入口按钮 |
| 淘宝色 | `#ff5000` | 淘宝平台标签 / Tab 下划线 |
| 京东色 | `#c91623` | 京东平台标签 / Tab 下划线 |
| 拼多多色 | `#e02e24` | 拼多多平台标签 / Tab 下划线 |
| 抖音色 | `#000000` | 抖音平台标签 / Tab 下划线 |
| 主文字 | `#333333` | 标题、主要信息 |
| 次文字 | `#999999` | 辅助说明、历史标签 |
| 辅助文字 | `#bbbbbb` | 占位符、弱化信息 |
| 页面背景 | `#f5f5f5` | 整体背景 |
| 卡片背景 | `#ffffff` | 商品卡片、面板 |
| 搜索框背景 | `#f5f5f5` | 搜索输入框默认态 |

### 6.2 字体规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| H1 | 36rpx | bold | 页面大标题 |
| H2 | 32rpx | bold | 区域标题 |
| H3 | 28rpx | medium | 卡片标题 |
| Body | 28rpx | normal | 正文 |
| Caption | 24rpx | normal | 辅助说明 |
| Price | 34rpx | bold | 价格数字 |
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

### Phase 2：商品详情与转化 🔜

| 任务 | 说明 | 状态 |
|------|------|------|
| 商品详情页 | 大图、价格、返利、详情图文 | 🔜 |
| 领券 / 转链 | 生成推广链接或口令 | 🔜 |
| 平台跳转 | 唤起对应电商 App / H5 | 🔜 |
| API 真实对接 | 切换 Mock 为真实接口 | 🔜 |

### Phase 3：用户与返利体系 🔜

| 任务 | 说明 | 状态 |
|------|------|------|
| 微信登录 | 静默登录 + Token 管理 | ✅ |
| 个人中心 | 用户信息、收益展示 | 🔜 |
| 订单列表 | 订单与返利状态查询 | 🔜 |
| 提现功能 | 提现申请与记录 | 🔜 |

### Phase 4：体验增强 🔜

| 任务 | 说明 | 状态 |
|------|------|------|
| 首页重新设计 | 热门推荐、Banner、分类入口 | 🔜 |
| 收藏功能 | 商品收藏 | 🔜 |
| 分享功能 | 商品分享卡片 | 🔜 |
| 异常监控 | 接口异常、错误边界处理 | 🔜 |

---

## 8. 变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
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
