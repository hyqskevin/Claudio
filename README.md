<div align="center">

<img src="docs/images/screenshot-player.png" width="900" alt="Claudio AI Radio">

# 🎧 Claudio — AI Music Radio

**你的私人 AI 音乐电台 · 看场景选歌 · 会说话的 DJ · 封面色随动**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=googlechrome&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

把多年歌单蒸馏成一个会看场景、会说话、会选歌的个人 AI 电台。

Claudio 通过 **MiniMax M3**（主）+ **Kimi/Moonshot**（备）LLM 链根据你的口味、天气、时段和实时指令生成播放计划与 DJ 串词，再由 **MiniMax TTS**（主）+ **Fish Audio**（备）合成语音播报，带来沉浸式电台体验。所有 LLM/TTS provider 自动 failover，单家挂掉不中断。

</div>

---

## ✨ Features

<div align="center">

| | Feature | Description |
|:---:|:---|:---|
| 🤖 | **AI DJ 串词** | MiniMax M3 自动生成主持词、天气提醒、音乐介绍，TTS 语音播报 |
| 🎯 | **场景感知** | 结合天气、时段、日程动态调整音乐风格和推荐 |
| 💬 | **自然语言点歌** | 输入「来点适合写代码的歌」即可调整播放风格 |
| 🎶 | **网易云音乐** | 搜索、播放、逐字歌词、歌单管理、收藏、版权受限歌曲 yt-dlp 兜底 |
| 🎨 | **6 种音频可视化** | Glob / Flower / Arcs / Circles / Wave / Shine |
| 📊 | **封面色频谱** | 频谱颜色跟随封面主题色实时变化，3-stop 渐变 |
| 🖱️ | **鼠标跟随光效** | Cursor Glow 随封面主色变化的光晕跟随鼠标移动 |
| 🎤 | **逐字歌词** | 网易云风格渐变扫描效果，rAF 驱动，零卡顿 |
| 🌙 | **深色/浅色主题** | 一键切换，全面适配 |
| 📱 | **PWA 支持** | 安装到桌面/手机，MediaSession 锁屏控制 |
| 🔒 | **本地私有化** | 核心服务运行在本地，数据全部本地保存 |

</div>

---

## 📸 Screenshots

<div align="center">

### 🎧 播放器 — 深色主题

<img src="docs/images/screenshot-player.png" width="800" alt="Player - Dark Theme">

*封面旋转 · 逐字歌词 · 实时频谱 · 封面色跟随 · 鼠标光效*

</div>

<div align="center">

### 🤖 AI 对话 & 🎵 歌曲侧边栏

<img src="docs/images/screenshot-ai-chat.png" width="49%" alt="AI Chat Sidebar">
<img src="docs/images/screenshot-song-sidebar.png" width="49%" alt="Song Sidebar">

*自然语言点歌 · 歌曲卡片 · 一键播放 · 队列管理 · 6种可视化模式*

</div>

<div align="center">

### 🌅 浅色主题 & ⚙️ 设置页面

<img src="docs/images/screenshot-light-theme.png" width="49%" alt="Light Theme">
<img src="docs/images/screenshot-settings.png" width="49%" alt="Settings">

</div>

<div align="center">

### 📋 歌单 · 历史 · 个人品味

<img src="docs/images/screenshot-ncm-playlist.png" width="32%" alt="Playlist">
<img src="docs/images/screenshot-history.png" width="32%" alt="History">
<img src="docs/images/screenshot-profile.png" width="32%" alt="Profile">

</div>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Frontend (React 19 + Vite)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Player   │ │ Playlist │ │ Profile  │ │   Settings       ││
│  │ Page     │ │ Page     │ │ Page     │ │   Page           ││
│  └────┬─────┘ └──────────┘ └──────────┘ └──────────────────┘│
│       │  Zustand Store · WebSocket · AudioPlayer             │
│       │  KaraokeLyrics · SpectrumBars · CursorGlow            │
│       │  AudioVisualizer (6 modes) · FluidBlobs · Particles   │
│       │  i18n (EN/ZH 切换) · Theme · PWA                      │
└───────┼──────────────────────────────────────────────────────┘
        │ HTTP + WebSocket
