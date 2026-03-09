import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

const SYSTEM_PROMPT = `You are an expert Excel and Google Sheets formula generator. The user will describe what they want in plain language. You must return ONLY the formula, nothing else.

Rules:
1. Return a single working formula that can be pasted directly into Excel or Google Sheets.
2. Do NOT include any explanation, just the formula.
3. If the request is ambiguous, make reasonable assumptions and provide the most common interpretation.
4. Use modern functions when possible (XLOOKUP over VLOOKUP, FILTER, UNIQUE, LET, LAMBDA).
5. For Google Sheets specific requests, use Google Sheets compatible functions.
6. Always start formulas with =.

Examples:
- "sum column A" → =SUM(A:A)
- "find value from column B where column A matches cell D1" → =XLOOKUP(D1,A:A,B:B)
- "count unique values in column C" → =COUNTA(UNIQUE(C:C))
- "average of B where A is greater than 100" → =AVERAGEIF(A:A,">100",B:B)`;

const EXPLAIN_PROMPT = `You are an Excel formula expert. The user will give you a formula. Explain it clearly and concisely in 2-3 sentences. Use simple language. Mention what each function does and what the overall result will be. Reply in the same language as the user's original request.`;

const FREE_DAILY_LIMIT = 5;

const dailyUsage = new Map<string, { count: number; date: string }>();

function getClientIP(req: NextRequest): string {
  const headersList = req.headers;
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}

function checkFreeLimit(ip: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const usage = dailyUsage.get(ip);

  if (!usage || usage.date !== today) {
    dailyUsage.set(ip, { count: 0, date: today });
    return { allowed: true, remaining: FREE_DAILY_LIMIT };
  }

  const remaining = FREE_DAILY_LIMIT - usage.count;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

function recordUsage(ip: string) {
  const today = new Date().toISOString().slice(0, 10);
  const usage = dailyUsage.get(ip);
  if (!usage || usage.date !== today) {
    dailyUsage.set(ip, { count: 1, date: today });
  } else {
    usage.count++;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, action, apiKey, model, baseUrl, mode } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "Please describe what formula you need." },
        { status: 400 }
      );
    }

    const useProxy = mode === "free" || !apiKey?.trim();

    let finalKey: string;
    let finalBaseUrl: string;
    let finalModel: string;
    let freeRemaining = 0;

    if (useProxy) {
      const serverKey = process.env.LLM_API_KEY;
      if (!serverKey) {
        return NextResponse.json(
          { error: "Free mode is not configured yet. Please use your own API key in Settings." },
          { status: 503 }
        );
      }

      const ip = getClientIP(req);
      const { allowed, remaining } = checkFreeLimit(ip);

      if (!allowed) {
        return NextResponse.json(
          {
            error: `Daily free limit reached (${FREE_DAILY_LIMIT}/day). You can continue by adding your own API key in Settings, or come back tomorrow.`,
            remaining: 0,
          },
          { status: 429 }
        );
      }

      finalKey = serverKey;
      finalBaseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
      finalModel = process.env.LLM_MODEL || "gpt-4o-mini";

      recordUsage(ip);
      freeRemaining = remaining - 1;
    } else {
      finalKey = apiKey;
      finalBaseUrl = baseUrl || "https://api.openai.com/v1";
      finalModel = model || "gpt-4o-mini";
    }

    const isExplain = action === "explain";
    const endpoint = finalBaseUrl + "/chat/completions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalKey}`,
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: "system", content: isExplain ? EXPLAIN_PROMPT : SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      const status = response.status;
      if (status === 401) {
        return NextResponse.json({ error: "Invalid API key. Please check your settings." }, { status: 401 });
      }
      if (status === 429) {
        return NextResponse.json({ error: "Rate limited. Please wait a moment and try again." }, { status: 429 });
      }
      return NextResponse.json({ error: `API error (${status}): ${err.slice(0, 200)}` }, { status });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      result,
      tokens: data.usage?.total_tokens || 0,
      ...(useProxy ? { remaining: freeRemaining } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
