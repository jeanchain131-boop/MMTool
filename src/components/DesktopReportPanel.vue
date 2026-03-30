<template>
  <div class="report-shell">
    <section class="report-hero-card">
      <div>
        <p class="section-kicker">Desktop Excel</p>
        <h2 class="section-title">模板导入与报表生成</h2>
        <p class="section-tip">
          读取 `Missevan` 与 `Manbo` 工作表，自动统计并导出六个报表 sheet。
        </p>
      </div>
      <div class="hero-actions">
        <button class="primary-btn" type="button" @click="pickTemplate" :disabled="isRunning">
          选择 Excel 模板
        </button>
        <button
          class="secondary-btn"
          type="button"
          @click="generateReport"
          :disabled="!canGenerate"
        >
          生成 Excel 报告
        </button>
      </div>
    </section>

    <section class="report-grid">
      <article class="report-card">
        <div class="card-title">当前模板</div>
        <div class="path-text">{{ selectedFilePath || "还没有选择文件" }}</div>
        <div class="meta-line">
          有效数据行：{{ parsedRows.length }}，解析失败：{{ parseErrors.length }}
        </div>
        <div v-if="savePath" class="meta-line">最近保存：{{ savePath }}</div>
      </article>

      <article class="report-card">
        <div class="card-title">运行状态</div>
        <div class="status-text">{{ currentAction || "等待选择模板" }}</div>
        <div class="meta-line">进度：{{ progress }}%</div>
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
        </div>
      </article>
    </section>

    <section class="report-grid report-grid-rows">
      <article class="report-card">
        <div class="card-title">输入概览</div>
        <div v-if="summaryRows.length" class="summary-list">
          <div v-for="item in summaryRows" :key="item.label" class="summary-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
        <div v-else class="empty-text">选择模板后会在这里展示各分类行数。</div>
      </article>

      <article class="report-card">
        <div class="card-title">失败明细</div>
        <div v-if="allFailures.length" class="failure-list">
          <div v-for="(item, index) in allFailures" :key="`${item.title}-${index}`" class="failure-item">
            <div class="failure-title">{{ item.platformLabel }} / {{ item.sheetLabel }} / {{ item.title }}</div>
            <div class="failure-detail">{{ item.error }}</div>
            <div v-if="item.dramaIds" class="failure-detail">ID: {{ item.dramaIds }}</div>
          </div>
        </div>
        <div v-else class="empty-text">当前没有失败项。</div>
      </article>
    </section>
  </div>
</template>

<script>
import { buildReportWorkbook, createEmptyGroupedRows, getOutputSheetName, parseTemplateWorkbook } from "../services/excelReport";
import { isMainEpisode, isMemberEpisode, isPaidEpisode } from "../utils/episodeRules";

