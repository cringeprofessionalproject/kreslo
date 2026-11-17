import type { JobPack, ProKnowledgeEntry } from '../types';
import { useSheetPullToDismiss } from './useNativeGestures';

interface ProInsightModalProps {
  pack: JobPack;
  entry: ProKnowledgeEntry;
  wasSmartChoice: boolean;
  sessionHits: number;
  sessionTotal: number;
  onClose: () => void;
}

export function ProInsightModal({
  pack,
  entry,
  wasSmartChoice,
  sessionHits,
  sessionTotal,
  onClose,
}: ProInsightModalProps) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);
  const iqPct = sessionTotal > 0 ? Math.round((sessionHits / sessionTotal) * 100) : 100;

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet apple-clean-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="pw-top-row">
          <span className={`ee-pill ${wasSmartChoice ? 'ok' : 'fail'}`}>
            {wasSmartChoice ? 'Верный ход' : `Частая ловушка (${entry.crowdFailPct}%)`}
          </span>
          <span className="ee-meta">Опыт {iqPct}%</span>
        </div>

        <div className="acs-header">
          <span className="acs-subtag">{entry.normTag}</span>
          <h3 className="acs-title">{entry.shortFact}</h3>
          <p className="acs-body">{entry.deepWhy}</p>
        </div>

        <div className="ios-grouped-row">
          <div className="igr-labels">
            <strong>Точных решений в «{pack.shortTitle}»</strong>
          </div>
          <span className="igr-value">
            {sessionHits} из {sessionTotal}
          </span>
        </div>

        <button type="button" className="apple-sheet-btn secondary" onClick={onClose}>
          Готово
        </button>
      </div>
    </div>
  );
}