┌───────┴──────────────────────────────────────────────────────┐
│                  Backend (Fastify + TypeScript)                │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ LLM Router   │ │ TTS      │ │ NCM      │ │ Weather  │    │
│  │ MiniMax →    │ │ MiniMax  │ │ Music    │ │ Service  │    │
│  │ Kimi → Mock  │ │ → Fish   │ │ (+yt-dlp)│ │          │    │
│  └──────────────┘ └──────────┘ └──────────┘ └──────────┘    │
│       SQLite (better-sqlite3) · Cron Scheduler · TTS Warmup  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **yt-dlp**（用于 NCM 兜底）：`brew install yt-dlp`
- **MiniMax API Key**（[申请](https://api.minimaxi.com/)）— 必需
- 网易云音乐 Cookie（可选，用于每日推荐）

### 安装 & 启动

```bash
# 克隆仓库
git clone https://github.com/hllqkb/Claudio.git
cd Claudio

# 安装依赖
pnpm install

# 配置环境变量
cp apps/server/.env.example apps/server/.env
# 编辑 .env，填入 MINIMAX_API_KEY（必需）和其他可选 key

# 一键启动 🎵
./start.sh
```

启动后访问:

| 服务 | 地址 |
|:---|:---|
| **前端** | http://localhost:5173 |
| **后端** | http://localhost:8080 |
| **NCM 代理** | http://localhost:3000 |

### 环境变量

| 变量 | 说明 | 必填 |
|:---|:---|:---:|
| `SERVER_PORT` | 后端端口（默认 `8080`） | ❌ |
| `DATABASE_URL` | SQLite 文件 URL（当前代码仍使用固定路径，见项目评估） | ❌ |
| `MINIMAX_API_KEY` | MiniMax API Key（同时用于 LLM 和 TTS） | ✅ |
| `MINIMAX_BASE_URL` | LLM 端点（默认 `https://api.minimaxi.com/anthropic`） | ❌ |
| `MINIMAX_MODEL` | LLM 模型（默认 `MiniMax-M3`） | ❌ |
| `MINIMAX_TTS_VOICE_ID` | TTS 音色（默认 `male-qn-qingse`） | ❌ |
| `MINIMAX_TTS_MODEL` | TTS 模型（默认 `speech-01-turbo`） | ❌ |
| `MINIMAX_TTS_ENDPOINT` | MiniMax TTS 端点（默认 `https://api.minimaxi.com/v1/t2a_v2`） | ❌ |
| `KIMI_API_KEY` | Moonshot Kimi API Key（LLM 备用 provider） | ❌ |
| `KIMI_BASE_URL` | Kimi 端点（默认 `https://api.moonshot.cn/v1`） | ❌ |
| `KIMI_MODEL` | Kimi 模型（默认 `moonshot-v1-8k`） | ❌ |
| `FISH_AUDIO_API_KEY` | Fish Audio TTS Key（TTS 备用 provider） | ❌ |
| `FISH_AUDIO_VOICE_ID` | Fish Audio 音色 ID | ❌ |
| `NCM_API_BASE_URL` | 网易云代理地址（默认 `http://localhost:3000`） | ❌ |
| `NCM_UID` | 网易云用户 ID（我的歌单等接口使用） | ❌ |
| `NCM_COOKIE` / `ncm_cookie` | 网易云音乐 Cookie（每日推荐 / 我的歌单；本地配置，不要提交） | ❌ |
| `OPENWEATHER_API_KEY` | OpenWeather API Key（留空走 wttr.in） | ❌ |
| `OPENWEATHER_CITY` | 天气城市（`.env.example` 为 `Shanghai`，当前代码默认 `Jiangxi`） | ❌ |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书日历（可选） | ❌ |

**Provider 优先级**（自动 fallback）：

- **LLM**: MiniMax M3 → Kimi/Moonshot → Mock
- **TTS**: MiniMax TTS → Fish Audio → Mock

只需填 `MINIMAX_API_KEY` 就能跑。Kimi/Fish/网易云/天气/飞书都是可选，按需启用。

---

## 📁 Project Structure

```
Claudio/
├── apps/
│   ├── server/                    # Fastify 后端
│   │   ├── src/
│   │   │   ├── routes/            # API 路由 (dispatch, audio, playlist, profile...)
│   │   │   ├── services/          # 业务逻辑
│   │   │   │   ├── claude.service.ts    # LLM Router (MiniMax + Kimi) + 计划生成
│   │   │   │   ├── tts.service.ts       # TTS (MiniMax + Fish Audio fallback)
│   │   │   │   ├── tts-warmup.ts        # 启动时预合成 15 条常用 DJ 短语
│   │   │   │   ├── ncm.service.ts       # 网易云音乐 API
│   │   │   │   ├── scheduler.service.ts # Cron 定时任务
│   │   │   │   ├── weather.service.ts   # 天气服务
│   │   │   │   └── context.service.ts   # 用户画像 + 场景上下文
│   │   │   ├── db/                # SQLite 数据仓库
│   │   │   └── index.ts           # 入口
│   │   ├── ncm-server.mjs         # 网易云代理 (yt-dlp fallback)
│   │   └── .env                   # 环境变量
│   └── web/                       # React 前端
│       ├── src/
│       │   ├── pages/             # 页面
│       │   │   ├── PlayerPage.tsx       # 主播放器
│       │   │   ├── PlaylistPage.tsx     # 歌单 (收藏 + 网易云)
│       │   │   ├── ProfilePage.tsx      # 个人品味 (统计 + 偏好编辑)
│       │   │   ├── SettingsPage.tsx     # 设置 (服务分组卡片)
│       │   │   └── HistoryPage.tsx      # 播放历史
│       │   ├── components/        # UI 组件
│       │   │   ├── KaraokeLyrics.tsx    # 逐字歌词 (渐变扫描)
│       │   │   ├── SpectrumBars.tsx     # 封面色频谱分析
│       │   │   ├── AudioVisualizer.tsx  # 6 种音频可视化
│       │   │   ├── CursorGlow.tsx       # 鼠标跟随光效
│       │   │   ├── FluidBlobs.tsx       # 流体背景
│       │   │   ├── ParticleCanvas.tsx   # 粒子特效
│       │   │   ├── ChatArea.tsx         # AI 对话
│       │   │   └── SongCard.tsx         # 歌曲卡片
│       │   ├── stores/            # Zustand 状态管理
│       │   ├── audio/             # AudioPlayer 引擎
│       │   ├── api/               # API 客户端 + WebSocket
│       │   ├── utils/             # 工具 (colorExtractor, voiceSynth)
│       │   ├── i18n/              # 国际化 (中/英)
│       │   └── styles/            # 全局 CSS (5000+ 行)
│       └── vite.config.ts
├── start.sh                       # 一键启动脚本
├── CLAUDE.md                      # Claude Code 项目规范
└── pnpm-workspace.yaml
```

---

## 🎨 Design System

| Token | Dark | Light |
|:---|:---|:---|
| Primary | `#5ee8c5` | `#0d9488` |
| Background | `#0a0a0f` | `#f8f9fa` |
| Card | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.02)` |
| Text Primary | `#e2e8f0` | `#1a1a2e` |
| Text Secondary | `#94a3b8` | `#64748b` |
| Border | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |

