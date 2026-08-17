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
3. **Pull Request**: If a new version is found, it updates `package.json` and opens a pull request. Auto-merge completes after the required `test` check passes.
4. **Deployment**: Merging into `main` triggers a new deployment on Vercel.
5. **Notifications**: You receive a Telegram notification with the target version, the pull request URL, and an AI-generated summary of the upgrade highlights.

#### Stale Repository Warning

GitHub automatically disables scheduled workflows in repositories that have been inactive for 60 days. To prevent this:

- The workflow checks if the last commit was more than 50 days ago.
- If so, it sends a **Warning Notification** to Telegram.
- **Action Required**: If you receive this warning, manually trigger the workflow or merge a small pull request (for example a README tweak) to keep the repository active.

### Configuration

To enable notifications, you must configure the following **Repository Secrets** in GitHub (`Settings` -> `Secrets and variables` -> `Actions`):

| Secret Name | Description |
| :--- | :--- |
| `TELEGRAM_TOKEN` | Your Telegram Bot Token (from @BotFather). |
| `TELEGRAM_TO` | The Chat ID (user or channel) where notifications should be sent. |
| `OPENAI_API_KEY` | API key for your OpenAI-compatible endpoint, used to summarize release notes. |
| `OPENAI_BASE_URL` | API root such as `https://api.openai.com/v1`. A full path like `https://api.openai.com/v1/responses` or `https://api.openai.com/v1/chat/completions` is stripped back to the API root, then tried as Responses first and Chat Completions second. |
| `OPENAI_MODEL` | Model name used to generate the upgrade summary. |
| `VERCEL_TOKEN` | Team-scoped Vercel token used by the deployment workflow. |
| `VERCEL_ORG_ID` | ID of the existing Vercel team that owns the project. |
| `VERCEL_PROJECT_ID` | ID of the existing Vercel project. |
| `RULESET_TOKEN` | Optional repository-admin PAT used by the **Apply main ruleset** workflow. The default `GITHUB_TOKEN` cannot create or update rulesets. |

The upgrade summary first calls the official [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) (`POST /v1/responses`), with `instructions` plus `input` as documented by OpenAI. If that endpoint is unavailable, it falls back to Chat Completions (`POST /v1/chat/completions`), including when `OPENAI_BASE_URL` is already a full endpoint path. If the OpenAI-compatible configuration is unavailable or both requests fail, the workflow still sends a basic Telegram notification with the version number and release links.

### Manual Trigger

You can manually trigger the update check at any time:

1. Go to the **Actions** tab.
2. Select **Auto Update Twikoo**.
3. Click **Run workflow**.

### Branch Protection

`main` is protected by the repository ruleset defined in [`.github/rulesets/main.json`](.github/rulesets/main.json):

- Direct pushes, force-pushes, and deleting `main` are blocked.
- Changes must go through a pull request.
- The `test` check from the **CI** workflow must pass, and the branch must be up to date with `main`.
- Approving reviews are not required, so a single maintainer or an auto-merge bot PR can land after CI.

GitHub does not let the Actions app bypass rulesets on a user-owned repository, so auto-updates open a pull request instead of pushing `main`. Re-apply the ruleset after editing the JSON:

```bash
bash .github/scripts/apply-ruleset.sh
```

Or run the **Apply main ruleset** workflow after adding `RULESET_TOKEN`.

---

<a name="chinese"></a>

## 中文

本仓库包含在 Vercel 上部署 [Twikoo](https://twikoo.js.org/) 的配置。

### 自动更新

本仓库包含一个 GitHub Action 工作流 (`.github/workflows/auto-update.yml`)，用于自动保持您的 Twikoo 实例为最新版本。

#### 工作原理

1. **每日检查**：工作流每天 UTC 时间午夜自动运行。
2. **检测更新**：检查 `twikoo-vercel` 依赖是否有新版本。
3. **Pull Request**：如果发现新版本，它会更新 `package.json` 并打开 pull request。所需的 `test` 检查通过后，自动合并会完成。
4. **部署**：合并到 `main` 后会触发 Vercel 的新部署。
5. **通知**：您会收到 Telegram 通知，其中会包含目标版本号、pull request 链接，以及 AI 生成的升级重点摘要。

#### 仓库活跃度警告

GitHub 会自动禁用 60 天未活跃仓库的定时工作流。为了防止这种情况：

- 工作流会检查上一次提交是否超过 50 天。
- 如果超过，它会发送一条 **警告通知** 到 Telegram。
- **需要操作**：如果您收到此警告，请手动触发一次工作流，或合并一个小的 pull request（例如更新 README），以保持仓库活跃。

### 配置

要启用通知，您必须在 GitHub 中配置以下 **仓库密钥 (Repository Secrets)** (`Settings` -> `Secrets and variables` -> `Actions`)：

| 密钥名称 | 描述 |
| :--- | :--- |
| `TELEGRAM_TOKEN` | 您的 Telegram Bot Token (从 @BotFather 获取)。 |
| `TELEGRAM_TO` | 接收通知的 Chat ID (用户 ID 或频道 ID)。 |
| `OPENAI_API_KEY` | OpenAI 兼容接口的 API Key，用于总结升级说明。 |
| `OPENAI_BASE_URL` | API 根地址，例如 `https://api.openai.com/v1`。如果写成完整路径，例如 `https://api.openai.com/v1/responses` 或 `https://api.openai.com/v1/chat/completions`，会先还原成 API root，再按 Responses 优先、Chat Completions 回退的顺序尝试。 |
| `OPENAI_MODEL` | 用于生成升级摘要的模型名称。 |
| `VERCEL_TOKEN` | 部署工作流使用的 Vercel 团队级 Token。 |
| `VERCEL_ORG_ID` | 现有 Vercel 项目所属团队的 ID。 |
| `VERCEL_PROJECT_ID` | 现有 Vercel 项目的 ID。 |
| `RULESET_TOKEN` | 可选。仓库管理员 PAT，供 **Apply main ruleset** 工作流使用。默认的 `GITHUB_TOKEN` 无法创建或更新 ruleset。 |

升级摘要会先调用官方 [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)（`POST /v1/responses`），请求体使用文档中的 `instructions` 与 `input`。若该端点不可用，再回退到 Chat Completions（`POST /v1/chat/completions`），即使 `OPENAI_BASE_URL` 已经是完整 endpoint 路径也一样。如果 OpenAI 兼容接口未配置，或两次调用都失败，工作流仍会发送基础 Telegram 通知，并附带版本号与发布说明链接。

### 手动触发

您可以随时手动触发更新检查：

1. 进入 **Actions** 标签页。
2. 选择 **Auto Update Twikoo**。
3. 点击 **Run workflow**。

### 分支保护

`main` 由 [`.github/rulesets/main.json`](.github/rulesets/main.json) 中的仓库规则集保护：

- 禁止直接推送、强制推送和删除 `main`。
- 变更必须通过 pull request。
- 必须通过 **CI** 工作流中的 `test` 检查，并且分支需要与 `main` 保持同步。
- 不要求人工批准，因此单独维护者或开启自动合并的机器人 PR 可以在 CI 通过后合入。

GitHub 不允许在用户个人仓库里把 Actions 应用加入 ruleset bypass，所以自动更新会打开 pull request，而不是直接推送 `main`。修改 JSON 后重新应用规则集：

```bash
bash .github/scripts/apply-ruleset.sh
```

也可以在配置 `RULESET_TOKEN` 后运行 **Apply main ruleset** 工作流。
