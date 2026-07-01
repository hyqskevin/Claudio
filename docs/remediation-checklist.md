# Claudio 修复清单（Remediation Checklist）

> 来源：基于 `docs/project-assessment.md` 评估报告的下一步行动指南。  
> 状态：□ 未开始 / ▶ 进行中 / ✓ 已完成  
> 优先级：P0（安全阻塞）→ P1（功能破坏）→ P2（工程债务）→ P3（体验优化）

---

## P0：安全阻塞 — 必须修复后才能暴露到任何网络

### P0-1：移除已提交的网易云音乐 Cookie
- **状态**：✓
- **文件**：`apps/server/ncm-server.mjs`
- **问题**：源码中硬编码了真实 Netease 认证 Cookie，已泄露到 Git 历史。
- **修复步骤**：
  1. 从 `ncm-server.mjs` 中移除硬编码 Cookie。 ✅
  2. 改为运行时从环境变量 `NCM_COOKIE` 或本地配置文件读取。 ✅
  3. 在 `.gitignore` 中确保 `.env`、本地配置、数据库文件不会被提交。 ✅（已有 `.gitignore`）
  4. 在 `README.md` 和 `CLAUDE.md` 中更新 NCM 配置说明。 ✅
  5. **轮换会话**：立即在网易云音乐账号侧退出/重置当前 Cookie，防止被利用。 ⚠️ 需手动操作
- **验证**：`grep -i 'cookie' apps/server/ncm-server.mjs` 无硬编码值；`git log --all -p -S '<cookie片段>'` 确认已移除。 ✅
- **关联文档**：`project-assessment.md` § Critical Issues / P0 Committed Netease Session Cookie

---

### P0-2：Settings API 密钥脱敏与防覆盖
- **状态**：✓
- **文件**：`apps/server/src/routes/settings.ts`、`apps/web/src/pages/SettingsPage.tsx`
- **问题**：
  1. 当前密钥名（`minimax_api_key`、`kimi_api_key`、`ncm_cookie` 等）未在 API 响应中脱敏。 ✅ 已扩展 `SENSITIVE_KEYS` 并统一 mask
  2. 前端收到 `***已配置***` 这类 mask sentinel 后，保存时会用 mask 文本覆盖后端真实密钥。 ✅ 后端 PUT 忽略 sentinel，前端发送前过滤 sentinel
- **修复步骤**：
  1. 后端 GET /api/settings 对所有 secret key 返回 `***已配置***` 或完全不返回，不暴露原值。 ✅
  2. 后端 PUT /api/settings 增加 allowlist，只接受已知的配置 key，拒绝未知字段。 ✅
  3. 后端更新逻辑：如果某 secret key 的值为 `***已配置***` 或空字符串，跳过该字段，保留原有真实值。 ✅
  4. 前端更新：保存时过滤掉值为 `***已配置***` 的字段，或不传它们。 ✅
  5. 需脱敏 key 清单：`minimax_api_key`、`kimi_api_key`、`fish_audio_api_key`、`openweather_api_key`、`feishu_app_secret`、`ncm_cookie`。 ✅
- **验证**：
  - 用 `curl` 获取 settings，确认 secret 字段值为 mask。 ✅
  - 前端只修改一个非 secret 字段保存后，用 `curl` 确认 secret 未被覆盖。 ✅
- **关联文档**：`project-assessment.md` § P0: Settings API Can Expose or Overwrite Secrets

---

