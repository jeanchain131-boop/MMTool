const EPISODE_NUMBER_PATTERN =
  "[0-9零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+";

const MISSEVAN_MAIN_INCLUDE_PATTERNS = [
  new RegExp(`第\\s*${EPISODE_NUMBER_PATTERN}\\s*[集话期章节卷]`, "u"),
  /(?:^|\s)ep\.?\s*[0-9]+/i,
  /(?:^|\s)e[0-9]{1,3}(?:\D|$)/i,
  /番外/u,
  /ova/i,
];

const MISSEVAN_MAIN_EXCLUDE_PATTERNS = [
  /预告/u,
  /花絮/u,
  /采访/u,
  /主题曲/u,
  /片头曲/u,
  /片尾曲/u,
  /福利/u,
  /彩蛋/u,
  /PV/i,
  /CM/i,
  /OST/i,
  /OP/i,
  /ED/i,
];

const MANBO_MAIN_INCLUDE_PATTERNS = [
  /(?:^|[^\w])EP\s*0*[0-9]+/i,
  new RegExp(`第\\s*${EPISODE_NUMBER_PATTERN}\\s*[期集话章节卷]`, "u"),
  /番外/u,
];

const MANBO_MAIN_EXCLUDE_PATTERNS = [
  /预告/u,
  /花絮/u,
  /采访/u,
  /FT/i,
  /倒计时/u,
  /主题曲/u,
  /小剧场/u,
];

const MISSEVAN_OVERFLOW_DANMAKU_COUNTS = new Set([12000, 25000, 35000]);

export function isMainEpisode(platform, episode) {
  const name = String(episode?.name || "").trim();
  const includes = platform === "manbo"
    ? MANBO_MAIN_INCLUDE_PATTERNS
    : MISSEVAN_MAIN_INCLUDE_PATTERNS;
  const excludes = platform === "manbo"
    ? MANBO_MAIN_EXCLUDE_PATTERNS
    : MISSEVAN_MAIN_EXCLUDE_PATTERNS;

  return (
    includes.some((pattern) => pattern.test(name))
    && !excludes.some((pattern) => pattern.test(name))
  );
}

export function isMissevanLikelyDanmakuOverflow({ danmaku, episodeTitle }) {
  return (
    isMainEpisode("missevan", { name: episodeTitle })
    && MISSEVAN_OVERFLOW_DANMAKU_COUNTS.has(Number(danmaku ?? 0))
  );
}

export function isPaidEpisode(platform, episode) {
  if (platform === "manbo") {
    return Number(episode?.pay_type ?? 0) === 1 || Number(episode?.price ?? 0) > 0;
  }

  return (
    episode?.need_pay === true
    || episode?.need_pay === 1
    || episode?.need_pay === "1"
    || Number(episode?.price ?? 0) > 0
  );
}

export function isMemberEpisode(platform, episode) {
  if (platform === "manbo") {
    return Number(episode?.vip_free ?? 0) === 1;
  }

  return (
    episode?.vip_free === true
    || episode?.vip_free === 1
    || episode?.vip_free === "1"
  );
}
