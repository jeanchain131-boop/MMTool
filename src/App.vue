<template>
  <div class="landing-shell">
    <header class="hero">
      <div class="hero-top">
        <div>
          <p class="hero-eyebrow">M&M Toolkit Gateway</p>
          <h1 class="hero-title">小猫小狐数据分析</h1>
        </div>
        <div class="hero-version">v{{ frontendVersion }}</div>
      </div>

      <div class="hero-actions">
        <button
          class="primary-action"
          type="button"
          :disabled="!recommendedRegion || !recommendedRegion.canOpen || wakeupState.pending"
          @click="openRegion(recommendedRegion)"
        >
          {{ primaryActionLabel }}
        </button>
        <button
          class="secondary-action"
          type="button"
          :disabled="wakeupState.pending"
          @click="refreshAllRegions"
        >
          刷新节点状态
        </button>
      </div>
    </header>

    <section class="region-grid" aria-label="区域状态">
      <article
        v-for="region in regionCards"
        :key="region.key"
        :class="['region-card', `is-${region.statusTone}`, { 'is-recommended': recommendedRegion?.key === region.key }]"
      >
        <div class="region-card-top">
          <div>
            <p class="region-label">{{ region.label }}</p>
            <h3 class="region-status">{{ region.statusTitle }}</h3>
          </div>
          <span v-if="recommendedRegion?.key === region.key" class="region-pill">推荐</span>
        </div>

        <dl class="region-meta">
          <div class="meta-row">
            <dt>版本</dt>
            <dd>{{ region.versionText }}</dd>
          </div>
          <div class="meta-row">
            <dt>Missevan</dt>
            <dd>{{ region.enableText }}</dd>
          </div>
          <div class="meta-row">
            <dt>Manbo</dt>
            <dd>{{ region.manboText }}</dd>
          </div>
          <div class="meta-row">
            <dt>下一次受限尝试</dt>
            <dd>{{ region.cooldownText }}</dd>
          </div>
        </dl>

        <div class="region-actions">
          <button
            class="card-action"
            type="button"
            :disabled="!region.canOpen || wakeupState.pending"
            @click="openRegion(region)"
          >
            {{ region.actionLabel }}
          </button>
        </div>
      </article>
    </section>

    <div v-if="wakeupState.visible" class="wakeup-backdrop" @click.self="dismissWakeupState">
      <section class="wakeup-card" aria-live="polite">
        <div class="wakeup-badge">{{ wakeupState.pending ? "正在唤醒节点" : "节点暂未就绪" }}</div>
        <h2 class="wakeup-title">{{ wakeupState.title }}</h2>
        <p class="wakeup-text">{{ wakeupState.detail }}</p>
        <p v-if="wakeupState.error" class="wakeup-error">{{ wakeupState.error }}</p>
        <div class="wakeup-actions">
          <button
            v-if="wakeupState.canRetry"
            class="primary-action"
            type="button"
            @click="retryWakeup"
          >
            再试一次
          </button>
          <button class="secondary-action" type="button" @click="dismissWakeupState">
            {{ wakeupState.pending ? "先返回首页" : "关闭" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVersion(value) {
  const normalized = String(value ?? "").trim();
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : "0.0.0";
}

function getDefaultGatewayConfig() {
  return {
    desktopApp: false,
    hostedDeployment: false,
  };
}

function normalizeRegionBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function createRegionState(key, label, baseUrl) {
  return {
    key,
    label,
    baseUrl,
    loading: Boolean(baseUrl),
    requestFailed: false,
    requestError: "",
    missevanEnabled: false,
    cooldownUntil: 0,
    cooldownHours: 0,
    frontendVersion: "0.0.0",
    desktopApp: false,
    versionMismatch: false,
    requestToken: 0,
  };
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

export default {
  props: {
    appConfig: {
      type: Object,
      default: () => getDefaultGatewayConfig(),
    },
  },
  data() {
    const frontendVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
    const area1Url = normalizeRegionBaseUrl(import.meta.env.VITE_REGION_AREA1_URL);
    const area2Url = normalizeRegionBaseUrl(import.meta.env.VITE_REGION_AREA2_URL);
    const area3Url = normalizeRegionBaseUrl(import.meta.env.VITE_REGION_AREA3_URL);

    return {
      frontendVersion: normalizeVersion(frontendVersion),
      regions: [
        createRegionState("area1", "节点1", area1Url),
        createRegionState("area2", "节点2", area2Url),
        createRegionState("area3", "节点3", area3Url),
      ],
      wakeupState: {
        visible: false,
        pending: false,
        regionKey: "",
        title: "",
        detail: "",
        error: "",
        canRetry: false,
      },
      wakeupAttemptId: 0,
      wakeupAbortController: null,
    };
  },
  computed: {
    regionCards() {
      return this.regions.map((region) => {
        const hasConfig = Boolean(region.baseUrl);
        const isCoolingDown = hasConfig && Number(region.cooldownUntil ?? 0) > Date.now();
        const isReady = hasConfig && !region.requestFailed;
        const canOpen = hasConfig;
        const cooldownText = !hasConfig
          ? "未配置"
          : region.requestFailed
            ? "状态获取失败"
            : isCoolingDown
              ? this.formatCooldownRemaining(region.cooldownUntil)
              : "可用";
        const statusTone = !hasConfig
          ? "muted"
          : region.requestFailed
            ? "error"
            : "ok";
        const statusTitle = !hasConfig
          ? "未配置节点"
          : region.requestFailed
            ? "状态获取失败"
            : "节点可访问";
        return {
          ...region,
          isCoolingDown,
          isReady,
          canOpen,
          cooldownText,
          statusTone,
          statusTitle,
          versionText: region.requestFailed || !hasConfig
            ? "--"
            : normalizeVersion(region.frontendVersion),
          enableText: !hasConfig
            ? "未配置"
            : region.requestFailed
              ? "未知"
              : region.missevanEnabled
                ? "已启用"
                : "未启用",
          manboText: !hasConfig ? "未配置" : "可用",
          actionLabel: !canOpen
            ? "暂不可用"
            : this.wakeupState.pending && this.wakeupState.regionKey === region.key
              ? "正在唤醒..."
              : "进入该节点",
        };
      });
    },
    recommendedRegion() {
      const availableRegions = this.regionCards.filter(
        (region) => region.isReady && region.missevanEnabled && !region.isCoolingDown
      );
      if (availableRegions.length > 0) {
        return this.pickPreferredRegion(availableRegions);
      }

      const readyRegions = this.regionCards.filter((region) => region.isReady);
      if (readyRegions.length > 0) {
        return this.pickPreferredRegion(readyRegions);
      }

      const configuredRegions = this.regionCards.filter((region) => region.baseUrl);
      if (configuredRegions.length > 0) {
        return this.pickPreferredRegion(configuredRegions);
      }

      return this.pickPreferredRegion(this.regionCards.filter((region) => region.baseUrl)) || null;
    },
    primaryActionLabel() {
      if (!this.recommendedRegion) {
        return "请先配置节点地址";
      }
      if (this.wakeupState.pending) {
        return "正在唤醒节点...";
      }
      if (this.recommendedRegion.canOpen) {
        return `直接进入 ${this.recommendedRegion.label}`;
      }
      return `${this.recommendedRegion.label} 当前不可用`;
    },
  },
  mounted() {
    this.refreshAllRegions();
  },
  methods: {
    buildRegionAppConfigUrl(baseUrl) {
      const frontendVersion = encodeURIComponent(this.frontendVersion);
      return `${baseUrl}/app-config?frontendVersion=${frontendVersion}`;
    },
    buildRegionEntryUrl(baseUrl) {
      return `${baseUrl}/tool`;
    },
    applyRegionConfig(region, data) {
      region.missevanEnabled = data.missevanEnabled !== false;
      region.cooldownUntil = Number(data.cooldownUntil ?? 0) || 0;
      region.cooldownHours = Number(data.cooldownHours ?? 0) || 0;
      region.frontendVersion = normalizeVersion(data.frontendVersion ?? "0.0.0");
      region.desktopApp = data.desktopApp === true;
      region.versionMismatch = Boolean(data.versionMismatch);
    },
    async fetchRegionConfig(region, timeoutMs = 12000, controller = null) {
      const activeController = controller
        || (typeof AbortController !== "undefined" ? new AbortController() : null);
      const timeoutId = activeController
        ? window.setTimeout(() => activeController.abort(), timeoutMs)
        : null;

      try {
        const response = await fetch(this.buildRegionAppConfigUrl(region.baseUrl), {
          cache: "no-store",
          signal: activeController?.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } finally {
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
        }
      }
    },
    pickPreferredRegion(regions) {
      const preferredOrder = ["area1", "area2", "area3"];
      return preferredOrder
        .map((key) => regions.find((region) => region.key === key))
        .find(Boolean) || regions[0] || null;
    },
    formatCooldownRemaining(until) {
      const remainingMs = Math.max(0, Number(until ?? 0) - Date.now());
      if (!remainingMs) {
        return "可用";
      }
      const totalMinutes = Math.ceil(remainingMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours <= 0) {
        return `${minutes} 分钟`;
      }
      if (minutes === 0) {
        return `${hours} 小时`;
      }
      return `${hours} 小时 ${minutes} 分钟`;
    },
    async refreshRegion(region) {
      if (!region.baseUrl) {
        region.loading = false;
        region.requestFailed = false;
        region.requestError = "";
        return;
      }

      const requestToken = region.requestToken + 1;
      region.requestToken = requestToken;
      region.loading = true;
      region.requestFailed = false;
      region.requestError = "";

      try {
        const data = await this.fetchRegionConfig(region);
        if (requestToken !== region.requestToken) {
          return;
        }
        this.applyRegionConfig(region, data);
      } catch (error) {
        if (requestToken !== region.requestToken || isAbortError(error)) {
          return;
        }
        region.requestFailed = true;
        region.requestError = error instanceof Error ? error.message : String(error);
      } finally {
        if (requestToken === region.requestToken) {
          region.loading = false;
        }
      }
    },
    async refreshAllRegions() {
      await Promise.all(this.regions.map((region) => this.refreshRegion(region)));
    },
    getRegionByKey(key) {
      return this.regions.find((region) => region.key === key) || null;
    },
    dismissWakeupState() {
      this.wakeupAttemptId += 1;
      this.wakeupAbortController?.abort();
      this.wakeupAbortController = null;
      this.wakeupState = {
        visible: false,
        pending: false,
        regionKey: "",
        title: "",
        detail: "",
        error: "",
        canRetry: false,
      };
    },
    async retryWakeup() {
      const region = this.getRegionByKey(this.wakeupState.regionKey);
      if (!region) {
        this.dismissWakeupState();
        return;
      }
      await this.openRegion(region);
    },
    async waitForRegionWakeup(region, attemptId) {
      const maxAttempts = 6;
      let lastError = "";

      for (let index = 0; index < maxAttempts; index += 1) {
        if (attemptId !== this.wakeupAttemptId) {
          return false;
        }

        this.wakeupState = {
          visible: true,
          pending: true,
          regionKey: region.key,
          title: `正在唤醒 ${region.label}`,
          detail: `节点可能正在从 Render 休眠中恢复，通常需要 10-60 秒。当前是第 ${index + 1} 次检查。`,
          error: "",
          canRetry: false,
        };

        try {
          this.wakeupAbortController = typeof AbortController !== "undefined"
            ? new AbortController()
            : null;
          const requestToken = region.requestToken + 1;
          region.requestToken = requestToken;
          const data = await this.fetchRegionConfig(region, 15000, this.wakeupAbortController);
          if (attemptId !== this.wakeupAttemptId) {
            return false;
          }
          if (requestToken !== region.requestToken) {
            continue;
          }
          region.requestFailed = false;
          region.requestError = "";
          region.loading = false;
          this.applyRegionConfig(region, data);
          this.wakeupAbortController = null;
          return true;
        } catch (error) {
          if (attemptId !== this.wakeupAttemptId) {
            return false;
          }
          if (isAbortError(error)) {
            return false;
          }
          lastError = error instanceof Error ? error.message : String(error);
          this.wakeupAbortController = null;
          region.loading = false;
          region.requestFailed = true;
          region.requestError = lastError;
        }

        if (index < maxAttempts - 1) {
          await sleep(4000);
        }
      }

      if (attemptId === this.wakeupAttemptId) {
        this.wakeupState = {
          visible: true,
          pending: false,
          regionKey: region.key,
          title: `${region.label} 还没有完全唤醒`,
          detail: "节点可能仍在冷启动中。你可以继续重试，或者稍后再回来进入这个节点。",
          error: lastError ? `最近一次检查结果：${lastError}` : "",
          canRetry: true,
        };
      }

      return false;
    },
    async openRegion(region) {
      if (!region?.baseUrl || typeof window === "undefined" || this.wakeupState.pending) {
        return;
      }
      const liveRegion = this.getRegionByKey(region.key) || region;
      if (liveRegion.loading || liveRegion.requestFailed) {
        const attemptId = this.wakeupAttemptId + 1;
        this.wakeupAttemptId = attemptId;
        const awakened = await this.waitForRegionWakeup(liveRegion, attemptId);
        if (!awakened || attemptId !== this.wakeupAttemptId) {
          return;
        }
        this.dismissWakeupState();
      }
      window.location.assign(this.buildRegionEntryUrl(region.baseUrl));
    },
  },
};
</script>

<style>
:root {
  color-scheme: light;
  --page-bg:
    radial-gradient(circle at top left, rgba(28, 126, 214, 0.1), transparent 32%),
    radial-gradient(circle at bottom right, rgba(207, 92, 54, 0.12), transparent 28%),
    linear-gradient(180deg, #f4efe5 0%, #eef5fb 38%, #fbfcfe 100%);
  --panel-bg: rgba(255, 255, 255, 0.88);
  --panel-border: rgba(29, 53, 87, 0.1);
  --panel-shadow: 0 18px 45px rgba(31, 43, 58, 0.08);
  --text-strong: #1f2a37;
  --text-muted: #5d7186;
  --accent: #cf5c36;
  --accent-strong: #b54c28;
  --info: #2f5d7c;
  --ok: #1f7a56;
  --warning: #9b6b00;
  --error: #b13a29;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--text-strong);
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--page-bg);
}

button {
  font: inherit;
}

.landing-shell {
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 28px 18px 64px;
}

.hero,
.region-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  box-shadow: var(--panel-shadow);
}

.hero {
  padding: 26px 28px;
  border-radius: 28px;
}

.hero-top {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1.08;
}

.hero-version {
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(29, 53, 87, 0.08);
  border-radius: 999px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.primary-action,
.secondary-action,
.card-action {
  min-height: 44px;
  padding: 11px 18px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 14px;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.primary-action,
.card-action {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  border: none;
}

.secondary-action {
  color: var(--info);
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(47, 93, 124, 0.18);
}

.primary-action:hover:not(:disabled),
.secondary-action:hover:not(:disabled),
.card-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.primary-action:disabled,
.secondary-action:disabled,
.card-action:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.region-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
}

.region-card.is-recommended {
  border-color: rgba(207, 92, 54, 0.28);
  box-shadow: 0 22px 50px rgba(207, 92, 54, 0.12);
}

.region-card.is-ok {
  background:
    linear-gradient(180deg, rgba(247, 255, 251, 0.96), rgba(255, 255, 255, 0.88));
}

.region-card.is-warning {
  background:
    linear-gradient(180deg, rgba(255, 249, 235, 0.98), rgba(255, 255, 255, 0.88));
}

.region-card.is-error,
.region-card.is-disabled,
.region-card.is-muted {
  background:
    linear-gradient(180deg, rgba(250, 251, 253, 0.98), rgba(255, 255, 255, 0.88));
}

.region-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.region-label {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.region-status {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
}

.region-pill {
  padding: 7px 10px;
  color: #8a2d18;
  font-size: 12px;
  font-weight: 800;
  background: rgba(255, 241, 235, 0.92);
  border: 1px solid rgba(207, 92, 54, 0.16);
  border-radius: 999px;
}

.region-meta {
  display: grid;
  gap: 10px;
  margin: 0;
}

.meta-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 14px;
}

.meta-row dt {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
}

.meta-row dd {
  margin: 0;
  font-weight: 600;
  word-break: break-word;
}

.region-actions {
  margin-top: auto;
}

.card-action {
  width: 100%;
}

.wakeup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  padding: 18px;
  place-items: center;
  background: rgba(18, 28, 39, 0.32);
  backdrop-filter: blur(8px);
}

.wakeup-card {
  width: min(520px, 100%);
  padding: 24px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(29, 53, 87, 0.12);
  border-radius: 24px;
  box-shadow: 0 26px 56px rgba(31, 43, 58, 0.16);
}

.wakeup-badge {
  display: inline-flex;
  padding: 6px 10px;
  color: var(--info);
  font-size: 12px;
  font-weight: 800;
  background: rgba(47, 93, 124, 0.1);
  border-radius: 999px;
}

.wakeup-title {
  margin: 14px 0 8px;
  font-size: 28px;
  line-height: 1.15;
}

.wakeup-text,
.wakeup-error {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.wakeup-error {
  margin-top: 10px;
  color: var(--error);
}

.wakeup-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

@media (max-width: 760px) {
  .landing-shell {
    padding: 16px 12px 44px;
  }

  .hero,
  .region-card {
    border-radius: 20px;
  }

  .hero {
    padding: 20px 18px;
  }

  .hero-top {
    display: grid;
  }

  .hero-title {
    font-size: 30px;
  }

  .hero-actions {
    display: grid;
  }

  .region-grid {
    grid-template-columns: 1fr;
  }

  .wakeup-card {
    padding: 20px 18px;
    border-radius: 20px;
  }

  .wakeup-title {
    font-size: 24px;
  }

  .wakeup-actions {
    display: grid;
  }
}
</style>
