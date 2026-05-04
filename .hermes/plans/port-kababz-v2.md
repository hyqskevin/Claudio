# Claudio FM — 功能补齐规划 v2

> 基于 kabaBZ/Claudio 设计文档（2026-04-25-claudio-fm-design.md）vs 当前代码的完整差距分析

## 一、视觉系统修复（最高优先级）

### 1.1 FluidBlobs 对称布局
- 现状: primary `top:10%; left:15%` / secondary `bottom:10%; right:10%` — 不对称
- 目标: 两球对称居中，主球左上45%位置，副球右下45%位置
- CSS 修改: `.fluid-blob.primary` 和 `.fluid-blob.secondary` 位置调整

### 1.2 VISUAL MODE 实际可见
- 现状: AudioVisualizer `opacity: 0.15; filter: blur(2px)` — 切模式看不出来
- 目标: 6 种可视化模式清晰可辨，切换即时可见
- 方案:
  - 提高 opacity 到 0.4-0.6
  - 移除/减弱 blur
  - 使用动态颜色 `var(--color-primary)` 替代硬编码 mint
  - 支持切换到前台模式（全屏居中显示当前 visual）

### 1.3 动态颜色全链路
- 现状: colorExtractor 用 inline style 写 `--color-primary`，覆盖 CSS 主题变量
- 目标: 取色后所有视觉元素（光球、边框、visualizer、封面光效）统一响应
- 方案:
  - 保留 inline style 方式（这是正确的，主题切换时 resetColors 清除）
  - AudioVisualizer 用 CSS 变量替代硬编码色
  - BorderGlow 用 `--color-primary` 替代硬编码紫色

### 1.4 底部频谱条（kabaBZ 有，我们缺）
- kabaBZ: 64 条频谱柱，底部固定，渐变透明，idle 时呼吸漂动
- 需新增: SpectrumBars 组件，放在 player-card 下方
- 参考: kabaBZ `visual.js` 的 `drawSpectrum` 函数

### 1.5 封面律动光效（kabaBZ 有，我们缺）
- kabaBZ: `#coverGlow` 元素，bass 驱动 `box-shadow` 脉动
- 需新增: 在播放器封面区域加 `cover-glow` div，bass 驱动
- CSS: `.cover-glow` 已定义但未使用

## 二、交互功能补齐

### 2.1 封面 ↔ 歌词 3D 翻转（设计文档 §封面 ↔ 歌词翻转）
- CSS `perspective` + `transform-style: preserve-3d` 容器
- 正面: 专辑封面，背景色从封面提取
- 反面: KaraokeLyrics 歌词面板
- 点击翻转 0.6s，歌词逐行高亮自动滚动
- 状态: `coverFlipped` state 已定义但未实现翻转逻辑

### 2.2 头像弹出面板（设计文档 §头像弹出面板）
- Claudio 头像 → 底部滑出面板：电台信息 + 品味画像
- 用户头像 → 底部滑出面板：收藏列表 + 最近播放 + 歌单
- 需新增: SlideUpPanel 组件

### 2.3 DJ 语音沉浸模式（设计文档 §DJ 语音沉浸模式）
- 触发: Claude 回复含 `segue` 字段时自动触发
- 效果:
  - 歌曲增益渐变到 0.2（300ms）+ 混响
  - TTS 朗读 segue 内容
  - 实时语音波形 Canvas
  - 朗读完毕恢复增益（600ms）
- 组件: VoiceOverlay 已创建但未连接 segue 触发

## 三、聊天系统升级

### 3.1 消息分流引擎（设计文档 §消息分流引擎）
- 路由: `/api/dispatch` 统一入口
- 分类: 简单指令(直接执行) / 音乐操作(NCM API) / 自然语言(Claude)
- 前端: IntentInput 组件需改用 dispatch 接口

### 3.2 结构化 Claude 回复（设计文档 §Claude 回复结构化协议）
- 格式: `{say, reason, play, segue}`
- `say` + `reason` → 文字气泡
- `segue` → 语音波形条（可点击播放）
- `play` → 歌曲卡片（▶ 播放 / + 添加）
- 现状: ChatArea 只显示纯文本

### 3.3 聊天内嵌歌曲卡片（设计文档 §聊天内嵌歌曲卡片）
- 可交互: ▶ 替换播放 / + 添加到队列
- 无直链处理: 灰色遮罩 + 禁用按钮 + "暂无音源"
- 需新增: SongCard 组件嵌入 ChatMessage

### 3.4 四层配置体系
- 缺失: `agent.md`（Claudio 核心人设 prompt）
- 需创建: `config/agent.md`
- 服务端: 启动时加载 4 个 md → 拼装 system prompt

## 四、后端服务

### 4.1 定时任务调度器
- 每日歌单推荐（07:00）: Claude + taste.md + 历史 → 推荐歌单
- 每小时情绪检查: moodrules.md + 时间 + 聊天记录 → 情绪标签
- 需: node-cron 依赖 + scheduler 服务

### 4.2 音乐品味画像
- 每日生成: Claude 以 DJ 口吻写品味总结
- 存储: SQLite `preferences` 表 (key: `taste_profile`)
- 展示: Claudio 头像弹出面板

### 4.3 播放历史记录
- 歌曲播放时记录: song_id, name, artist, album, cover, played_at
- API: GET/POST `/api/history`

### 4.4 聊天记录持久化
- SQLite `chat_messages` 表
- API: GET `/api/chat/history`

## 五、执行计划

### Phase 1 — 视觉修复（CC-1）🔴 用户首要痛点
- 修 FluidBlobs 对称布局
- 修 AudioVisualizer: opacity/颜色/mode 切换可见
- 修 BorderGlow: 动态颜色
- 加底部频谱条
- 加封面律动光效

### Phase 2 — 聊天升级（CC-2）
- /api/dispatch 消息分流
- 结构化回复解析
- 歌曲卡片组件
- agent.md + 四层 prompt 拼装

### Phase 3 — 交互补齐（CC-3）
- 封面 ↔ 歌词 3D 翻转
- DJ 语音模式连接 segue
- 头像弹出面板

### Phase 4 — 后端服务（CC-4）
- 定时任务 + 品味画像 + 历史记录