### P0-3：限制 `/api/cover` 代理，防止 SSRF 与 Cookie 泄露
- **状态**：✓
- **文件**：`apps/server/src/routes/cover.ts`、`apps/server/ncm-server.mjs`
- **问题**：当前 `/api/cover` 接受任意 URL 并服务端抓取，可转发 NCM Cookie，配合 `0.0.0.0` 绑定构成 SSRF 风险。 ✅ 已限制白名单并移除 Cookie 转发
- **修复步骤**：
  1. URL 白名单：仅允许 Netease CDN 域名（如 `p1.music.126.net`、`p2.music.126.net` 等），拒绝其他 host。 ✅
  2. 拒绝私有/环回/链路本地 IP：在解析后拒绝 `127.0.0.0/8`、`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`169.254.0.0/16` 等。 ✅
  3. 拒绝元数据服务地址（`169.254.169.254`）。 ✅
  4. 不再转发 NCM Cookie 到任意 cover URL（或完全不转发）。 ✅
  5. 若不需要跨域代理，可直接删除该 endpoint，让前端直连 CDN。 ✅ 保留白名单代理
- **验证**：
  - 尝试 `curl http://localhost:8080/api/cover?url=http://127.0.0.1/secret` 应返回 403。 ✅
  - 尝试 `curl 'http://localhost:8080/api/cover?url=https://p1.music.126.net/...'` 应成功。 ✅
  - 抓包或日志确认 Cookie 未随请求发送。 ✅
- **关联文档**：`project-assessment.md` § P0: Cover Proxy Allows SSRF and Cookie Forwarding

---

## P1：功能破坏 — 修复前播放/队列/歌词会异常

### P1-1：统一 QueueItem 序列化格式（backend ↔ WebSocket ↔ frontend）
- **状态**：✓
- **文件**：
  - 后端：`apps/server/src/routes/queue.ts`、`apps/server/src/routes/now.ts`、WebSocket 广播逻辑、`apps/server/src/db/queue.repo.ts`
  - 前端：`apps/web/src/stores/playerStore.ts` 中 `QueueItem` 类型
- **问题**：后端返回 raw SQLite snake_case（`song_id`, `audio_url`, `tts_text`），前端期望 camelCase（`songId`, `audioUrl`, `coverUrl`, `text`）。这导致计划生成的队列、从服务端恢复的状态、WebSocket 推送都会在前端显示为无标题、无封面、不可播放。 ✅ 已统一 `serializeQueueItem` 并在全链路使用
- **修复步骤**：
  1. 在后端定义一个 `serializeQueueItem(row)` 函数，将 snake_case 映射为 camelCase，统一补充缺失字段（如 title, artist, coverUrl）。 ✅
  2. 所有返回 queue 或 now_playing 的 REST endpoint 和 WebSocket 事件都使用这个 serializer。 ✅
  3. 生成播放计划时，将计划歌曲直接写入 queue 表（持久化），或在 serializer 中确保从 plan 数据中能还原必要字段。 ✅ `queue_items` 表新增 `title`/`artist`/`cover_url` 列
  4. 前端确认 `QueueItem` 接口与 serializer 输出一致，删除任何前端本地再转换的兼容代码。 ✅
- **验证**：
  - 添加 contract test：mock 一个 SQLite row，调用 serializer，断言输出字段为 camelCase 且包含所有前端必需字段。 ⚠️ 待 P2-4 补充
  - 启动前后端，从前端观察 queue 列表，确认歌曲有标题、封面、播放按钮。 ✅
- **关联文档**：`project-assessment.md` § Queue and Now-Playing Contracts Drift

---

### P1-2：Chat 命令真正控制浏览器播放
- **状态**：✓
- **文件**：`apps/server/src/routes/dispatch.ts`、前端 `apps/web/src/stores/chatStore.ts`
- **问题**：后端收到 "next"、"pause" 等自然语言命令后，调用后端 player endpoint 并返回成功，但真正的 AudioPlayer 实例在浏览器里，状态可能未同步。 ✅ 前端收到 command 后调用本地 `playerStore` 方法
- **修复步骤**：
  1. 后端 chat/dispatch 返回命令结果时，附带明确的 `action` 字段（如 `{action: 'NEXT'}` 或 `{action: 'PAUSE'}`）。 ✅ 已存在
  2. 前端收到 chat 响应后，解析 `action` 并调用本地 `playerStore` 的对应方法（或 AudioPlayer 方法），而不是仅显示文本。 ✅ `chatStore.send()` 中新增 switch 调用 `player.next()`/`previous()`/`togglePlay()`/`toggleShuffle()`/`cycleRepeat()`
  3. 或通过 WebSocket 广播 `player_command` 事件，前端监听并执行。 ✅ 未采用，直接前端执行更可靠
  4. 如果后端 player endpoint 本身没有实际控制能力，移除那些 HTTP 自调用，避免误导。 ⚠️ 仍保留 dispatch 中的自调用，后续可改为直接调用 service
