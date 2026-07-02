import React from 'react';
import styles from './JobCard.module.css';

export interface Job {
  id: string;
  titel: string;
  foretag?: string;
  plats?: string;
  beskrivning?: string;
  url?: string;
  publiceringsdatum?: string;
}

export interface MatchResult {
  job: Job;
  score: number;       // 0.0 – 1.0
  motivering?: string;
}

interface Props {
  result: MatchResult;
  index: number;
}

function getScoreColor(score: number): string {
  if (score >= 0.75) return '#10b981';  // grön
  if (score >= 0.5) return '#f59e0b';   // gul
  return '#ef4444';                      // röd
}

function getScoreLabel(score: number): string {
  if (score >= 0.75) return 'Hög matchning';
  if (score >= 0.5) return 'Medel matchning';
  return 'Låg matchning';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const size = 64;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(score * 100);
  const offset = circumference - (pct / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className={styles.scoreRing} aria-label={`Matchningspoäng: ${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className={styles.scoreText} style={{ color }}>
        <span className={styles.scoreNumber}>{pct}</span>
        <span className={styles.scorePct}>%</span>
      </div>
    </div>
  );
};

const JobCard: React.FC<Props> = ({ result, index }) => {
  const { job, score, motivering } = result;
  const [expanded, setExpanded] = React.useState(false);
  const scoreColor = getScoreColor(score);

  return (
    <article
      className={styles.card}
      style={{ animationDelay: `${index * 80}ms` }}
      aria-label={`Jobb: ${job.titel}`}
    >
      <div className={styles.header}>
        <div className={styles.companyAvatar} aria-hidden="true">
          {(job.foretag ?? job.titel).charAt(0).toUpperCase()}
        </div>

        <div className={styles.titleBlock}>
          <h3 className={styles.jobTitle}>{job.titel}</h3>
          <div className={styles.meta}>
            {job.foretag && (
              <span className={styles.company}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {job.foretag}
              </span>
            )}
            {job.plats && (
              <span className={styles.location}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {job.plats}
              </span>
            )}
            {job.publiceringsdatum && (
              <span className={styles.date}>{formatDate(job.publiceringsdatum)}</span>
            )}
          </div>
        </div>

        <ScoreRing score={score} />
      </div>

      <div
        className={styles.scoreBar}
        style={{ '--score-pct': `${Math.round(score * 100)}%`, '--score-color': scoreColor } as React.CSSProperties}
        aria-hidden="true"
      >
        <div className={styles.scoreBarFill} />
        <span className={styles.scoreLabel} style={{ color: scoreColor }}>
          {getScoreLabel(score)}
        </span>
      </div>

      {motivering && (
        <p className={styles.motivering}>💡 {motivering}</p>
      )}

      {job.beskrivning && (
        <div className={styles.descriptionWrapper}>
          <p className={`${styles.description} ${expanded ? styles.expanded : ''}`}>
            {job.beskrivning}
          </p>
          {job.beskrivning.length > 200 && (
            <button
              id={`expand-btn-${job.id}`}
              className={styles.expandBtn}
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? 'Visa mindre ▲' : 'Läs mer ▼'}
            </button>
          )}
        </div>
      )}

      <div className={styles.footer}>
        {job.url ? (
          <a
            id={`apply-btn-${job.id}`}
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.applyBtn}
            aria-label={`Sök jobbet: ${job.titel}`}
          >
            Sök jobbet
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        ) : (
          <span className={styles.noLink}>Ingen länk tillgänglig</span>
        )}
      </div>
    </article>
  );
};

export default JobCard;
