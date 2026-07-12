import React from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const FEATURES = [
  {
    icon: '🔀',
    title: '4 services, one flow',
    description: 'Spotify, YouTube, Yandex Music, and Deezer — paste a tracklist to import, export any playlist to text, or bridge two services directly.',
  },
  {
    icon: '🎯',
    title: 'Smart matching',
    description: 'Every match is confidence-scored. High-confidence hits are added automatically; anything uncertain lands in a review queue for you to pick.',
  },
  {
    icon: '📦',
    title: 'Bulk migration',
    description: 'Move several playlists at once, with search and select-all for larger libraries — one queue, not one-at-a-time.',
  },
  {
    icon: '🔁',
    title: 'Resumable by default',
    description: 'A rate limit, a quota cap, a closed tab — even a crash — all leave an accurate checkpoint. Pick up exactly where it stopped.',
  },
];

const STEPS = [
  { n: '1', title: 'Choose your services', description: 'Pick where your tracklist is coming from and where it should go.' },
  { n: '2', title: 'Connect your accounts', description: 'Log in to whichever services you picked — nothing is stored anywhere but your own browser.' },
  { n: '3', title: 'Let it run', description: 'Matching, batching, and retries happen automatically. Resume anytime from History.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <h2 className="landing-title">Move your music between services</h2>
        <p className="landing-subtitle">
          Paste a tracklist and turn it into a playlist, export a playlist back to text, or bridge two services directly —
          without re-typing a single track.
        </p>
        <button type="button" className="btn btn-primary btn-lg" onClick={onGetStarted}>
          Get Started →
        </button>
      </section>

      <section className="landing-features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="landing-feature-card glass-panel" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="landing-feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p className="description-text">{f.description}</p>
          </div>
        ))}
      </section>

      <section className="landing-steps glass-panel">
        <h3>How it works</h3>
        <div className="landing-steps-row">
          {STEPS.map((s) => (
            <div key={s.n} className="landing-step">
              <div className="landing-step-number">{s.n}</div>
              <div>
                <h4>{s.title}</h4>
                <p className="description-text">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="form-actions center-align mt-4">
          <button type="button" className="btn btn-primary btn-lg" onClick={onGetStarted}>
            Get Started →
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <a href="https://github.com/yankvasya/transfer-music" target="_blank" rel="noopener noreferrer">
          View source on GitHub
        </a>
      </footer>
    </div>
  );
};
