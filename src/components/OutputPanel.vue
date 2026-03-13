<template>
  <div class="output-panel">
    <div class="output-status-card">
      <div class="status-header">
        <div>
          <div class="status-kicker">运行状态</div>
          <div class="status-text">{{ currentAction || "等待执行操作" }}</div>
          <div class="status-elapsed">处理用时：{{ formatElapsed(elapsedMs) }}</div>
        </div>
        <div class="status-side">
          <div v-if="isRunning" class="status-badge">进行中</div>
          <div class="status-progress">{{ progress }}%</div>
        </div>
      </div>

      <div class="output-progress">
        <div class="output-progress-bar" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>

    <div v-if="playCountResults.length" class="output-section">
      <div class="output-section-title">播放量统计</div>
      <div class="output-list">
        <div
          v-for="drama in playCountResults"
          :key="`play-${drama.title}`"
          class="output-card"
        >
          <div class="output-card-title">
            {{ drama.title }} / 已选 {{ drama.selectedEpisodeCount }} 集
          </div>
          <div class="output-stat-label">总播放量</div>
          <div class="output-stat-value">
            {{ formatPlayCountDisplay(drama.playCountTotal, drama.playCountFailed) }}
          </div>
        </div>

        <div class="output-summary-card">
          <div class="output-card-title">汇总 / 已选 {{ playCountSelectedEpisodeCount }} 集</div>
          <div class="output-stat-label">总播放量</div>
          <div class="output-stat-value">
            {{ formatPlayCountDisplay(playCountTotal, playCountFailed) }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="idResults.length" class="output-section">
      <div class="output-section-title">弹幕与去重 ID 统计</div>
      <div class="output-list">
        <div
          v-for="drama in idResults"
          :key="`id-${drama.title}`"
          class="output-card"
        >
          <div class="output-card-title">
            {{ drama.title }} / 已选 {{ drama.selectedEpisodeCount }} 集
          </div>
          <div class="output-stats">
            <div>
              <div class="output-stat-label">总弹幕数</div>
              <div class="output-stat-value">{{ drama.danmaku }}</div>
            </div>
            <div>
              <div class="output-stat-label">去重 ID 数</div>
              <div class="output-stat-value">{{ drama.users }}</div>
            </div>
          </div>
        </div>

        <div class="output-summary-card">
          <div class="output-card-title">汇总 / 已选 {{ idSelectedEpisodeCount }} 集</div>
          <div class="output-stats">
            <div>
              <div class="output-stat-label">总弹幕数</div>
              <div class="output-stat-value">{{ totalDanmaku }}</div>
            </div>
            <div>
              <div class="output-stat-label">去重 ID 数</div>
              <div class="output-stat-value">{{ totalUsers }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="revenueResults.length" class="output-section">
      <div class="output-section-title">最低收益预估</div>
      <div class="output-list">
        <div
          v-for="drama in revenueResults"
          :key="`revenue-${drama.dramaId}`"
          class="output-card"
        >
          <div class="output-card-title">
            {{ drama.title }} / 单价 {{ formatDiamond(drama.price) }}
          </div>
          <div class="output-stats">
            <div>
              <div class="output-stat-label">付费用户 ID 数</div>
              <div class="output-stat-value">
                {{ drama.failed ? "访问失败" : drama.paidUserCount }}
              </div>
            </div>
            <div>
              <div class="output-stat-label">打赏榜总额</div>
              <div class="output-stat-value">
                {{ drama.failed ? "访问失败" : formatDiamond(drama.rewardCoinTotal) }}
              </div>
            </div>
          </div>
          <div class="output-revenue-line">
            <div class="output-stat-label">最低收益</div>
            <div class="output-stat-value">
              {{ drama.failed ? "预估失败" : formatRevenue(drama.estimatedRevenueYuan) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    progress: Number,
    currentAction: String,
    elapsedMs: Number,
    playCountResults: Array,
    playCountSelectedEpisodeCount: Number,
    playCountTotal: Number,
    playCountFailed: Boolean,
    idResults: Array,
    idSelectedEpisodeCount: Number,
    totalDanmaku: Number,
    totalUsers: Number,
    revenueResults: Array,
    isRunning: Boolean,
  },
  methods: {
    formatPlayCountDisplay(value, failed) {
      if (failed) {
        return "部分分集统计失败";
      }
      const count = Number(value ?? 0);
      if (!Number.isFinite(count) || count <= 0) {
        return "0";
      }
      if (count < 10000) {
        return `${count}`;
      }
      if (count < 100000000) {
        return `${(count / 10000).toFixed(1)}万`;
      }
      return `${(count / 100000000).toFixed(2)}亿`;
    },
    formatDiamond(value) {
      return `${Number(value ?? 0)} 钻石`;
    },
    formatRevenue(value) {
      const amount = Number(value ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return "0 元";
      }
      if (amount >= 100000000) {
        return `${(amount / 100000000).toFixed(2)} 亿元`;
      }
      if (amount >= 10000) {
        return `${(amount / 10000).toFixed(1)} 万元`;
      }
      return `${Math.round(amount)} 元`;
    },
    formatElapsed(value) {
      const totalSeconds = Math.max(0, Math.floor(Number(value ?? 0) / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
      }

      return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    },
  },
};
</script>

<style scoped>
.output-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.output-status-card,
.output-card,
.output-summary-card {
  padding: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(29, 53, 87, 0.08);
  border-radius: 16px;
}

.output-status-card {
  background:
    linear-gradient(135deg, rgba(255, 241, 235, 0.9), rgba(255, 255, 255, 0.86));
  border-color: rgba(207, 92, 54, 0.12);
}

.status-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.status-kicker {
  margin-bottom: 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-text {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.status-elapsed {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.status-side {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-badge {
  padding: 4px 10px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  background: linear-gradient(135deg, #2f5d7c, #244962);
  border-radius: 999px;
}

.status-progress {
  color: var(--accent-strong);
  font-size: 20px;
  font-weight: 800;
}

.output-progress {
  height: 12px;
  overflow: hidden;
  background: rgba(207, 92, 54, 0.12);
  border-radius: 999px;
}

.output-progress-bar {
  height: 100%;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  border-radius: inherit;
}

.output-section {
  display: grid;
  gap: 10px;
}

.output-section-title {
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
}

.output-list {
  display: grid;
  gap: 10px;
}

.output-summary-card {
  background: rgba(238, 244, 251, 0.8);
  border-color: rgba(47, 93, 124, 0.12);
}

.output-card-title {
  margin-bottom: 10px;
  font-weight: 700;
  line-height: 1.5;
}

.output-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.output-stat-label {
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.output-stat-value {
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
}

.output-revenue-line {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(29, 53, 87, 0.1);
}

@media (max-width: 640px) {
  .output-panel {
    padding: 14px;
  }

  .status-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-side {
    width: 100%;
    justify-content: space-between;
  }

  .output-stats {
    grid-template-columns: 1fr;
  }
}
</style>
