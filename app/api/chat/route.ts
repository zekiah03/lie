import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { extractProfile, updateState } from "@/lib/patterns";
import { buildSystemPrompt } from "@/lib/prompt";
import type { Entry, SessionState } from "@/lib/types";
import { initialState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatRequest = {
  history: Entry[];
  state: SessionState;
};

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const state = body.state ?? initialState;

  const profile = extractProfile(history);
  const lastUser = [...history].reverse().find((e) => e.role === "user");
  const isInitial = history.length === 0;

  const nextState = lastUser
    ? updateState(state, lastUser.text, profile)
    : { ...state, turnCount: 0 };

  const system = buildSystemPrompt(profile, nextState);

  const messages: Anthropic.MessageParam[] = isInitial
    ? [{ role: "user", content: "（まだ何も書いていない。最初の一言を待っている。）" }]
    : history.map((e) => ({
        role: e.role,
        content: e.text,
      }));

  if (!isInitial && messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from user" },
      { status: 400 }
    );
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system,
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({
      reply: text,
      state: nextState,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status ?? 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
