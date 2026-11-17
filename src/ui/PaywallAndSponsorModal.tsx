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
        className="info-sheet pro-insight-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="pw-top-row">
          <span className={`stamp-pill ${wasSmartChoice ? 'ok' : 'fail'}`}>
            {wasSmartChoice
              ? 'ВЕРНЫЙ ХОД'
              : `ЧАСТАЯ ОШИБКА (${entry.crowdFailPct}% ИГРОКОВ)`}
          </span>
          <span className="iq-live-chip">Опыт {iqPct}%</span>
        </div>

        <div className="norm-badge-line">{entry.normTag}</div>

        <h3 className="sheet-serif-title">{entry.shortFact}</h3>
        <p className="info-lead">{entry.deepWhy}</p>

        <div className="info-danger-card safe">
          <strong>
            Точных решений в «{pack.shortTitle}»: {sessionHits} из {sessionTotal}
          </strong>
        </div>

        <button type="button" className="cta-btn subtle" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
