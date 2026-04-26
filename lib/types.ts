export type Role = "user" | "assistant";

export type Entry = {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
};

export type StyleProfile = {
  avgLength: number;
  politenessRate: number;
  casualRate: number;
  questionToAiRate: number;
  selfFocusRate: number;
  ackRate: number;
  emojiDensity: number;
  hedgingRate: number;
  certaintyRate: number;
  endsWithPeriod: number;
  exclamationRate: number;
  shortReplyRate: number;
};

export type SessionState = {
  mood: number;
  intimacy: number;
  trust: number;
  interest: number;
  turnCount: number;
};

export const initialState: SessionState = {
  mood: 0,
  intimacy: 0,
  trust: 0,
  interest: 0,
  turnCount: 0,
};
