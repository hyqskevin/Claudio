import SlideUpPanel from "./SlideUpPanel";

interface DjPanelProps {
  visible: boolean;
  onClose: () => void;
}

const STATION_TAGS = ["Electronic", "Chill", "Ambient", "Lo-fi", "Jazz", "Indie"];

const TASTE_ITEMS = [
  { label: "Energy", pct: 72 },
  { label: "Mood", pct: 58 },
  { label: "Tempo", pct: 85 },
  { label: "Variety", pct: 64 },
];

export default function DjPanel({ visible, onClose }: DjPanelProps) {
  return (
    <SlideUpPanel visible={visible} onClose={onClose} title="About Claudio">
      <div className="dj-panel-section">
        <div className="dj-panel-info">
          <div className="dj-panel-avatar">
            <span style={{ fontSize: 24 }}>🎧</span>
          </div>
          <div>
            <div className="dj-panel-name">CLAUDIO</div>
            <div className="dj-panel-desc">
              Your AI music companion. I curate playlists based on your mood, context, and listening
              history.
            </div>
          </div>
        </div>
      </div>

      <div className="dj-panel-section">
        <div className="dj-panel-section-title">Station Style</div>
        <div className="dj-panel-tags">
          {STATION_TAGS.map((tag) => (
            <span key={tag} className="dj-panel-tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="dj-panel-section">
        <div className="dj-panel-section-title">Taste Profile</div>
        {TASTE_ITEMS.map((item) => (
          <div key={item.label} className="taste-skeleton-row">
            <span className="taste-skeleton-label">{item.label}</span>
            <div className="taste-skeleton-bar">
              <div className="taste-skeleton-fill" style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
          Taste profile will evolve as you listen more
        </div>
      </div>
    </SlideUpPanel>
  );
}
