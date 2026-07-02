import React from 'react';
import JobCard from './JobCard';
import type { MatchResult } from './JobCard';
import styles from './JobList.module.css';

interface CVAnalysis {
  yrkestitel: string;
  kompetenser: string[];
  erfarenhet: string;
  plats?: string;
}

interface Props {
  results: MatchResult[];
  cvAnalysis: CVAnalysis;
  onReset: () => void;
}

const JobList: React.FC<Props> = ({ results, cvAnalysis, onReset }) => {
  const highMatches = results.filter((r) => r.score >= 0.75).length;
  const mediumMatches = results.filter((r) => r.score >= 0.5 && r.score < 0.75).length;

  return (
    <div className={styles.container}>
      {/* CV-sammanfattning */}
      <section className={`${styles.cvSummary} glass-card`} aria-label="Din CV-profil">
        <div className={styles.cvHeader}>
          <div className={styles.cvAvatar} aria-hidden="true">
            {cvAnalysis.yrkestitel.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className={styles.cvTitle}>{cvAnalysis.yrkestitel}</h2>
            {cvAnalysis.plats && (
              <p className={styles.cvLocation}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {cvAnalysis.plats}
              </p>
            )}
          </div>
        </div>

        {cvAnalysis.kompetenser.length > 0 && (
          <div className={styles.skills}>
            {cvAnalysis.kompetenser.map((skill) => (
              <span key={skill} className="chip chip-accent">{skill}</span>
            ))}
          </div>
        )}

        {cvAnalysis.erfarenhet && (
          <p className={styles.experience}>{cvAnalysis.erfarenhet}</p>
        )}
      </section>

      {/* Statistik */}
      <div className={styles.stats} role="region" aria-label="Matchningsstatistik">
        <div className={styles.statCard}>
          <span className={styles.statNumber}>{results.length}</span>
          <span className={styles.statLabel}>Totalt hittade</span>
        </div>
        <div className={styles.statCard} style={{ '--stat-color': '#10b981' } as React.CSSProperties}>
          <span className={styles.statNumber} style={{ color: '#10b981' }}>{highMatches}</span>
          <span className={styles.statLabel}>Hög matchning (≥75%)</span>
        </div>
        <div className={styles.statCard} style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
          <span className={styles.statNumber} style={{ color: '#f59e0b' }}>{mediumMatches}</span>
          <span className={styles.statLabel}>Medel matchning</span>
        </div>
      </div>

      {/* Jobblista */}
      <section aria-label="Matchade jobb">
        <div className={styles.listHeader}>
          <h3 className={styles.listTitle}>
            Matchade jobbannonser
            <span className={styles.badge}>{results.length}</span>
          </h3>
          <button id="reset-btn" className="btn-secondary" onClick={onReset}>
            ↑ Ladda upp nytt CV
          </button>
        </div>

        {results.length === 0 ? (
          <div className={styles.empty}>
            <p>Inga matchningar hittades. Prova att uppdatera ditt CV eller vänta och försök igen.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {results.map((result, index) => (
              <JobCard key={result.job.id || index} result={result} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default JobList;