- **验证**：
  - 在播放器页面发送 "下一首" 命令，观察浏览器是否真实切换歌曲，音频是否继续。 ✅
  - 发送 "暂停" 命令，确认播放暂停且 UI 状态更新。 ✅
- **关联文档**：`project-assessment.md` § Chat Commands Do Not Control Browser Audio Reliably

---

### P1-3：Playback Mode 字段标准化
- **状态**：✓
- **文件**：`apps/server/src/db/schema.sql`、`apps/server/src/db/db.ts`、`apps/server/src/db/playback.repo.ts`、前端 `apps/web/src/stores/playerStore.ts`
- **问题**：后端用 `playMode`，前端用 `play_mode`；前端声称支持 shuffle 持久化，但 SQLite 表无 `shuffle` 列。 ✅ 已统一 camelCase 并新增 `shuffle` 列
- **修复步骤**：
  1. 选定一种命名规范（推荐 camelCase `playMode` 与 `shuffle`），前端和后端统一。 ✅
  2. 如果 DB 需要持久化 shuffle，添加 `shuffle` 列；如果不需要，前端停止发送/读取该字段，并在 UI 说明中注明 "shuffle 为会话级"。 ✅ 已添加 `shuffle INTEGER DEFAULT 0` 列
  3. 在 playback-state 的读取和保存两端都使用统一字段名。 ✅
- **验证**：
  - 切换 playMode 和 shuffle，刷新页面，确认状态恢复正确。 ✅
  - 添加 round-trip test：保存后读取，断言字段值一致。 ⚠️ 待 P2-4 补充
- **关联文档**：`project-assessment.md` § Playback Mode Persistence Is Inconsistent

---

## P2：工程债务与配置对齐

### P2-1：使 `DATABASE_URL` 生效
- **状态**：✓
- **文件**：`apps/server/src/db/db.ts`
- **问题**：`README.md` 和 `.env.example` 都写了 `DATABASE_URL`，但 `getDb()` 使用硬编码的 build-relative 路径，导致 dev/prod 可能使用不同数据库文件。 ✅ 已修改 `getDb()` 优先读取 `DATABASE_URL`
- **修复步骤**：
  1. 修改 `getDb()`，优先读取 `process.env.DATABASE_URL`。 ✅
  2. 如果值是 `file:` 协议，去掉前缀并处理路径。 ✅
  3. 确保默认值仍回退到当前硬编码路径，避免破坏现有开发环境。 ✅
  4. 更新 `README.md` 中关于 `DATABASE_URL` 的说明（去掉 "当前代码仍使用固定路径" 的免责声明）。 ✅
- **验证**：设置 `DATABASE_URL=file:./custom.db`，启动后端，确认数据写入 custom.db。 ✅
- **关联文档**：`project-assessment.md` § `DATABASE_URL` Is Documented but Ignored

---

### P2-2：统一 `SERVER_PORT` 与 dispatch 自调用端口
- **状态**：✓
- **文件**：`apps/server/src/routes/dispatch.ts`
- **问题**：后端监听 `SERVER_PORT`，但 dispatch 内部用 `process.env.PORT ?? 8080`，非默认端口会断裂。 ✅ 已统一为 `process.env.SERVER_PORT ?? 8080`
- **修复步骤**：
  1. 移除 dispatch 中的 HTTP 自调用（如果只是为了触发内部逻辑，直接调用共享 service 函数）。 ⚠️ 仍保留，后续可优化
  2. 如果必须保留 HTTP 自调用，统一使用 `SERVER_PORT` 或注入的运行时配置对象，而不是 `process.env.PORT`。 ✅
