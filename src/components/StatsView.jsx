import { useState, useMemo } from "react";
import HistoryChart from "./HistoryChart";
import {
  filterHistory,
  summarize,
  personalBests,
  formatDuration,
  formatDate,
  timeAgo,
  configLabel,
  PB_TIME,
  PB_WORDS,
} from "../utils/stats";
import "./StatsView.css";

const PAGE = 8;

function PbTable({ title, unit, lengths, kind, pbs, topId }) {
  return (
    <table className="pb-table">
      <thead>
        <tr>
          <th className="label pb-corner">{title}</th>
          {lengths.map((l) => (
            <th key={l} className="num pb-head">
              {l}
              <span className="pb-unit">{unit}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {["words", "sentences"].map((mode) => (
          <tr key={mode}>
            <th className="pb-row">{mode}</th>
            {lengths.map((l) => {
              const t = pbs[`${mode}|${kind}|${l}`];
              return (
                <td
                  key={l}
                  className={`num pb-cell ${t ? "" : "empty"} ${t && t.id === topId ? "top" : ""}`}
                  title={t ? `${t.accuracy}% accuracy · ${formatDate(t.completedAt)}` : "no tests yet"}
                >
                  {t ? t.wpm : "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StatsView({ tests, races = [], emptyMessage, emptyAction }) {
  const [filter, setFilter] = useState("solo");
  const [shown, setShown] = useState(PAGE);

  const items = useMemo(() => filterHistory(tests, races, filter), [tests, races, filter]);
  const summary = useMemo(() => summarize(items), [items]);
  const pbs = useMemo(() => personalBests(tests), [tests]);
  const topId = useMemo(() => summarize(tests)?.best.id, [tests]);

  const modeCounts = useMemo(() => {
    const counts = { words: 0, sentences: 0, quotes: 0 };
    for (const t of tests) counts[t.mode || "words"] = (counts[t.mode || "words"] || 0) + 1;
    return counts;
  }, [tests]);

  const filters = [
    { key: "solo", label: "all tests", count: tests.length },
    { key: "words", label: "words", count: modeCounts.words },
    { key: "sentences", label: "sentences", count: modeCounts.sentences },
  ];
  if (modeCounts.quotes) filters.push({ key: "quotes", label: "quotes", count: modeCounts.quotes });
  if (races.length) filters.push({ key: "races", label: "races", count: races.length });

  if (!tests.length && !races.length) {
    return (
      <div className="stats-empty">
        <div className="stats-empty-ruler" aria-hidden="true">
          {Array.from({ length: 41 }, (_, i) => (
            <span key={i} style={{ height: i % 5 === 0 ? 10 : 5 }} />
          ))}
        </div>
        <p>{emptyMessage || "No tests yet."}</p>
        {emptyAction}
      </div>
    );
  }

  const isRaces = filter === "races";

  return (
    <div className="stats-view">
      <div className="filter-tabs" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`filter-tab ${filter === f.key ? "active" : ""}`}
            onClick={() => {
              setFilter(f.key);
              setShown(PAGE);
            }}
            disabled={f.count === 0}
          >
            {f.label}
            <span className="filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      {summary ? (
        <>
          <div className="headline">
            <div className="headline-cell primary">
              <span className="label">
                {summary.recentCount < 10 ? `avg of ${summary.recentCount}` : "last 10 avg"}
              </span>
              <div className="headline-value">
                <span className="num">{summary.recentAvg}</span>
                {summary.trend !== null && summary.trend !== 0 && (
                  <span
                    className={`trend ${summary.trend > 0 ? "up" : "down"}`}
                    title="compared with the 10 before"
                  >
                    {summary.trend > 0 ? "▲" : "▼"} {Math.abs(summary.trend)}
                  </span>
                )}
              </div>
            </div>
            <div className="headline-cell">
              <span className="label">best</span>
              <span className="num headline-num accent">{summary.best.wpm}</span>
              <span className="headline-sub">{formatDate(summary.best.completedAt)}</span>
            </div>
            <div className="headline-cell">
              <span className="label">accuracy</span>
              <span className="num headline-num">
                {summary.avgAccuracy}
                <span className="headline-unit">%</span>
              </span>
              <span className="headline-sub">average</span>
            </div>
            <div className="headline-cell">
              <span className="label">{isRaces ? "races" : "tests"}</span>
              <span className="num headline-num">{summary.count}</span>
              <span className="headline-sub">
                {isRaces ? `${summary.wins} won` : `avg ${summary.avgWpm} wpm`}
              </span>
            </div>
            <div className="headline-cell">
              <span className="label">{isRaces ? "win rate" : "time typed"}</span>
              <span className="num headline-num">
                {isRaces ? (
                  <>
                    {summary.winRate}
                    <span className="headline-unit">%</span>
                  </>
                ) : (
                  formatDuration(summary.totalTime)
                )}
              </span>
              <span className="headline-sub">{isRaces ? "first place" : "in total"}</span>
            </div>
          </div>

          <section className="stats-section">
            <div className="section-head">
              <span className="label">history</span>
              <span className="section-note">
                {items.length > 200 ? `latest 200 of ${items.length}` : `${items.length} ${isRaces ? "races" : "tests"}`}
                <span className="history-key">
                  <i className="sw bar" /> best <i className="sw line" /> 10-test average
                </span>
              </span>
            </div>
            <HistoryChart items={items} bestId={summary.best.id} />
          </section>
        </>
      ) : (
        <p className="muted-note">Nothing here yet.</p>
      )}

      {tests.length > 0 && (
        <section className="stats-section">
          <div className="section-head">
            <span className="label">personal bests</span>
            <span className="section-note">hover a score for details</span>
          </div>
          <div className="pb-grid">
            <PbTable title="seconds" unit="s" lengths={PB_TIME} kind="t" pbs={pbs} topId={topId} />
            <PbTable title="words" unit="w" lengths={PB_WORDS} kind="w" pbs={pbs} topId={topId} />
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="stats-section">
          <div className="section-head">
            <span className="label">log</span>
            <span className="section-note">newest first</span>
          </div>
          <ol className="log">
            {items.slice(0, shown).map((t) => (
              <li key={t.id} className="log-row">
                <span className="num log-wpm">
                  {t.wpm}
                  <span className="log-unit">wpm</span>
                </span>
                <span className="log-acc">{t.accuracy}%</span>
                <span className="log-config">{configLabel(t)}</span>
                <span className="log-tag">
                  {t.placement ? (
                    <span className={`tag ${t.won ? "win" : ""}`}>
                      {t.won ? "won" : `${t.placement} / ${t.totalParticipants}`}
                    </span>
                  ) : (
                    t.id === topId && <span className="tag win">pb</span>
                  )}
                </span>
                <span className="log-time">{timeAgo(t.completedAt)}</span>
              </li>
            ))}
          </ol>
          {items.length > shown && (
            <button className="text-btn log-more" onClick={() => setShown((n) => n + 20)}>
              show more <span>({items.length - shown})</span>
            </button>
          )}
        </section>
      )}
    </div>
  );
}