> **动态主题色**: 每首歌切换时，`extractColors` 从封面提取 3 色 (primary/secondary/accent)，
> 自动更新 `--color-primary` 等 CSS 变量，频谱、光效、背景全部跟随变化。

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 19 · Vite · Zustand · PWA · TypeScript |
| **Backend** | Fastify · WebSocket · TypeScript |
| **Database** | SQLite (better-sqlite3) |
| **AI (LLM)** | MiniMax M3 (主) + Kimi/Moonshot (备) — LlmRouter 链式 failover |
| **Music** | 网易云音乐 + UnblockNeteaseMusic + yt-dlp 兜底 |
| **TTS** | MiniMax TTS (主, 国内) + Fish Audio (备) + Edge TTS 兼容 |
| **Package** | pnpm workspace (monorepo) |

---

## 📖 Key Concepts

### 🎤 Karaoke Lyrics
逐字歌词使用 `background-clip: text` + CSS `--progress` 变量实现网易云风格渐变扫描效果。rAF 驱动的直接 DOM 更新确保零 React 重渲染，丝滑不卡顿。

### 📊 Cover-Color Spectrum
实时频谱分析采用对数频率映射，中间 = 低频 bass，外侧 = 高频 treble。
每 0.5s 从封面提取的 `--color-primary/secondary/accent` 读取颜色，3-stop 渐变渲染每根 bar。
快速上升 (attack 0.9) + 快速下降 (release 0.15) 确保频谱紧贴音乐节拍。