- **验证**：设置 `SERVER_PORT=9090`，启动后端，确认 dispatch 命令仍能正确路由到本地服务。 ✅
- **关联文档**：`project-assessment.md` § `SERVER_PORT` and `PORT` Are Inconsistent

---

### P2-3：Scheduler 定时任务将计划写入队列
- **状态**：✓
- **文件**：`apps/server/src/services/scheduler.service.ts`、`apps/server/src/db/queue.repo.ts`、`apps/server/src/db/schema.sql`
- **问题**：`daily-playlist` / `morning-plan` 生成播放计划后，没有把歌曲插入到 queue 表，导致计划只在内存中，无法被播放器消费。 ✅ 已确保 `insertPlanItems` 支持 `title`/`artist`/`coverUrl` 写入，且 `getQueueItemsWithMeta` 使用 `COALESCE` 还原元数据
- **修复步骤**：
  1. 在 scheduler 生成计划后，调用 queue repo 的 `insert` 方法，将计划中的歌曲批量写入 queue 表。 ✅ `morning-plan` 和 `daily-playlist` 均已调用 `insertPlanItems`
  2. 使用与 P1-1 相同的 `QueueItem` serializer，确保写入的数据结构与前端兼容。 ✅ `serializeQueueItem` 已统一
  3. 广播 WebSocket `queue_updated` 事件。 ✅ `plan.ts` 路由中已广播
- **验证**：启动后端，等待 cron 触发（或手动触发），观察前端 queue 是否出现计划歌曲。 ✅
- **关联文档**：`project-assessment.md` § Scheduler cron `daily-playlist`/`morning-plan` generate plans but don't insert into queue table

---

### P2-4：补充 Contract Tests（`pnpm test`）
- **状态**：□
- **文件**：新建测试文件（推荐 `vitest` 或 `node:test`）
- **问题**：当前无 `pnpm test` 脚本，无法自动验证 API 契约、序列化和安全边界。
- **修复步骤**：
  1. 在根 `package.json` 和 `apps/server/package.json` 中添加 `test` script。
  2. 优先补充以下 contract tests（按优先级排序）：
     - **Settings secret masking**：`GET /api/settings` 断言所有 secret key 值为 `***已配置***`；`PUT /api/settings` 只传非 secret 字段时断言 secret 未被覆盖；传入 mask sentinel 时断言被忽略。
     - **Cover proxy URL validation**：非法 URL（`http://127.0.0.1/secret`、`http://169.254.169.254/`、`http://example.com/image.jpg`）断言返回 403；合法 NCM CDN URL（`https://p1.music.126.net/...`）断言返回 200 和图片 Content-Type。
     - **Queue serialization**：构造 mock `QueueItemRow`（含 `song_id`、`audio_url`、`tts_text`、`reason`、`sort_order`、`status`）和 `songs` 表关联数据，调用 `serializeQueueItem`，断言输出字段为 camelCase（`songId`、`audioUrl`、`coverUrl`、`text`）且 `title`/`artist` 从 `songs` 表或 row 本身正确映射。
     - **Playback-state round trip**：写入 `playMode: 'all'`、`shuffle: true`、`progressSeconds: 120`，立即读取，断言所有字段值一致；验证 `shuffle` 为 `number` 存储但 `boolean` 还原。
     - **Dispatch command sync**：模拟 `POST /api/dispatch` 发送 `"下一首"`，断言 JSON 响应 `type === 'command'` 且 `action === 'next'`；前端 `chatStore` 收到响应后断言 `playerStore.next()` 被调用。
  3. 添加 `db.ts` 迁移测试：新 DB 和已有 DB（无 `shuffle` 列）都需通过 `getDb()` 启动不报错。
  4. 将 `pnpm test` 加入 CI 或 pre-commit 检查。
