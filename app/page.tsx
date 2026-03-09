"use client";

import { useState, useEffect, useRef } from "react";

interface HistoryItem {
  query: string;
  formula: string;
  explanation?: string;
  timestamp: number;
}

interface Settings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

const EXAMPLES = [
  "Sum of column B where column A is 'Sales'",
  "Find the value in column C where column A matches D1",
  "Count unique customers in column B",
  "Average revenue for Q4 where region is East",
  "Get the last non-empty cell in column A",
  "Concatenate first name (A2) and last name (B2) with a space",
  "Calculate percentage change between B1 and B2",
  "Extract the domain from an email in cell A1",
  "Rank values in column B from highest to lowest",
  "Return 'Pass' if A1 >= 60, 'Fail' otherwise",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [formula, setFormula] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>({
    apiKey: "",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
  });
  const [totalQueries, setTotalQueries] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("fg_settings");
    if (saved) setSettings(JSON.parse(saved));
    const hist = localStorage.getItem("fg_history");
    if (hist) setHistory(JSON.parse(hist));
    const count = localStorage.getItem("fg_total");
    if (count) setTotalQueries(parseInt(count));
    const ownKey = localStorage.getItem("fg_useOwnKey");
    if (ownKey === "true") setUseOwnKey(true);
  }, []);

  function saveSettings(s: Settings) {
    setSettings(s);
    localStorage.setItem("fg_settings", JSON.stringify(s));
  }

  function toggleOwnKey(val: boolean) {
    setUseOwnKey(val);
    localStorage.setItem("fg_useOwnKey", String(val));
  }

  async function convert(text?: string) {
    const q = text || query;
    if (!q.trim()) return;

    if (useOwnKey && !settings.apiKey) {
      setShowSettings(true);
      setError("Please add your API key in Settings.");
      return;
    }

    setLoading(true);
    setError("");
    setFormula("");
    setExplanation("");

    try {
      const body: Record<string, string> = {
        query: q,
        action: "convert",
      };

      if (useOwnKey) {
        body.apiKey = settings.apiKey;
        body.model = settings.model;
        body.baseUrl = settings.baseUrl;
      } else {
        body.mode = "free";
      }

      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.remaining !== undefined) {
        setFreeRemaining(data.remaining);
      }

      if (data.error) {
        setError(data.error);
      } else {
        setFormula(data.result);
        const item: HistoryItem = {
          query: q,
          formula: data.result,
          timestamp: Date.now(),
        };
        const newHist = [item, ...history].slice(0, 50);
        setHistory(newHist);
        localStorage.setItem("fg_history", JSON.stringify(newHist));
        const newCount = totalQueries + 1;
        setTotalQueries(newCount);
        localStorage.setItem("fg_total", String(newCount));
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function explain() {
    if (!formula) return;
    setExplaining(true);
    try {
      const body: Record<string, string> = {
        query: `Original request: "${query}"\nFormula: ${formula}\n\nExplain this formula.`,
        action: "explain",
      };
      if (useOwnKey) {
        body.apiKey = settings.apiKey;
        body.model = settings.model;
        body.baseUrl = settings.baseUrl;
      } else {
        body.mode = "free";
      }
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.remaining !== undefined) setFreeRemaining(data.remaining);
      if (data.result) setExplanation(data.result);
    } catch {
      /* ignore */
    } finally {
      setExplaining(false);
    }
  }

  function copyFormula() {
    navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      convert();
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-lg font-bold">FormulaGenie</span>
        </div>
        <div className="flex items-center gap-3">
          {!useOwnKey && freeRemaining !== null && (
            <span className="text-xs text-gray-500">
              {freeRemaining} free left today
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
          >
            History ({history.length})
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
          >
            ⚙ Settings
          </button>
        </div>
      </nav>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-gray-800 bg-[#111118] px-6 py-5">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => toggleOwnKey(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !useOwnKey
                    ? "bg-indigo-600 text-white"
                    : "bg-[#1a1a28] text-gray-400 border border-gray-700"
                }`}
              >
                Free Mode (5/day)
              </button>
              <button
                onClick={() => toggleOwnKey(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  useOwnKey
                    ? "bg-indigo-600 text-white"
                    : "bg-[#1a1a28] text-gray-400 border border-gray-700"
                }`}
              >
                Own API Key (unlimited)
              </button>
            </div>

            {!useOwnKey ? (
              <div className="bg-[#0a0a0f] rounded-xl p-4 border border-gray-800">
                <p className="text-sm text-gray-400">
                  Free mode uses our server. You get <strong className="text-indigo-400">5 free conversions per day</strong>.
                  No signup, no API key needed.
                </p>
                {freeRemaining !== null && (
                  <p className="text-sm mt-2 text-gray-500">
                    Remaining today: <strong className="text-white">{freeRemaining}</strong>
                  </p>
                )}
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Your API Key
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) =>
                        saveSettings({ ...settings, apiKey: e.target.value })
                      }
                      placeholder="sk-..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={settings.model}
                      onChange={(e) =>
                        saveSettings({ ...settings, model: e.target.value })
                      }
                      placeholder="gpt-4o-mini"
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Base URL (for OpenAI-compatible APIs like DeepSeek, Kimi)
                  </label>
                  <input
                    type="text"
                    value={settings.baseUrl}
                    onChange={(e) =>
                      saveSettings({ ...settings, baseUrl: e.target.value })
                    }
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Your API key is stored locally in your browser. It is never sent
                  to our servers — only directly to the LLM provider. Unlimited usage.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Describe it. Get the formula.
          </h1>
          <p className="text-lg text-gray-400">
            Stop Googling VLOOKUP syntax. Type what you need in plain English
            (or any language) and get a working Excel / Google Sheets formula
            instantly.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Free — no signup, no API key needed. Just type and go.
          </p>
        </div>

        {/* Input area */}
        <div className="w-full max-w-2xl">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setFormula("");
                  setExplanation("");
                  setError("");
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Find the average salary where department is Engineering"'
              rows={3}
              className="w-full px-5 py-4 rounded-2xl bg-[#141420] border border-gray-700 focus:border-indigo-500 focus:outline-none text-base resize-none placeholder:text-gray-600"
            />
            <button
              onClick={() => convert()}
              disabled={loading || !query.trim()}
              className="absolute right-3 bottom-3 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Converting...
                </span>
              ) : (
                "Convert ⏎"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {formula && (
            <div className="mt-6 rounded-2xl bg-[#141420] border border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Formula
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={explain}
                    disabled={explaining}
                    className="px-3 py-1 text-xs rounded-lg border border-gray-700 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    {explaining ? "Explaining..." : "Explain"}
                  </button>
                  <button
                    onClick={copyFormula}
                    className="px-3 py-1 text-xs rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                <code className="text-lg font-mono text-green-400 break-all">
                  {formula}
                </code>
              </div>
              {explanation && (
                <div className="px-5 py-4 border-t border-gray-800 text-sm text-gray-400 leading-relaxed">
                  {explanation}
                </div>
              )}
            </div>
          )}

          {/* Examples */}
          {!formula && (
            <div className="mt-10">
              <h3 className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                Try these examples
              </h3>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setQuery(ex);
                      convert(ex);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-[#141420] border border-gray-800 hover:border-indigo-500 hover:text-indigo-400 transition-all text-gray-400"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Features section */}
        <div className="w-full max-w-4xl mt-24 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: "⚡",
              title: "Instant & Free",
              desc: "5 free conversions per day, no signup needed. Or bring your own API key for unlimited use.",
            },
            {
              icon: "🔒",
              title: "Private & Secure",
              desc: "In free mode, we never store your queries. With your own key, data goes directly to your provider.",
            },
            {
              icon: "🎯",
              title: "Smart & Accurate",
              desc: "Uses modern functions (XLOOKUP, FILTER, UNIQUE) and adapts to Excel or Google Sheets.",
            },
            {
              icon: "💡",
              title: "Built-in Explanations",
              desc: 'Click "Explain" to understand any formula. Learn while you work.',
            },
            {
              icon: "📋",
              title: "History & Favorites",
              desc: "All your conversions are saved locally. Revisit past formulas anytime.",
            },
            {
              icon: "🌍",
              title: "Any Language",
              desc: "Describe your formula in Chinese, Japanese, Korean, or any language you prefer.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl bg-[#141420] border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof / stats */}
        <div className="mt-16 text-center text-gray-600 text-sm">
          {totalQueries > 0 && (
            <p>You&apos;ve converted {totalQueries} formulas so far.</p>
          )}
        </div>
      </main>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-md bg-[#111118] border-l border-gray-800 overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-[#111118]">
              <h3 className="font-semibold">History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                X
              </button>
            </div>
            <div className="p-5 space-y-3">
              {history.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">
                  No history yet. Convert some formulas!
                </p>
              ) : (
                history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(item.query);
                      setFormula(item.formula);
                      setExplanation(item.explanation || "");
                      setShowHistory(false);
                    }}
                    className="w-full text-left p-4 rounded-xl bg-[#0a0a0f] border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="text-sm text-gray-400 mb-1 truncate">
                      {item.query}
                    </div>
                    <code className="text-xs font-mono text-green-400 break-all">
                      {item.formula}
                    </code>
                    <div className="text-xs text-gray-700 mt-2">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center text-sm text-gray-600">
        <p>
          FormulaGenie — Free, open source, privacy-first formula converter.{" "}
          <a href="#" className="text-indigo-500 hover:text-indigo-400">
            GitHub
          </a>{" "}
          ·{" "}
          <a href="#" className="text-indigo-500 hover:text-indigo-400">
            Chrome Extension
          </a>
        </p>
      </footer>
    </div>
  );
}