function createDefaultState() {
  return {
    selectedFilePath: "",
    parsedRows: [],
    parseErrors: [],
    progress: 0,
    currentAction: "",
    isRunning: false,
    failures: [],
    savePath: "",
  };
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function formatCount(value) {
  return `${Math.max(0, Math.trunc(normalizeNumber(value, 0)))}`;
}

function formatWan(value) {
  const amount = normalizeNumber(value, 0);
  return (amount / 10000).toFixed(1);
}

function formatPriceValue(value) {
  const amount = normalizeNumber(value, 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "0";
  }
  return `${Math.round(amount * 100) / 100}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatRevenueWanYuan(value) {
  const amount = normalizeNumber(value, 0);
  return (amount / 10000).toFixed(1);
}

function formatRevenueRange(minValue, maxValue) {
  return `${formatRevenueWanYuan(minValue)} - ${formatRevenueWanYuan(maxValue)}`;
}

function formatSeriesTitle(title, totalCount) {
  const normalizedTitle = String(title ?? "").trim();
  const count = Math.max(1, Math.trunc(normalizeNumber(totalCount, 1)));
  if (!normalizedTitle) {
    return `未命名作品（${count}）`;
  }

  if (/[（(]\d+[）)]\s*$/.test(normalizedTitle)) {
    return normalizedTitle.replace(/[（(]\d+[）)]\s*$/, `（${count}）`);
  }

  return `${normalizedTitle}（${count}）`;
}

function sortResults(rows) {
  return [...rows].sort((left, right) => {
    const leftFailed = left.__status !== "success";
    const rightFailed = right.__status !== "success";
    if (leftFailed !== rightFailed) {
      return leftFailed ? 1 : -1;
    }
    return normalizeNumber(right.__sortViewCount, 0) - normalizeNumber(left.__sortViewCount, 0);
  }).map((row, index) => ({
    ...row,
    排行: `${index + 1}`,
  }));
}

export default {
  name: "DesktopReportPanel",
  props: {
    handleVersionResponse: {
      type: Function,
      default: null,
    },
  },
  data() {
    return {
      ...createDefaultState(),
      dramaCache: {
        missevan: new Map(),
        manbo: new Map(),
      },
      rewardCache: new Map(),
      rewardMetaCache: new Map(),
      danmakuCache: {
        missevan: new Map(),
        manbo: new Map(),
      },
    };
  },
  computed: {
    canGenerate() {
      return !this.isRunning && this.parsedRows.length > 0 && Boolean(this.selectedFilePath);
    },
    summaryRows() {
      const counters = new Map();
      this.parsedRows.forEach((row) => {
        const label = `${row.platform === "missevan" ? "猫耳" : "漫播"} / ${
          row.category === "paid" ? "付费" : row.category === "member" ? "会员" : "免费"
        }`;
        counters.set(label, (counters.get(label) || 0) + 1);
      });
      return Array.from(counters.entries()).map(([label, count]) => ({ label, count }));
    },
    allFailures() {
      return [
        ...this.parseErrors.map((item) => ({
          ...item,
          platformLabel: item.platform === "missevan" ? "猫耳" : "漫播",
          sheetLabel: "模板解析",
        })),
        ...this.failures,
      ];
    },
  },
  methods: {
    getDesktopApi() {
      return typeof window !== "undefined" ? window.desktopExcel : null;
    },
    normalizeVersion(value) {
      const normalized = String(value ?? "").trim();
      return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : "0.0.0";
    },
    getBackendVersionFromResponse(response, data = null) {
      const headerVersion = this.normalizeVersion(
        response?.headers?.get?.("X-Backend-Version") ?? ""
      );
      if (headerVersion !== "0.0.0") {
        return headerVersion;
      }
      return this.normalizeVersion(data?.backendVersion ?? "0.0.0");
    },
    async parseVersionedJson(response) {
      const data = await response.json();
      if (typeof this.handleVersionResponse === "function") {
        this.handleVersionResponse({
          backendVersion: this.getBackendVersionFromResponse(response, data),
        });
      }
      return data;
    },
    async pickTemplate() {
      const desktopApi = this.getDesktopApi();
      if (!desktopApi) {
        window.alert("该功能仅支持桌面版。");
        return;
      }

      const picked = await desktopApi.pickInputWorkbook();
      if (picked?.canceled || !picked?.filePath) {
        return;
      }

      this.currentAction = "正在读取模板";
      const fileResult = await desktopApi.readFile(picked.filePath);
      if (!fileResult?.success || !fileResult?.bytes) {
        this.currentAction = "模板读取失败";
        window.alert(fileResult?.error || "读取模板失败");
        return;
      }

      try {
        const parsed = await parseTemplateWorkbook(fileResult.bytes);
        this.selectedFilePath = picked.filePath;
        this.parsedRows = parsed.rows;
        this.parseErrors = parsed.parseErrors;
        this.failures = [];
        this.savePath = "";
        this.progress = 0;
        this.currentAction = parsed.rows.length > 0 ? "模板读取完成" : "模板中没有可处理的数据行";
      } catch (error) {
        this.selectedFilePath = "";
        this.parsedRows = [];
        this.parseErrors = [];
        this.failures = [];
        this.savePath = "";
        this.progress = 0;
        this.currentAction = "模板解析失败";
        window.alert(error instanceof Error ? error.message : String(error));
      }
    },
    async postJson(url, payload, signal, errorMessage) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok) {
        throw new Error(`${errorMessage}: ${response.status}`);
      }
      return this.parseVersionedJson(response);
    },
    getDramaEndpoint(platform) {
      return platform === "missevan" ? "/getdramas" : "/manbo/getdramas";
    },
    getDanmakuEndpoint(platform) {
      return platform === "missevan" ? "/getsounddanmaku" : "/manbo/getsetdanmaku";
    },
    async fetchDrama(platform, dramaId, signal) {
      const cache = this.dramaCache[platform];
      const key = String(dramaId);
      if (cache.has(key)) {
        return cache.get(key);
      }

      const payload = { drama_ids: [platform === "missevan" ? Number(dramaId) : String(dramaId)] };
      const response = await this.postJson(
        this.getDramaEndpoint(platform),
        payload,
        signal,
        "Failed to load drama"
      );
      const result = Array.isArray(response) ? response[0] : null;
      if (!result?.success || !result?.info) {
        throw new Error(`作品读取失败: ${dramaId}`);
      }
      cache.set(key, result.info);
      return result.info;
    },
    async fetchRewardSummary(dramaId, signal) {
      const key = String(dramaId);
      if (this.rewardCache.has(key)) {
        return this.rewardCache.get(key);
      }

      const result = await this.postJson(
        "/getrewardsummary",
        { drama_id: Number(dramaId) },
        signal,
        "Failed to load reward summary"
      );
      if (!result?.success) {
        throw new Error(`打赏信息读取失败: ${dramaId}`);
      }
      this.rewardCache.set(key, result);
      return result;
    },
    async fetchRewardMeta(dramaId, signal) {
      const key = String(dramaId);
      if (this.rewardMetaCache.has(key)) {
        return this.rewardMetaCache.get(key);
      }

      const result = await this.postJson(
        "/getrewardmeta",
        { drama_id: Number(dramaId) },
        signal,
        "Failed to load reward meta"
      );
      if (!result?.success) {
        throw new Error(`打赏人数读取失败: ${dramaId}`);
      }
      this.rewardMetaCache.set(key, result);
      return result;
    },
    async fetchDanmakuUsers(platform, episodeId, dramaTitle, episodeTitle, signal) {
      const cache = this.danmakuCache[platform];
      const key = String(episodeId);
      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = await this.postJson(
        this.getDanmakuEndpoint(platform),
        { sound_id: episodeId, drama_title: dramaTitle, episode_title: episodeTitle || "" },
        signal,
        "Failed to load danmaku"
      );
      if (!result?.success) {
        throw new Error(`弹幕统计失败: ${episodeId}`);
      }
      const normalized = Array.isArray(result.users) ? result.users.map((item) => String(item)) : [];
      cache.set(key, normalized);
      return normalized;
    },
    getEpisodesForRow(platform, category, dramaInfo) {
      const episodes = Array.isArray(dramaInfo?.episodes?.episode) ? dramaInfo.episodes.episode : [];
      if (category === "free") {
        return episodes.filter((episode) => isMainEpisode(platform, episode));
      }
      if (category === "member") {
        return episodes.filter((episode) => isMemberEpisode(platform, episode));
      }
      return episodes.filter((episode) => isPaidEpisode(platform, episode));
    },
    buildUniqueUsers(collections) {
      const set = new Set();
      collections.forEach((users) => {
        users.forEach((uid) => set.add(String(uid)));
      });
      return set;
    },
    async buildDramaMetrics(row, dramaInfo, signal) {
      const platform = row.platform;
      const drama = dramaInfo?.drama || {};
      const selectedEpisodes = this.getEpisodesForRow(platform, row.category, dramaInfo);
      const episodeUserEntries = [];
      for (const episode of selectedEpisodes) {
        const users = await this.fetchDanmakuUsers(
          platform,
          episode.sound_id,
          drama.name,
          episode.name,
          signal
        );
        episodeUserEntries.push({
          episode,
          users,
        });
      }

      const allUsers = this.buildUniqueUsers(episodeUserEntries.map((item) => item.users));
      const firstUsers = new Set(episodeUserEntries[0]?.users || []);
      const totalEpisodePrice = episodeUserEntries.reduce((sum, item) => {
        return sum + normalizeNumber(item.episode?.price ?? 0, 0);
      }, 0);

      const result = {
        dramaId: String(drama.id),
        dramaTitle: drama.name || row.title,
        viewCount: normalizeNumber(drama.view_count, 0),
        subscriptionCount: normalizeNumber(drama.subscription_num, 0),
        rewardTotal: 0,
        rewardCount: 0,
        giftTotal: normalizeNumber(drama.diamond_value, 0),
        allUsers,
        firstUsers,
        totalEpisodePrice,
        seasonPrice: normalizeNumber(drama.price, 0),
        memberPrice: normalizeNumber(drama.member_price, 0),
        episodeUsers: episodeUserEntries,
      };

      if (platform === "missevan") {
        const rewardSummary = await this.fetchRewardSummary(drama.id, signal);
        const rewardMeta = await this.fetchRewardMeta(drama.id, signal);
        result.rewardTotal = normalizeNumber(rewardSummary.rewardCoinTotal, 0);
        result.rewardCount = normalizeNumber(rewardMeta.reward_num, 0);
      }

      return result;
    },
    buildFailureRow(row, errorMessage) {
      const isMissevan = row.platform === "missevan";
      const common = {
        排行: "",
        标题: row.title,
        "总播放量（万）": "失败",
        __status: "failed",
        __sortViewCount: -1,
      };

      if (row.category === "free") {
        return {
          ...common,
          [isMissevan ? "全季ID（正片）" : "全季ID（正片）"]: "失败",
          [isMissevan ? "第一季ID（正片）" : "第一季ID（正片）"]: "失败",
          [isMissevan ? "追剧人次" : "收藏数"]: "失败",
        };
      }

      if (isMissevan) {
        return {
          ...common,
          "全季ID": "失败",
          "第一季ID": "失败",
          "追剧人次": "失败",
          "打赏（万钻石）": "失败",
          "打赏人次": "失败",
          ...(row.category === "paid" ? { "最低收益（万元）": "失败" } : {}),
          "总价（钻石）": errorMessage || "失败",
        };
      }

      return {
        ...common,
        "全季ID": "失败",
        "第一季ID": "失败",
        "收藏人次": "失败",
        "投喂（万红豆）": "失败",
        ...(row.category === "paid" ? { "最低收益（万元）": "失败", "总价（红豆）": errorMessage || "失败" } : {}),
      };
    },
    async buildRowResult(row, signal) {
      const successes = [];
      const errors = [];

      for (const dramaId of row.dramaIds) {
        try {
          const dramaInfo = await this.fetchDrama(row.platform, dramaId, signal);
          successes.push(await this.buildDramaMetrics(row, dramaInfo, signal));
        } catch (error) {
          errors.push({
            dramaId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (successes.length === 0) {
        throw new Error(errors.map((item) => `${item.dramaId}: ${item.error}`).join(" | "));
      }

      const isMissevan = row.platform === "missevan";
      const uniqueAllUsers = this.buildUniqueUsers(successes.map((item) => [...item.allUsers]));
      const firstDramaUsers = successes.find((item) => item.dramaId === String(row.dramaIds[0]))?.allUsers
        || new Set();
      const totalViewCount = successes.reduce((sum, item) => sum + item.viewCount, 0);
      const totalSubscriptionCount = successes.reduce((sum, item) => sum + item.subscriptionCount, 0);
      const totalReward = successes.reduce((sum, item) => sum + item.rewardTotal, 0);
      const totalRewardCount = successes.reduce((sum, item) => sum + item.rewardCount, 0);
      const totalGift = successes.reduce((sum, item) => sum + item.giftTotal, 0);
      const title = formatSeriesTitle(row.title, row.dramaIds.length);
      const partial = errors.length > 0;

      if (row.category === "free") {
        return {
          row: {
            排行: "",
            标题: title,
            "总播放量（万）": formatWan(totalViewCount),
            "全季ID（正片）": formatCount(uniqueAllUsers.size),
            "第一季ID（正片）": formatCount(firstDramaUsers.size),
            [isMissevan ? "追剧人次" : "收藏数"]: formatCount(totalSubscriptionCount),
            __status: partial ? "partial" : "success",
            __sortViewCount: totalViewCount,
          },
          failures: errors,
        };
      }

      const normalPriceTotal = successes.reduce((sum, item) => {
        return sum + (row.paymentMode === "season" || row.category === "member"
          ? item.seasonPrice
          : item.totalEpisodePrice);
      }, 0);
      const memberPriceTotal = successes.reduce((sum, item) => sum + item.memberPrice, 0);

      let revenueText = null;
      if (row.category === "paid") {
        if (row.paymentMode === "season") {
          const seasonRevenueYuan = successes.reduce((sum, item) => {
            const bonus = isMissevan ? item.rewardTotal : item.giftTotal;
            const divisorBase = isMissevan ? 10 : 100;
            return sum + ((item.allUsers.size * item.seasonPrice) + bonus) / divisorBase;
          }, 0);
          revenueText = formatRevenueWanYuan(seasonRevenueYuan);
        } else {
          const range = successes.reduce((acc, item) => {
            const bonus = isMissevan ? item.rewardTotal : item.giftTotal;
            const divisorBase = isMissevan ? 10 : 100;
            const low = item.episodeUsers.reduce((sum, entry) => {
              return sum + (entry.users.length * normalizeNumber(entry.episode?.price, 0));
            }, 0);
            acc.min += (low + bonus) / divisorBase;
            acc.max += ((item.allUsers.size * item.totalEpisodePrice) + bonus) / divisorBase;
            return acc;
          }, { min: 0, max: 0 });
          revenueText = formatRevenueRange(range.min, range.max);
        }
      }

      if (isMissevan) {
        return {
          row: {
            排行: "",
            标题: title,
            "总播放量（万）": formatWan(totalViewCount),
            "全季ID": formatCount(uniqueAllUsers.size),
            "第一季ID": formatCount(firstDramaUsers.size),
            "追剧人次": formatCount(totalSubscriptionCount),
            "打赏（万钻石）": formatWan(totalReward),
            "打赏人次": formatCount(totalRewardCount),
            ...(row.category === "paid" ? { "最低收益（万元）": revenueText } : {}),
            "总价（钻石）": row.category === "member"
              ? `${formatPriceValue(normalPriceTotal)}/${formatPriceValue(memberPriceTotal)}`
              : formatPriceValue(normalPriceTotal),
            __status: partial ? "partial" : "success",
            __sortViewCount: totalViewCount,
          },
          failures: errors,
        };
      }

      return {
        row: {
          排行: "",
          标题: title,
          "总播放量（万）": formatWan(totalViewCount),
          "全季ID": formatCount(uniqueAllUsers.size),
          "第一季ID": formatCount(firstDramaUsers.size),
          "收藏人次": formatCount(totalSubscriptionCount),
          "投喂（万红豆）": formatWan(totalGift),
          ...(row.category === "paid"
            ? {
                "最低收益（万元）": revenueText,
                "总价（红豆）": formatPriceValue(normalPriceTotal),
              }
            : {}),
          __status: partial ? "partial" : "success",
          __sortViewCount: totalViewCount,
        },
        failures: errors,
      };
    },
    addFailureRecord(row, error, dramaIds = "") {
      this.failures.push({
        platform: row.platform,
        platformLabel: row.platform === "missevan" ? "猫耳" : "漫播",
        sheetLabel: getOutputSheetName(row.platform, row.category),
        title: row.title,
        dramaIds,
        error,
      });
    },
    async generateReport() {
      const desktopApi = this.getDesktopApi();
      if (!desktopApi || this.isRunning || !this.parsedRows.length) {
        return;
      }

      const saveSelection = await desktopApi.pickSaveWorkbook("猫耳漫播统计报告.xlsx");
      if (saveSelection?.canceled || !saveSelection?.filePath) {
        return;
      }

      this.isRunning = true;
      this.progress = 0;
      this.currentAction = "开始生成报表";
      this.failures = [];
      const groupedRows = createEmptyGroupedRows();
      const controller = new AbortController();

      try {
        for (let index = 0; index < this.parsedRows.length; index += 1) {
          const row = this.parsedRows[index];
          this.currentAction = `正在统计 ${row.title}`;
          try {
            const result = await this.buildRowResult(row, controller.signal);
            groupedRows[row.platform][row.category].push(result.row);
            result.failures.forEach((item) => {
              this.addFailureRecord(row, item.error, item.dramaId);
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            groupedRows[row.platform][row.category].push(this.buildFailureRow(row, message));
            this.addFailureRecord(row, message, row.dramaIds.join(", "));
          }
          this.progress = Math.floor(((index + 1) / this.parsedRows.length) * 100);
        }

        Object.keys(groupedRows).forEach((platform) => {
          Object.keys(groupedRows[platform]).forEach((category) => {
            groupedRows[platform][category] = sortResults(groupedRows[platform][category]);
          });
        });

        this.currentAction = "正在写入 Excel 报告";
        const bytes = await buildReportWorkbook(groupedRows);
        const writeResult = await desktopApi.writeFile(saveSelection.filePath, bytes);
        if (!writeResult?.success) {
          throw new Error(writeResult?.error || "写入 Excel 失败");
        }

        this.savePath = saveSelection.filePath;
        this.currentAction = "报表生成完成";
        const openResult = await desktopApi.openFile(saveSelection.filePath);
        if (!openResult?.success && openResult?.error) {
          console.warn("Failed to open exported workbook", openResult.error);
        }
      } catch (error) {
        this.currentAction = "报表生成失败";
        window.alert(error instanceof Error ? error.message : String(error));
      } finally {
        this.isRunning = false;
      }
    },
  },
};
</script>

<style scoped>
.report-shell {
  display: grid;
  gap: 16px;
}

.report-hero-card,
.report-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(29, 53, 87, 0.08);
  border-radius: 20px;
  box-shadow: var(--panel-shadow);
}

.report-hero-card {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
}

.section-kicker,
.card-title {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-title {
  margin: 6px 0 8px;
  font-size: 24px;
  line-height: 1.2;
}

.section-tip,
.meta-line,
.empty-text,
.failure-detail {
  color: var(--text-muted);
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.primary-btn,
.secondary-btn {
  min-height: 44px;
  padding: 12px 16px;
  font-weight: 700;
  border-radius: 999px;
  cursor: pointer;
}

.primary-btn {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  border: none;
}

.secondary-btn {
  color: var(--select-text);
  background: var(--select-bg);
  border: 1px solid var(--select-border);
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.report-grid-rows {
  align-items: start;
}

.path-text,
.status-text,
.failure-title {
  margin-top: 8px;
  word-break: break-word;
}

.status-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
}

.progress-track {
  height: 10px;
  margin-top: 14px;
  overflow: hidden;
  background: rgba(29, 53, 87, 0.08);
  border-radius: 999px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  transition: width 0.2s ease;
}

.summary-list,
.failure-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(246, 250, 253, 0.9);
  border-radius: 14px;
}

.failure-item {
  padding: 12px;
  background: rgba(255, 241, 235, 0.56);
  border: 1px solid rgba(207, 92, 54, 0.12);
  border-radius: 14px;
}

@media (max-width: 900px) {
  .report-hero-card,
  .report-grid {
    grid-template-columns: 1fr;
    display: grid;
  }

  .hero-actions {
    justify-content: flex-start;
  }
}
</style>
