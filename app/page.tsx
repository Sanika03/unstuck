"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Compass,
  Gauge,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
  XCircle,
  Plus,
  Trash2,
  Hourglass,
} from "lucide-react";
import { AnalysisResult } from "./api/analyze/route";

type Attempt = {
  id: string;
  text: string;
  done: boolean;
};

export default function HomePage() {
  const [issue, setIssue] = useState("");
  const [stack, setStack] = useState("");
  const [tried, setTried] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [newAttempt, setNewAttempt] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issue,
          stack,
          tried,
        }),
      });

      const res: AnalysisResult = await response.json();

      if (!response.ok) {
        throw new Error((res as any)?.error || "Something went wrong.");
      }

      setResult(res);

      setAttempts((prev) => [
        ...prev,
        ...res.bestNextSteps.map((text, i) => ({
          id: `${Date.now()}-${i}`,
          text,
          done: false,
        })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const addAttempt = () => {
    const t = newAttempt.trim();

    if (!t) return;

    setAttempts((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        text: t,
        done: false,
      },
    ]);

    setNewAttempt("");
  };

  const completed = useMemo(
    () => attempts.filter((a) => a.done).length,
    [attempts],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Bug className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Unstuck
              </h1>
              <p className="text-xs text-muted-foreground">
                Systematic debugging for solo developers
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by AI
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        {/* LEFT */}
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-card/40 p-6"
        >
          <h2 className="text-sm font-medium tracking-tight text-foreground">
            Describe what's blocking you
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The more specific, the better the analysis.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="issue" className="text-xs font-medium">
                Describe your issue
              </Label>
              <Textarea
                id="issue"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="e.g. My Vite build works locally but fails in CI with 'Cannot find module ...'"
                className="mt-1.5 min-h-[160px] resize-y bg-input/40"
                required
              />
            </div>

            <div>
              <Label htmlFor="stack" className="text-xs font-medium">
                Tech stack
              </Label>
              <Input
                id="stack"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="React, TypeScript, Vite, Postgres…"
                className="mt-1.5 bg-input/40"
              />
            </div>

            <div>
              <Label htmlFor="tried" className="text-xs font-medium">
                What have you already tried?
              </Label>
              <Textarea
                id="tried"
                value={tried}
                onChange={(e) => setTried(e.target.value)}
                placeholder="Reinstalled deps, cleared cache, checked env vars…"
                className="mt-1.5 min-h-[100px] resize-y bg-input/40"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Analyze Issue
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        {/* RIGHT */}
        <div className="rounded-xl border border-border bg-card/40 p-6">
          {!result && !loading && <EmptyState />}
          {loading && <LoadingState />}
          {result && <ResultView result={result} />}
        </div>
      </section>

      {/* ATTEMPT TRACKER */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
                <ListChecks className="h-4 w-4 text-primary" /> Attempt Tracker
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Mark each debugging attempt as you go — avoid retrying the same
                thing.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {completed} / {attempts.length} completed
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Input
              value={newAttempt}
              onChange={(e) => setNewAttempt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttempt();
                }
              }}
              placeholder="Add an attempt to track…"
              className="bg-input/40"
            />
            <Button type="button" variant="secondary" onClick={addAttempt}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>

          <ul className="mt-4 divide-y divide-border/60">
            {attempts.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">
                No attempts yet. Run an analysis or add your own.
              </li>
            )}
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <Checkbox
                  checked={a.done}
                  onCheckedChange={(v) =>
                    setAttempts((prev) =>
                      prev.map((x) =>
                        x.id === a.id ? { ...x, done: !!v } : x,
                      ),
                    )
                  }
                />
                <span
                  className={`flex-1 text-sm ${
                    a.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {a.text}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttempts((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Remove attempt"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/60 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-medium">
        Your analysis will appear here
      </h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Describe your issue on the left and click Analyze Issue. You'll get
        likely causes, next steps, and a focused isolation strategy.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="mt-4 text-sm font-medium">Thinking through your issue…</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pulling apart causes and ranking next steps.
      </p>
    </div>
  );
}

function ResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4">
      <ResultCard
        icon={<Lightbulb className="h-4 w-4" />}
        title="Likely Causes"
        items={result.likelyCauses}
        tone="primary"
      />
      <ResultCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="Best Next Steps"
        items={result.bestNextSteps}
        tone="primary"
        ordered
      />
      <ResultCard
        icon={<XCircle className="h-4 w-4" />}
        title="Avoid Retrying"
        items={
          result.avoidRetrying.length
            ? result.avoidRetrying
            : ["Nothing flagged."]
        }
        tone="destructive"
      />
      <ResultCard
        icon={<Compass className="h-4 w-4" />}
        title="Fastest Isolation Strategy"
        items={result.fastestIsolationStrategy}
        tone="primary"
        ordered
      />
      <ResultCard
        icon={<Hourglass className="h-4 w-4" />}
        title="Potential Time Wasters"
        items={
          result.potentialTimeWasters.length
            ? result.potentialTimeWasters
            : ["Nothing flagged."]
        }
        tone="destructive"
      />
      <ConfidenceCard
        level={result.confidenceLevel}
        rationale={result.confidenceRationale}
      />
    </div>
  );
}

function ResultCard({
  icon,
  title,
  items,
  tone,
  ordered,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "primary" | "destructive";
  ordered?: boolean;
}) {
  const accent =
    tone === "destructive"
      ? "text-destructive bg-destructive/10 border-destructive/30"
      : "text-primary bg-primary/10 border-primary/30";
  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md border ${accent}`}
        >
          {icon}
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      {ordered ? (
        <ol className="mt-3 space-y-1.5 pl-5 text-sm text-foreground/90 [list-style:decimal]">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfidenceCard({
  level,
  rationale,
}: {
  level: "Low" | "Medium" | "High";
  rationale: string;
}) {
  const pct = level === "High" ? 90 : level === "Medium" ? 60 : 30;
  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Gauge className="h-4 w-4" />
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confidence Level
          </h3>
        </div>
        <span className="text-xs font-medium text-foreground">{level}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {rationale}
      </p>
    </div>
  );
}