### 🖱️ Cursor Glow
鼠标光效使用 300px 径向模糊 + `mix-blend-mode: screen`，颜色跟随封面主色，
lerp 平滑跟随 (0.12 系数)，不遮挡内容。

### 🤖 AI Planning
LLM 链根据当前场景（天气/时段/用户偏好）生成播放计划，自动插入 DJ 串词。默认走 MiniMax M3（Anthropic-compat at api.minimaxi.com），挂了自动切 Kimi/Moonshot（OpenAI-compat at api.moonshot.cn）。DJ 串词通过 MiniMax TTS（国内 hex-encoded MP3）合成，挂了切 Fish Audio。

### ⚡ TTS Warmup
服务启动时并发预合成 15 条常用 DJ 短语（问候、转场、场景、心情），写入 `apps/server/cache/tts/`。这些短语命中时 <10ms 返回（vs 首次 ~1s），首次播放 DJ 介绍几乎无延迟。

### 🎨 Color Extraction
封面图片通过 Canvas + K-Means (k=3) 聚类提取主色调，`boostSaturation` 确保提取色足够鲜艳。
自动设置 `--color-primary/secondary/accent` CSS 变量，全组件响应式跟随。

---

## 🤝 Contributing

```bash
# 开发模式启动
pnpm dev

# 构建
pnpm --filter @ai-radio/web build
pnpm --filter @ai-radio/server build

# 当前可用验证
pnpm typecheck
pnpm build

# 代码规范
# - TypeScript strict mode
# - 4-space indent
# - Conventional Commits (feat:, fix:, docs:, chore:)
```

> 当前仓库还没有 `pnpm test`。在修复队列、settings、播放状态、代理接口等涉及前后端契约的模块时，应优先补充对应的 contract tests（如 queue 序列化、settings 脱敏、cover 代理白名单等）。

## 🧭 Project Health

`pnpm typecheck` 和 `pnpm build` 当前可通过，但**项目目前不适合暴露到局域网或生产环境**。

当前软件工程评估见 [docs/project-assessment.md](docs/project-assessment.md)，其中记录了已确认的安全、配置、API contract、播放状态和测试覆盖问题。在上线或暴露到局域网前，必须至少先处理其中的 P0/P1 项：移除已提交的 Cookie 并轮换会话、修复 Settings 密钥脱敏与覆盖问题、限制 `/api/cover` 代理白名单、统一队列与播放状态 API 序列化形态。

---

## 📄 License

MIT © [hllqkb](https://github.com/hllqkb)

---

<div align="center">

**Made with ❤️ and AI**

[GitHub](https://github.com/hllqkb/Claudio) · [Report Bug](https://github.com/hllqkb/Claudio/issues) · [Request Feature](https://github.com/hllqkb/Claudio/issues)

</div>
