import type { Entry, StyleProfile, SessionState } from "./types";

const POLITE = /(です|ます|ました|でした|ですね|ますね|でしょう|ございます|お願い|すみません)/g;
const CASUAL = /(だよ|だね|じゃん|だろ|だわ|かよ|だぜ|っす|まじ|やば|うざ|きも)/g;
const HEDGE = /(と思う|かも|たぶん|多分|っぽい|気がする|かな|だろう|みたい)/g;
const CERTAIN = /(絶対|確実|明らか|間違いない|当然|完全に|必ず)/g;
const SELF = /(私|わたし|僕|ぼく|俺|おれ|うち|自分)/g;
const ACK_STARTERS = /^(うん|はい|そう|それ|わかる|たしかに|確かに|なるほど|まあ|そうだね|そっか|ふーん|へえ|なんで)/;
const EMOJI = /[\p{Extended_Pictographic}🥺]/gu;

function rate(matches: number, sample: number): number {
  if (sample === 0) return 0;
  return Math.min(1, matches / sample);
}

export function extractProfile(entries: Entry[]): StyleProfile {
  const userEntries = entries.filter((e) => e.role === "user");
  const n = userEntries.length;

  if (n === 0) {
    return {
      avgLength: 0,
      politenessRate: 0,
      casualRate: 0,
      questionToAiRate: 0,
      selfFocusRate: 0,
      ackRate: 0,
      emojiDensity: 0,
      hedgingRate: 0,
      certaintyRate: 0,
      endsWithPeriod: 0,
      exclamationRate: 0,
      shortReplyRate: 0,
    };
  }

  let totalLen = 0;
  let polite = 0;
  let casual = 0;
  let questionToAi = 0;
  let selfFocus = 0;
  let ack = 0;
  let emojiCount = 0;
  let hedge = 0;
  let certain = 0;
  let endsPeriod = 0;
  let exclam = 0;
  let shortReply = 0;

  for (let i = 0; i < userEntries.length; i++) {
    const t = userEntries[i].text;
    const len = [...t].length;
    totalLen += len;

    if ((t.match(POLITE) || []).length > 0) polite++;
    if ((t.match(CASUAL) || []).length > 0) casual++;
    if (/[?？]/.test(t)) questionToAi++;
    if ((t.match(SELF) || []).length > 0) selfFocus++;
    if (ACK_STARTERS.test(t)) ack++;
    emojiCount += (t.match(EMOJI) || []).length;
    if ((t.match(HEDGE) || []).length > 0) hedge++;
    if ((t.match(CERTAIN) || []).length > 0) certain++;
    if (/[。.]\s*$/.test(t)) endsPeriod++;
    if (/[！!？?]/.test(t)) exclam++;
    if (len < 15) shortReply++;
  }

  return {
    avgLength: totalLen / n,
    politenessRate: rate(polite, n),
    casualRate: rate(casual, n),
    questionToAiRate: rate(questionToAi, n),
    selfFocusRate: rate(selfFocus, n),
    ackRate: rate(ack, n),
    emojiDensity: totalLen > 0 ? emojiCount / totalLen : 0,
    hedgingRate: rate(hedge, n),
    certaintyRate: rate(certain, n),
    endsWithPeriod: rate(endsPeriod, n),
    exclamationRate: rate(exclam, n),
    shortReplyRate: rate(shortReply, n),
  };
}

export function updateState(prev: SessionState, lastUserText: string, profile: StyleProfile): SessionState {
  const len = [...lastUserText].length;
  const polite = POLITE.test(lastUserText);
  const harsh = /(うざ|きも|だまれ|黙れ|めんどくさ|ださ|つまんな|どうでもい)/.test(lastUserText);
  const ack = ACK_STARTERS.test(lastUserText);
  const thanks = /(ありがと|嬉しい|助か)/.test(lastUserText);
  const cmd = /(?:しろ|やれ|教えろ|答えろ|早く|まだ\?)/.test(lastUserText);
  const question = /[?？]/.test(lastUserText);

  let mood = prev.mood * 0.7;
  if (thanks) mood += 3;
  if (polite) mood += 1;
  if (ack) mood += 0.5;
  if (question) mood += 0.5;
  if (len > 40) mood += 1;
  if (harsh) mood -= 4;
  if (cmd) mood -= 2;
  if (len < 5) mood -= 1;
  mood = Math.max(-10, Math.min(10, mood));

  let intimacy = prev.intimacy + (len > 30 ? 0.3 : 0.1) + (thanks ? 0.5 : 0) - (harsh ? 1 : 0);
  intimacy = Math.max(0, Math.min(10, intimacy));

  let trust = prev.trust + (ack ? 0.4 : 0) + (profile.ackRate > 0.3 ? 0.1 : -0.1);
  trust = Math.max(0, Math.min(10, trust));

  let interest = prev.interest * 0.9 + (len > 50 ? 1 : 0) + (question ? 0.5 : 0);
  interest = Math.max(0, Math.min(10, interest));

  return {
    mood,
    intimacy,
    trust,
    interest,
    turnCount: prev.turnCount + 1,
  };
}

function describeBand(value: number, low: string, mid: string, high: string, threshold = 0.3, threshold2 = 0.6): string {
  if (value < threshold) return low;
  if (value < threshold2) return mid;
  return high;
}

export function describeProfile(p: StyleProfile): string {
  const lines: string[] = [];
  lines.push(`- 平均文字数: ${p.avgLength.toFixed(0)}文字 (${p.avgLength < 15 ? "短い" : p.avgLength < 50 ? "普通" : "長い"})`);
  lines.push(`- 敬語: ${describeBand(p.politenessRate, "ほぼ使わない", "時々使う", "よく使う")}`);
  lines.push(`- タメ口・俗語: ${describeBand(p.casualRate, "ほぼ使わない", "時々使う", "よく使う")}`);
  lines.push(`- 質問の頻度: ${describeBand(p.questionToAiRate, "あまり質問しない", "時々質問する", "よく質問する")}`);
  lines.push(`- 自分の話: ${describeBand(p.selfFocusRate, "一人称少なめ", "普通", "一人称多め")}`);
  lines.push(`- 相手の発言を受け止める率: ${describeBand(p.ackRate, "受け止めずに次に行きがち", "時々受け止める", "よく受け止める")}`);
  lines.push(`- 推量・ぼかし表現: ${describeBand(p.hedgingRate, "断定的", "やや推量", "推量多い")}`);
  lines.push(`- 句点で終える: ${describeBand(p.endsWithPeriod, "句点なし", "時々", "ほぼ毎回")}`);
  lines.push(`- 感嘆符: ${describeBand(p.exclamationRate, "ほぼ使わない", "時々", "よく使う")}`);
  lines.push(`- 短文返信率: ${describeBand(p.shortReplyRate, "ちゃんと書く", "混合", "短文が多い")}`);
  return lines.join("\n");
}

export function describeState(s: SessionState): string {
  const moodLabel = s.mood < -3 ? "冷めている" : s.mood < 1 ? "ふつう" : s.mood < 5 ? "穏やか" : "良い";
  const intimacyLabel = s.intimacy < 1 ? "他人行儀" : s.intimacy < 4 ? "知り合い程度" : s.intimacy < 7 ? "親しい" : "とても親しい";
  return `- 機嫌: ${moodLabel} (${s.mood.toFixed(1)}/±10)
- 親密度: ${intimacyLabel} (${s.intimacy.toFixed(1)}/10)
- 信頼: ${s.trust.toFixed(1)}/10
- ターン数: ${s.turnCount}`;
}