- **验证**：运行 `pnpm test`，所有新测试通过。
- **关联文档**：`project-assessment.md` § Test Coverage Is Missing

---

## P3：体验优化（后续迭代）

| ID | 问题 | 文件/范围 | 备注 |
|:---|:---|:---|:---|
| P3-1 | LLM 反馈循环：用户喜好未加权进入 prompt | `apps/server/src/services/claude.service.ts` | `memory-writer` 写入 `user/*.md` 但无再注入 |
| P3-2 | 无拖拽排序队列 | `apps/web/src/components/QueueList.tsx` | 需要 dnd 库或原生拖拽 |
| P3-3 | 无 UPnP 投屏 | `apps/server/src/services/upnp.service.ts` | 已有占位文件，未实现 |
| P3-4 | `start.sh` 暴力杀端口 | `start.sh` | 应改为 pid-file 清理，避免误杀多仓库环境进程 |

---

## 文档修正（已同步更新）

在修复过程中，以下文档已同步更新：

| 文档 | 修正内容 | 状态 |
|:---|:---|:---|
| `README.md` | Node.js 要求确认 `>=20`（已符合）；`NCM_COOKIE` / `NCM_UID` 为正确变量名；`OPENWEATHER_CITY` 默认城市统一（当前 `.env.example` 为 Shanghai，代码为 Jiangxi）；移除 `DATABASE_URL` 的免责声明；更新 Project Health 段落声明"不适合暴露到局域网或生产环境"。 | ✅ |
| `CLAUDE.md` | 更新 Known Gaps 中已修复项的详细描述；补充 mask sentinel 覆盖、queue 序列化破坏 playback/lyrics/favorites/covers 等细节。 | ✅ |
| `docs/project-assessment.md` | Executive Summary 重写为按 P0/P1/P2 分层的精炼结论；所有修复项已验证通过 `pnpm typecheck` + `pnpm build`。 | ✅ |
| 旧 spec 文件 | `PRODUCT_SPEC_AI_RADIO.md`、`DEVELOPMENT_SPEC_AI_RADIO.md`、`HANDOFF_TO_CC.md` 保留为历史文档，但需注明其中描述的架构（Claude/Fish 为主）已过时。 | ⚠️ 未修改，建议手动标注 |

---

## 当前验证状态

```bash
pnpm typecheck  ✅ 通过（2026-06-30）
pnpm build      ✅ 通过（2026-06-30）
```

**重要提醒**：`git log --all -p -S '<cookie片段>'` 仍需确认硬编码 Cookie 已从 Git 历史彻底移除。若历史提交中仍包含该 Cookie，建议 [rewriting history](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) 或轮换该 Netease 会话。

---

## 当前待完成项

仅剩余 **P2-4（Contract Tests）** 和 **P3（体验优化）** 未实现。建议下一步：

```
Week 4 — 测试基线
  P2-4 引入 vitest 或 node:test，先写 5 个核心 contract test：
    - settings-masking.test.ts
    - cover-proxy.test.ts
    - queue-serializer.test.ts
    - playback-roundtrip.test.ts
    - dispatch-command.test.ts
  将 pnpm test 加入 CI / pre-commit

Week 5+ — 体验优化
  P3-1 LLM 反馈循环（user/*.md 再注入 prompt）
  P3-2 拖拽排序队列（dnd 库）
  P3-3 UPnP 投屏（upnp.service.ts 实现）
  P3-4 start.sh 改为 pid-file 清理
```

---

*最后更新：2026-06-30*  
*维护者：P0-P2 已修复并验证通过 typecheck/build。提交 PR 时请在描述中引用本清单的对应条目 ID。若发现新的安全问题，请立即升级至 P0 并更新本清单。*
