import React, { useState } from 'react';
import CVUpload from './components/CVUpload';
import JobList from './components/JobList';
import type { MatchResult } from './components/JobCard';
import styles from './App.module.css';

// ── API-konfiguration ─────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface CVAnalysis {
  yrkestitel: string;
  kompetenser: string[];
  erfarenhet: string;
  plats?: string;
}

type AppStep = 'upload' | 'analyzing' | 'results' | 'error';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('upload');
  const [results, setResults] = useState<MatchResult[]>([]);
  const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState<string[]>([]);

  const addProgress = (msg: string) => setProgress((prev) => [...prev, msg]);

  const handleUpload = async (file: File) => {
    setStep('analyzing');
    setProgress([]);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      addProgress('📄 Läser CV-filen…');

      const response = await fetch(`${API_BASE}/match-jobs?max_results=10&use_embeddings=true`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Serverfel: ${response.status}`);
      }

      addProgress('🤖 AI analyserar dina kompetenser…');

      const data = await response.json();

      addProgress('🔍 Söker bland tusentals jobbannonser…');
      addProgress('📊 Rankar matchningar…');

      setCvAnalysis(data.cv_analysis);
      setResults(data.results || []);
      setStep('results');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ett okänt fel inträffade';
      setErrorMessage(message);
      setStep('error');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setResults([]);
    setCvAnalysis(null);
    setProgress([]);
    setErrorMessage('');
  };

  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className={styles.logoText}>JobMatch<span className={styles.logoAccent}>AI</span></span>
        </div>
        <div className={styles.headerBadge}>
          <span className={styles.liveIndicator} aria-label="Liveannonser från Arbetsförmedlingen" />
          Arbetsförmedlingen live-data
        </div>
      </header>

      <main className={styles.main} id="main-content">
        {/* ── Upload Step ── */}
        {(step === 'upload' || step === 'analyzing') && (
          <div className={`${styles.uploadPage} animate-slide-up`}>
            <div className={styles.hero}>
              <div className={styles.heroBadge}>
                <span>🧠</span> AI-driven jobbmatchning
              </div>
              <h1 className={styles.heroTitle}>
                Hitta ditt <span className={styles.gradient}>drömjobb</span><br />
                med AI-matchning
              </h1>
              <p className={styles.heroSubtitle}>
                Ladda upp ditt CV så matchar vi dig mot tusentals aktuella jobbannonser från Arbetsförmedlingen — gratis och på några sekunder.
              </p>
            </div>

            <div className={styles.uploadCard}>
              <CVUpload onUpload={handleUpload} isLoading={step === 'analyzing'} />

              {step === 'analyzing' && progress.length > 0 && (
                <div className={styles.progressLog} role="status" aria-live="polite">
                  {progress.map((msg, i) => (
                    <div
                      key={i}
                      className={styles.progressItem}
                      style={{ animationDelay: `${i * 200}ms` }}
                    >
                      {msg}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.features}>
              {[
                { icon: '📄', title: 'PDF & Bild', desc: 'Stöd för alla vanliga CV-format' },
                { icon: '🤖', title: 'Lokal AI', desc: 'Privat bearbetning med Ollama LLM' },
                { icon: '🏢', title: 'Live-annonser', desc: 'Direkt från Arbetsförmedlingen' },
                { icon: '⚡', title: 'Snabb ranking', desc: 'Embedding-baserad matchning' },
              ].map((f) => (
                <div key={f.title} className={`${styles.featureCard} glass-card`}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <p className={styles.featureTitle}>{f.title}</p>
                  <p className={styles.featureDesc}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results Step ── */}
        {step === 'results' && cvAnalysis && (
          <div className="animate-slide-up">
            <JobList
              results={results}
              cvAnalysis={cvAnalysis}
              onReset={handleReset}
            />
          </div>
        )}

        {/* ── Error Step ── */}
        {step === 'error' && (
          <div className={`${styles.errorPage} animate-fade-in`} role="alert">
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>Något gick fel</h2>
            <p className={styles.errorMessage}>{errorMessage}</p>
            <div className={styles.errorHints}>
              <p>Kontrollera att:</p>
              <ul>
                <li>Backend-servern körs på <code>localhost:8000</code></li>
                <li>Ollama körs (<code>ollama serve</code>)</li>
                <li>Modellen är nedladdad (<code>ollama pull llama3.2</code>)</li>
              </ul>
            </div>
            <button id="retry-btn" className="btn-primary" onClick={handleReset}>
              ← Försök igen
            </button>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          Jobbannonser från{' '}
          <a href="https://jobtechdev.se" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            Arbetsförmedlingens öppna API
          </a>{' '}
          · Öppen data CC0 · AI-bearbetning via Ollama
        </p>
      </footer>
    </div>
  );
};

export default App;
