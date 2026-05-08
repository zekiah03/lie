"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, SessionState } from "@/lib/types";
import { initialState } from "@/lib/types";
import { PenIcon } from "./icons";
import { contributeToTwin } from "@/lib/contribute";

const ENTRIES_KEY = "kagami:entries";
const STATE_KEY = "kagami:state";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}  ${hh}:${mi}`;
}

function shouldShowDate(prev: Entry | undefined, curr: Entry): boolean {
  if (!prev) return true;
  const a = new Date(prev.createdAt);
  const b = new Date(curr.createdAt);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<SessionState>(initialState);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const e = localStorage.getItem(ENTRIES_KEY);
      const s = localStorage.getItem(STATE_KEY);
      if (e) setEntries(JSON.parse(e));
      if (s) setState(JSON.parse(s));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (entries.length === 0 && !loading) {
      fetchReply([], initialState);
    }
  }, [hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, loading]);

  function persist(nextEntries: Entry[], nextState: SessionState) {
    setEntries(nextEntries);
    setState(nextState);
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(nextEntries));
      localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
    } catch {}
  }

  async function fetchReply(history: Entry[], currentState: SessionState) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, state: currentState }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: { reply: string; state: SessionState } = await res.json();
      const aiEntry: Entry = {
        id: uid(),
        role: "assistant",
        text: data.reply,
        createdAt: Date.now(),
      };
      persist([...history, aiEntry], data.state);
      if (!sessionStorage.getItem('lie_contributed')) {
        sessionStorage.setItem('lie_contributed', '1');
        contributeToTwin('lie', { event: 'chat', msgCount: history.length + 2 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userEntry: Entry = {
      id: uid(),
      role: "user",
      text,
      createdAt: Date.now(),
    };
    const next = [...entries, userEntry];
    setEntries(next);
    setInput("");
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(next));
    } catch {}
    await fetchReply(next, state);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    if (!confirm("これまでの記録をすべて消します。よろしいですか？")) return;
    try {
      localStorage.removeItem(ENTRIES_KEY);
      localStorage.removeItem(STATE_KEY);
    } catch {}
    setEntries([]);
    setState(initialState);
    fetchReply([], initialState);
  }

  return (
    <main>
      <div className="menu">
        <button onClick={reset} disabled={loading}>
          リセット
        </button>
      </div>
      <h1 className="title">鏡</h1>

      <div className="entries">
        {entries.map((entry, i) => {
          const prev = i > 0 ? entries[i - 1] : undefined;
          const showDate = shouldShowDate(prev, entry);
          return (
            <div key={entry.id}>
              {showDate && (
                <div className="divider">
                  {fmtDate(entry.createdAt).split("  ")[0]}
                </div>
              )}
              <article className={`entry entry-${entry.role}`}>
                <div className="entry-meta">
                  {fmtDate(entry.createdAt).split("  ")[1]}
                </div>
                <div className="entry-text">{entry.text}</div>
              </article>
            </div>
          );
        })}
        {loading && <div className="thinking">…</div>}
        {error && <div className="error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="今日のことを書く…"
            disabled={loading}
            rows={2}
          />
          <div className="composer-actions">
            <span className="hint">⌘↵ で送信</span>
            <button
              className="send"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="書く"
              title="書く"
            >
              <PenIcon />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
