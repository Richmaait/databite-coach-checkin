import { useEffect, useMemo, useState } from "react";

/**
 * Goal Clarity Worksheet — interactive 3-stage exercise.
 *
 * Stage 1: Pick top 3 focus areas, rate enjoyment + doability, system picks winner.
 * Stage 2: Brainstorm 8+ behaviours → narrow to 4 enjoyable → 3 effective → 2 confident → 1 to action.
 * Stage 3: Plan for barriers, rate confidence, leave a note for the coach.
 *
 * Progress autosaves to localStorage. When client auth ships in Phase 1,
 * we'll swap localStorage for a tRPC mutation.
 */

const STORAGE_KEY = "databite-goal-clarity-v1";

type Focus = { id: string; text: string; enjoy: number | null; doable: number | null };
type Behavior = { id: string; text: string };

interface State {
  stage: 1 | 2 | 3 | 4;
  focuses: Focus[];
  chosenFocusId: string | null;
  behaviors: Behavior[];
  enjoyableIds: string[];   // up to 4
  effectiveIds: string[];   // up to 3
  confidentIds: string[];   // up to 2
  actionIds: string[];      // 1 or 2
  barriersText: string;
  confidence: number | null; // 1-10
  confidenceReason: string;
  supportText: string;
  startedAt: string;
}

function emptyFocus(i: number): Focus {
  return { id: `f${i}`, text: "", enjoy: null, doable: null };
}

function genId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function defaultState(): State {
  return {
    stage: 1,
    focuses: [emptyFocus(1), emptyFocus(2), emptyFocus(3)],
    chosenFocusId: null,
    behaviors: Array.from({ length: 4 }, () => ({ id: genId(), text: "" })),
    enjoyableIds: [],
    effectiveIds: [],
    confidentIds: [],
    actionIds: [],
    barriersText: "",
    confidence: null,
    confidenceReason: "",
    supportText: "",
    startedAt: new Date().toISOString(),
  };
}

