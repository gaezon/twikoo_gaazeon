# Twikoo Vercel Deployment / Twikoo Vercel 部署

[English](#english) | [中文](#chinese)

<a name="english"></a>

## English

This repository contains the configuration for deploying [Twikoo](https://twikoo.js.org/) on Vercel.

### Automatic Updates

This repository includes a GitHub Action workflow (`.github/workflows/auto-update.yml`) that automatically keeps your Twikoo instance up to date.

#### How it works

1. **Daily Check**: The workflow runs automatically every day at midnight UTC.
2. **Update Detection**: It checks for new versions of the `twikoo-vercel` dependency.
3. **Auto-Commit**: If a new version is found, it updates `package.json` and commits the change.
4. **Deployment**: The commit triggers a new deployment on Vercel.
5. **Notifications**: You receive a Telegram notification upon successful update, including the target version and an AI-generated summary of the upgrade highlights.

#### Stale Repository Warning

GitHub automatically disables scheduled workflows in repositories that have been inactive for 60 days. To prevent this:

- The workflow checks if the last commit was more than 50 days ago.
- If so, it sends a **Warning Notification** to Telegram.
- **Action Required**: If you receive this warning, simply manually trigger the workflow or push a small commit (e.g., update README) to keep the repository active.

### Configuration

To enable notifications, you must configure the following **Repository Secrets** in GitHub (`Settings` -> `Secrets and variables` -> `Actions`):

| Secret Name | Description |
| :--- | :--- |
| `TELEGRAM_TOKEN` | Your Telegram Bot Token (from @BotFather). |
| `TELEGRAM_TO` | The Chat ID (user or channel) where notifications should be sent. |
| `OPENAI_API_KEY` | API key for your OpenAI-compatible endpoint, used to summarize release notes. |
| `OPENAI_BASE_URL` | API root such as `https://api.openai.com/v1`. You can also set a full path like `https://api.openai.com/v1/responses`. |
| `OPENAI_MODEL` | Model name used to generate the upgrade summary. |
| `VERCEL_TOKEN` | Team-scoped Vercel token used by the deployment workflow. |
| `VERCEL_ORG_ID` | ID of the existing Vercel team that owns the project. |
| `VERCEL_PROJECT_ID` | ID of the existing Vercel project. |

The upgrade summary first calls the official [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) (`POST /v1/responses`), with `instructions` plus `input` as documented by OpenAI. If that endpoint is unavailable, it falls back to Chat Completions (`POST /v1/chat/completions`). If the OpenAI-compatible configuration is unavailable or both requests fail, the workflow still sends a basic Telegram notification with the version number and release links.

### Manual Trigger

You can manually trigger the update check at any time:

1. Go to the **Actions** tab.
2. Select **Auto Update Twikoo**.
3. Click **Run workflow**.

---

<a name="chinese"></a>

## 中文

本仓库包含在 Vercel 上部署 [Twikoo](https://twikoo.js.org/) 的配置。

### 自动更新

本仓库包含一个 GitHub Action 工作流 (`.github/workflows/auto-update.yml`)，用于自动保持您的 Twikoo 实例为最新版本。

#### 工作原理

1. **每日检查**：工作流每天 UTC 时间午夜自动运行。
2. **检测更新**：检查 `twikoo-vercel` 依赖是否有新版本。
3. **自动提交**：如果发现新版本，它会更新 `package.json` 并提交更改。
4. **部署**：提交操作会自动触发 Vercel 的新部署。
5. **通知**：更新成功后，您会收到 Telegram 通知，其中会包含目标版本号和 AI 生成的升级重点摘要。

#### 仓库活跃度警告

GitHub 会自动禁用 60 天未活跃仓库的定时工作流。为了防止这种情况：

- 工作流会检查上一次提交是否超过 50 天。
- 如果超过，它会发送一条 **警告通知** 到 Telegram。
- **需要操作**：如果您收到此警告，只需手动触发一次工作流，或推送一个小的提交（例如更新 README），以保持仓库活跃。

### 配置

要启用通知，您必须在 GitHub 中配置以下 **仓库密钥 (Repository Secrets)** (`Settings` -> `Secrets and variables` -> `Actions`)：

| 密钥名称 | 描述 |
| :--- | :--- |
| `TELEGRAM_TOKEN` | 您的 Telegram Bot Token (从 @BotFather 获取)。 |
| `TELEGRAM_TO` | 接收通知的 Chat ID (用户 ID 或频道 ID)。 |
| `OPENAI_API_KEY` | OpenAI 兼容接口的 API Key，用于总结升级说明。 |
| `OPENAI_BASE_URL` | API 根地址，例如 `https://api.openai.com/v1`。也可以写成完整路径，例如 `https://api.openai.com/v1/responses`。 |
| `OPENAI_MODEL` | 用于生成升级摘要的模型名称。 |
| `VERCEL_TOKEN` | 部署工作流使用的 Vercel 团队级 Token。 |
| `VERCEL_ORG_ID` | 现有 Vercel 项目所属团队的 ID。 |
| `VERCEL_PROJECT_ID` | 现有 Vercel 项目的 ID。 |

升级摘要会先调用官方 [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)（`POST /v1/responses`），请求体使用文档中的 `instructions` 与 `input`。若该端点不可用，再回退到 Chat Completions（`POST /v1/chat/completions`）。如果 OpenAI 兼容接口未配置，或两次调用都失败，工作流仍会发送基础 Telegram 通知，并附带版本号与发布说明链接。

### 手动触发

您可以随时手动触发更新检查：

1. 进入 **Actions** 标签页。
2. 选择 **Auto Update Twikoo**。
3. 点击 **Run workflow**。