function loadState(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export default function GoalClarity() {
  const [s, setS] = useState<State>(loadState);

  // Autosave to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignore quota errors
    }
  }, [s]);

  const update = <K extends keyof State>(key: K, value: State[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const totals = useMemo(() => {
    return s.focuses.map((f) => ({
      id: f.id,
      total: (f.enjoy ?? 0) + (f.doable ?? 0),
      ready: f.text.trim() && f.enjoy != null && f.doable != null,
    }));
  }, [s.focuses]);

  const winningId = useMemo(() => {
    const ready = totals.filter((t) => t.ready);
    if (ready.length === 0) return null;
    const max = Math.max(...ready.map((t) => t.total));
    const winners = ready.filter((t) => t.total === max);
    return winners.length === 1 ? winners[0].id : null;
  }, [totals]);

  const chosenFocus = s.focuses.find((f) => f.id === s.chosenFocusId) ?? null;

  const reset = () => {
    if (confirm("Start over? This will erase your current worksheet.")) {
      const fresh = defaultState();
      setS(fresh);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  };

  return (
    <div className="min-h-screen text-[#0f0e3d]" style={{ background: "#f8fafc", fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#f8fafc]/85 border-b border-[#191772]/8">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/databite-logo-navy.svg" alt="databite" className="h-7 sm:h-8" />
            <div className="h-7 w-px bg-[#191772]/15 hidden sm:block" />
            <div className="leading-tight hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#191772]/60">Goal Clarity</div>
              <div className="text-sm font-bold text-[#191772]" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>Worksheet</div>
            </div>
          </div>
          <button onClick={reset} className="text-[11px] font-semibold text-[#191772]/50 hover:text-[#e36a48] transition-colors">
            Start over
          </button>
        </div>
        <Stepper stage={s.stage} setStage={(n) => update("stage", n)} />
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 sm:py-12">
        {s.stage === 1 && (
          <Stage1
            focuses={s.focuses}
            setFocuses={(fs) => update("focuses", fs)}
            totals={totals}
            winningId={winningId}
            chosenFocusId={s.chosenFocusId}
            setChosenFocusId={(id) => update("chosenFocusId", id)}
            onNext={() => update("stage", 2)}
          />
        )}

        {s.stage === 2 && (
          <Stage2
            chosenFocus={chosenFocus}
            behaviors={s.behaviors}
            setBehaviors={(bs) => update("behaviors", bs)}
            enjoyableIds={s.enjoyableIds}
            setEnjoyableIds={(ids) => update("enjoyableIds", ids)}
            effectiveIds={s.effectiveIds}
            setEffectiveIds={(ids) => update("effectiveIds", ids)}
            confidentIds={s.confidentIds}
            setConfidentIds={(ids) => update("confidentIds", ids)}
            actionIds={s.actionIds}
            setActionIds={(ids) => update("actionIds", ids)}
            onBack={() => update("stage", 1)}
            onNext={() => update("stage", 3)}
          />
        )}

        {s.stage === 3 && (
          <Stage3
            behaviors={s.behaviors}
            actionIds={s.actionIds}
            barriersText={s.barriersText}
            setBarriersText={(v) => update("barriersText", v)}
            confidence={s.confidence}
            setConfidence={(v) => update("confidence", v)}
            confidenceReason={s.confidenceReason}
            setConfidenceReason={(v) => update("confidenceReason", v)}
            supportText={s.supportText}
            setSupportText={(v) => update("supportText", v)}
            onBack={() => update("stage", 2)}
            onFinish={() => update("stage", 4)}
          />
        )}

        {s.stage === 4 && (
          <Summary
            state={s}
            onBack={() => update("stage", 3)}
            onReset={reset}
          />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-5 pb-10 text-center">
        <p className="text-[11px] text-[#191772]/40">
          Progress is saved automatically on this device.
        </p>
      </footer>
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ stage, setStage }: { stage: 1 | 2 | 3 | 4; setStage: (s: 1 | 2 | 3 | 4) => void }) {
  const steps = [
    { n: 1 as const, label: "Focus" },
    { n: 2 as const, label: "Behaviour" },
    { n: 3 as const, label: "Plan" },
  ];
  return (
    <div className="max-w-3xl mx-auto px-5 pb-4">
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const isActive = stage === step.n;
          const isDone = stage > step.n;
          return (
            <div key={step.n} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => (isDone || isActive ? setStage(step.n) : null)}
                className={`flex items-center gap-2 ${isDone || isActive ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold border-2 transition-all ${
                    isActive
                      ? "bg-[#e36a48] border-[#e36a48] text-white shadow-md shadow-[#e36a48]/30"
                      : isDone
                      ? "bg-[#191772] border-[#191772] text-white"
                      : "bg-white border-[#191772]/15 text-[#191772]/40"
                  }`}
                >
                  {isDone ? "✓" : step.n}
                </div>
                <span className={`text-[11px] uppercase tracking-wider font-semibold hidden sm:inline ${isActive ? "text-[#e36a48]" : isDone ? "text-[#191772]" : "text-[#191772]/40"}`}>
                  Stage {step.n} · {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${stage > step.n ? "bg-[#191772]/30" : "bg-[#191772]/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stage 1: Focus selection ───────────────────────────────────────────────

function Stage1({
  focuses, setFocuses, totals, winningId, chosenFocusId, setChosenFocusId, onNext,
}: {
  focuses: Focus[];
  setFocuses: (fs: Focus[]) => void;
  totals: { id: string; total: number; ready: boolean }[];
  winningId: string | null;
  chosenFocusId: string | null;
  setChosenFocusId: (id: string | null) => void;
  onNext: () => void;
}) {
  const update = (id: string, patch: Partial<Focus>) => {
    setFocuses(focuses.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const allReady = totals.every((t) => t.ready);
  const canContinue = !!chosenFocusId;

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          What are your top 3 things you want to focus on?
        </h1>
        <p className="text-sm text-[#191772]/60 max-w-xl mx-auto">
          Don't hold back. This is your chance to reflect on what really matters right now.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {focuses.map((f, idx) => {
          const total = totals[idx];
          const isWinner = winningId === f.id;
          const numberColor = idx === 0 ? "#fd8664" : idx === 1 ? "#a3a187" : "#191772";
          return (
            <div
              key={f.id}
              className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all ${
                isWinner ? "border-[#e36a48] shadow-lg shadow-[#e36a48]/10" : "border-[#191772]/8 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-bold shrink-0"
                  style={{ background: numberColor }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder={idx === 0 ? "e.g. Drink more water consistently" : idx === 1 ? "e.g. Sleep 7+ hrs a night" : "e.g. Walk 10k steps daily"}
                    value={f.text}
                    onChange={(e) => update(f.id, { text: e.target.value })}
                    className="w-full bg-transparent border-b border-[#191772]/10 focus:border-[#e36a48] outline-none text-base font-medium py-2 placeholder:text-[#191772]/25"
                  />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                    <RatingPicker
                      label="Enjoyment"
                      hint="10 = really enjoy"
                      value={f.enjoy}
                      onChange={(v) => update(f.id, { enjoy: v })}
                      color="#fd8664"
                    />
                    <RatingPicker
                      label="Doability"
                      hint="10 = totally doable"
                      value={f.doable}
                      onChange={(v) => update(f.id, { doable: v })}
                      color="#191772"
                    />
                  </div>
                </div>
                <div className="text-right shrink-0 self-stretch flex flex-col justify-between">
                  <div className="text-[10px] text-[#191772]/40 uppercase tracking-wider font-semibold">Total</div>
                  <div className={`text-3xl font-bold ${total.ready ? "text-[#191772]" : "text-[#191772]/15"}`} style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
                    {total.ready ? total.total : "—"}
                  </div>
                  {isWinner && (
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[#e36a48] mt-1">Winner</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allReady && (
        <div className="bg-[#edddc3]/60 border border-[#fd8664]/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-sm text-[#191772]/75 mb-3">
            The goal with the highest total likely indicates where you'll see the most success right now.
            {winningId == null ? " You've got a tie — think about which one you'd most like to spend time on." : ""}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {focuses.map((f) => (
              <button
                key={f.id}
                onClick={() => setChosenFocusId(f.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  chosenFocusId === f.id
                    ? "bg-[#e36a48] text-white shadow-md shadow-[#e36a48]/30"
                    : "bg-white border border-[#191772]/10 text-[#191772] hover:border-[#e36a48]/40"
                }`}
              >
                {f.text.trim() || `Focus ${focuses.indexOf(f) + 1}`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#191772]/45 mt-3">
            You aren't abandoning the others — just choosing one to focus on first.
          </p>
        </div>
      )}

      <NavButtons onNext={onNext} nextDisabled={!canContinue} nextLabel="Continue to Stage 2" />
    </div>
  );
}

function RatingPicker({
  label, hint, value, onChange, color,
}: {
  label: string; hint: string; value: number | null; onChange: (n: number) => void; color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#191772]/70">{label}</span>
        <span className="text-[10px] text-[#191772]/40">{hint}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-8 rounded text-[11px] font-semibold transition-all ${
              value === n
                ? "text-white shadow-sm"
                : "bg-[#f5ebd9]/60 text-[#191772]/50 hover:bg-[#f5ebd9]"
            }`}
            style={value === n ? { background: color } : undefined}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Stage 2: Behavior funnel ───────────────────────────────────────────────

function Stage2({
  chosenFocus, behaviors, setBehaviors,
  enjoyableIds, setEnjoyableIds,
  effectiveIds, setEffectiveIds,
  confidentIds, setConfidentIds,
  actionIds, setActionIds,
  onBack, onNext,
}: {
  chosenFocus: Focus | null;
  behaviors: Behavior[];
  setBehaviors: (bs: Behavior[]) => void;
  enjoyableIds: string[]; setEnjoyableIds: (ids: string[]) => void;
  effectiveIds: string[]; setEffectiveIds: (ids: string[]) => void;
  confidentIds: string[]; setConfidentIds: (ids: string[]) => void;
  actionIds: string[]; setActionIds: (ids: string[]) => void;
  onBack: () => void; onNext: () => void;
}) {
  const filledBehaviors = behaviors.filter((b) => b.text.trim());
  const eligibleForEnjoy = filledBehaviors;
  const eligibleForEffective = behaviors.filter((b) => enjoyableIds.includes(b.id));
  const eligibleForConfident = behaviors.filter((b) => effectiveIds.includes(b.id));
  const eligibleForAction = behaviors.filter((b) => confidentIds.includes(b.id));

  const updateBehavior = (id: string, text: string) => {
    setBehaviors(behaviors.map((b) => (b.id === id ? { ...b, text } : b)));
  };

  const addBehavior = () => {
    setBehaviors([...behaviors, { id: genId(), text: "" }]);
  };

  const removeBehavior = (id: string) => {
    setBehaviors(behaviors.filter((b) => b.id !== id));
    setEnjoyableIds(enjoyableIds.filter((x) => x !== id));
    setEffectiveIds(effectiveIds.filter((x) => x !== id));
    setConfidentIds(confidentIds.filter((x) => x !== id));
    setActionIds(actionIds.filter((x) => x !== id));
  };

  const toggle = (ids: string[], setIds: (v: string[]) => void, id: string, max: number) => {
    if (ids.includes(id)) {
      setIds(ids.filter((x) => x !== id));
    } else if (ids.length < max) {
      setIds([...ids, id]);
    }
  };

  // Cascade: remove from later picks if removed from earlier
  useEffect(() => {
    setEffectiveIds(effectiveIds.filter((id) => enjoyableIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enjoyableIds.join(",")]);
  useEffect(() => {
    setConfidentIds(confidentIds.filter((id) => effectiveIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIds.join(",")]);
  useEffect(() => {
    setActionIds(actionIds.filter((id) => confidentIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidentIds.join(",")]);

  const canContinue = actionIds.length >= 1;

  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1.5 rounded-full bg-[#edddc3]/60 border border-[#191772]/8 text-[10px] uppercase tracking-widest font-bold text-[#191772]/70 mb-3">
          Focus: {chosenFocus?.text || "—"}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          What behaviours will get you there?
        </h1>
        <p className="text-sm text-[#191772]/60 max-w-xl mx-auto">
          Brain dump everything — big or small. We'll narrow it down together in four steps.
        </p>
      </div>

      {/* Step A: Brain dump */}
      <FunnelStep
        label="A — Brain dump (8+)"
        hint="List anything that might help. No editing yet."
        count={filledBehaviors.length}
        target={8}
      >
        <div className="space-y-2">
          {behaviors.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <div className="w-6 text-[#191772]/30 text-sm font-semibold text-right">{i + 1}.</div>
              <input
                type="text"
                value={b.text}
                onChange={(e) => updateBehavior(b.id, e.target.value)}
                placeholder="e.g. Pre-pack lunches on Sunday"
                className="flex-1 bg-white border border-[#191772]/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e36a48] placeholder:text-[#191772]/25"
              />
              {behaviors.length > 1 && (
                <button onClick={() => removeBehavior(b.id)} className="w-6 h-6 grid place-items-center text-[#191772]/30 hover:text-[#e36a48] text-sm">
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addBehavior} className="mt-2 text-[12px] font-semibold text-[#e36a48] hover:text-[#fd8664]">
            + Add another behaviour
          </button>
        </div>
      </FunnelStep>

      {/* Step B: Most enjoyable (4) */}
      <FunnelStep
        label="B — Pick 4 most enjoyable"
        hint="Which 4 would you actually look forward to?"
        count={enjoyableIds.length}
        target={4}
        disabled={filledBehaviors.length < 4}
        disabledHint="Add at least 4 behaviours above first."
      >
        <ChipGroup
          items={eligibleForEnjoy}
          selectedIds={enjoyableIds}
          onToggle={(id) => toggle(enjoyableIds, setEnjoyableIds, id, 4)}
          accent="#fd8664"
        />
      </FunnelStep>

      {/* Step C: Most effective (3) */}
      <FunnelStep
        label="C — Pick 3 most effective"
        hint="Which 3 of those would have the biggest impact on your focus?"
        count={effectiveIds.length}
        target={3}
        disabled={enjoyableIds.length < 3}
      >
        <ChipGroup
          items={eligibleForEffective}
          selectedIds={effectiveIds}
          onToggle={(id) => toggle(effectiveIds, setEffectiveIds, id, 3)}
          accent="#e36a48"
        />
      </FunnelStep>

      {/* Step D: Confident (2) */}
      <FunnelStep
        label="D — Pick 2 you're confident you'll do consistently"
        hint="Be honest. Consistency beats intensity."
        count={confidentIds.length}
        target={2}
        disabled={effectiveIds.length < 2}
      >
        <ChipGroup
          items={eligibleForConfident}
          selectedIds={confidentIds}
          onToggle={(id) => toggle(confidentIds, setConfidentIds, id, 2)}
          accent="#191772"
        />
      </FunnelStep>

      {/* Step E: Action (1 or both) */}
      <FunnelStep
        label="E — Pick 1 to put into action"
        hint="Or both, if your schedule allows."
        count={actionIds.length}
        target={2}
        disabled={confidentIds.length < 1}
      >
        <ChipGroup
          items={eligibleForAction}
          selectedIds={actionIds}
          onToggle={(id) => toggle(actionIds, setActionIds, id, 2)}
          accent="#0f0e3d"
        />
      </FunnelStep>

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!canContinue} nextLabel="Continue to Stage 3" />
    </div>
  );
}

function FunnelStep({
  label, hint, count, target, disabled, disabledHint, children,
}: {
  label: string; hint: string; count: number; target: number;
  disabled?: boolean; disabledHint?: string; children: React.ReactNode;
}) {
  const pctRaw = target > 0 ? Math.min(count / target, 1) * 100 : 0;
  return (
    <div className={`bg-white rounded-2xl border border-[#191772]/8 shadow-sm p-4 sm:p-5 mb-3 transition-opacity ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-bold text-[#191772]" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          {label}
        </h3>
        <span className="text-[11px] font-semibold text-[#191772]/50">{count}/{target}</span>
      </div>
      <div className="h-1 rounded-full bg-[#f5ebd9] overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-[#fd8664] to-[#e36a48] transition-all" style={{ width: `${pctRaw}%` }} />
      </div>
      <p className="text-[12px] text-[#191772]/50 mb-3">{hint}</p>
      {disabled ? (
        <p className="text-[12px] text-[#191772]/40 italic">{disabledHint || "Complete the step above first."}</p>
      ) : (
        children
      )}
    </div>
  );
}

function ChipGroup({
  items, selectedIds, onToggle, accent,
}: { items: Behavior[]; selectedIds: string[]; onToggle: (id: string) => void; accent: string }) {
  if (items.length === 0) {
    return <p className="text-[12px] text-[#191772]/40 italic">Nothing to choose from yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((b) => {
        const on = selectedIds.includes(b.id);
        return (
          <button
            key={b.id}
            onClick={() => onToggle(b.id)}
            className={`px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all text-left max-w-full ${
              on ? "text-white border-transparent shadow-sm" : "bg-[#f5ebd9]/40 border-[#191772]/10 text-[#191772]/80 hover:border-[#e36a48]/30"
            }`}
            style={on ? { background: accent } : undefined}
          >
            {b.text}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stage 3: Plan ──────────────────────────────────────────────────────────

function Stage3({
  behaviors, actionIds,
  barriersText, setBarriersText,
  confidence, setConfidence,
  confidenceReason, setConfidenceReason,
  supportText, setSupportText,
  onBack, onFinish,
}: {
  behaviors: Behavior[]; actionIds: string[];
  barriersText: string; setBarriersText: (v: string) => void;
  confidence: number | null; setConfidence: (n: number | null) => void;
  confidenceReason: string; setConfidenceReason: (v: string) => void;
  supportText: string; setSupportText: (v: string) => void;
  onBack: () => void; onFinish: () => void;
}) {
  const committed = behaviors.filter((b) => actionIds.includes(b.id));
  const canFinish = confidence != null && barriersText.trim().length > 5;

  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1.5 rounded-full bg-[#edddc3]/60 border border-[#191772]/8 text-[10px] uppercase tracking-widest font-bold text-[#191772]/70 mb-3">
          Committing to {committed.length === 1 ? "one behaviour" : `${committed.length} behaviours`}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          Let's make it happen.
        </h1>
        <div className="space-y-2 max-w-md mx-auto mt-4">
          {committed.map((b) => (
            <div key={b.id} className="bg-[#191772] text-[#edddc3] rounded-xl px-4 py-3 text-sm font-semibold text-left">
              {b.text}
            </div>
          ))}
        </div>
      </div>

      {/* Barriers */}
      <div className="bg-white rounded-2xl border border-[#191772]/8 shadow-sm p-4 sm:p-5 mb-4">
        <h3 className="text-sm font-bold text-[#191772] mb-1" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          What might get in the way?
        </h3>
        <p className="text-[12px] text-[#191772]/55 mb-3">
          Conversations you need to have, resources you need, schedule adjustments — name them now so we can plan for them.
        </p>
        <textarea
          value={barriersText}
          onChange={(e) => setBarriersText(e.target.value)}
          rows={6}
          placeholder="e.g. Long Wednesday evenings mean I skip dinner prep. Could batch on Sunday instead..."
          className="w-full bg-[#f5ebd9]/30 border border-[#191772]/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#e36a48] placeholder:text-[#191772]/30 resize-none"
        />
      </div>

      {/* Confidence */}
      <div className="bg-white rounded-2xl border border-[#191772]/8 shadow-sm p-4 sm:p-5 mb-4">
        <h3 className="text-sm font-bold text-[#191772] mb-1" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          How confident are you?
        </h3>
        <p className="text-[12px] text-[#191772]/55 mb-3">1 = "we'll see" · 10 = "100% locked in"</p>
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setConfidence(n)}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${
                confidence === n ? "text-white shadow-sm" : "bg-[#f5ebd9]/60 text-[#191772]/55 hover:bg-[#f5ebd9]"
              }`}
              style={confidence === n ? { background: confidence >= 7 ? "#191772" : confidence >= 4 ? "#e36a48" : "#fd8664" } : undefined}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={confidenceReason}
          onChange={(e) => setConfidenceReason(e.target.value)}
          placeholder="Why that number?"
          className="w-full bg-[#f5ebd9]/30 border border-[#191772]/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e36a48] placeholder:text-[#191772]/30"
        />
      </div>

      {/* Support */}
      <div className="bg-white rounded-2xl border border-[#191772]/8 shadow-sm p-4 sm:p-5 mb-6">
        <h3 className="text-sm font-bold text-[#191772] mb-1" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          How can your coach support you?
        </h3>
        <p className="text-[12px] text-[#191772]/55 mb-3">
          Final comments, ideas, ways you'd like accountability.
        </p>
        <textarea
          value={supportText}
          onChange={(e) => setSupportText(e.target.value)}
          rows={4}
          placeholder="Anything you want them to know going into the next call..."
          className="w-full bg-[#f5ebd9]/30 border border-[#191772]/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#e36a48] placeholder:text-[#191772]/30 resize-none"
        />
      </div>

      <NavButtons onBack={onBack} onNext={onFinish} nextDisabled={!canFinish} nextLabel="Submit worksheet" />
    </div>
  );
}

// ─── Stage 4: Summary ───────────────────────────────────────────────────────

function Summary({ state, onBack, onReset }: { state: State; onBack: () => void; onReset: () => void }) {
  const focus = state.focuses.find((f) => f.id === state.chosenFocusId);
  const action = state.behaviors.filter((b) => state.actionIds.includes(b.id));

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#fd8664] to-[#e36a48] grid place-items-center text-white text-3xl shadow-lg shadow-[#e36a48]/30">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          You're all set.
        </h1>
        <p className="text-sm text-[#191772]/60">
          Your coach will see this before your next call.
        </p>
      </div>

      <div className="bg-[#191772] text-[#edddc3] rounded-2xl p-5 sm:p-6 mb-4">
        <div className="text-[10px] uppercase tracking-widest text-[#edddc3]/60 font-bold mb-1">My focus</div>
        <div className="text-lg font-bold mb-4" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>{focus?.text || "—"}</div>
        <div className="text-[10px] uppercase tracking-widest text-[#edddc3]/60 font-bold mb-1">My commitment{action.length > 1 ? "s" : ""}</div>
        <ul className="space-y-1.5 mb-4">
          {action.map((b) => (
            <li key={b.id} className="text-sm flex items-start gap-2">
              <span className="text-[#fd8664] mt-0.5">→</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#edddc3]/15">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#edddc3]/60 font-bold mb-1">Confidence</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif" }}>{state.confidence}/10</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#edddc3]/60 font-bold mb-1">Why</div>
            <div className="text-xs text-[#edddc3]/85">{state.confidenceReason || "—"}</div>
          </div>
        </div>
      </div>

      {state.barriersText && (
        <div className="bg-white border border-[#191772]/8 rounded-2xl p-5 mb-4 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#191772]/60 mb-2">Barriers + plan</div>
          <p className="text-sm text-[#191772]/80 whitespace-pre-wrap leading-relaxed">{state.barriersText}</p>
        </div>
      )}

      {state.supportText && (
        <div className="bg-white border border-[#191772]/8 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#191772]/60 mb-2">Notes for coach</div>
          <p className="text-sm text-[#191772]/80 whitespace-pre-wrap leading-relaxed">{state.supportText}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#191772]/60 border border-[#191772]/15 hover:border-[#191772]/30 transition-colors">
          ← Edit
        </button>
        <button onClick={onReset} className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#fd8664] to-[#e36a48] shadow-md shadow-[#e36a48]/30 hover:opacity-90 transition-opacity">
          Start a new worksheet
        </button>
      </div>
    </div>
  );
}

// ─── Shared nav ─────────────────────────────────────────────────────────────

function NavButtons({
  onBack, onNext, nextDisabled, nextLabel,
}: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel: string }) {
  return (
    <div className="flex gap-3 mt-2">
      {onBack && (
        <button onClick={onBack} className="px-5 py-3 rounded-xl text-sm font-semibold text-[#191772]/60 border border-[#191772]/15 hover:border-[#191772]/30 transition-colors">
          ← Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#fd8664] to-[#e36a48] shadow-md shadow-[#e36a48]/30 hover:opacity-90 transition-opacity disabled:from-[#191772]/15 disabled:to-[#191772]/15 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}
