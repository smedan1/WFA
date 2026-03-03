import { captureMobileTabSwitched } from '../lib/analytics';

export type MobileTab = 'buy' | 'sell' | 'analyze';

interface Props {
  tab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  buyCount?: number;
  sellCount?: number;
}

const TABS: Array<{
  id: MobileTab;
  label: string;
  icon: string;
  activeColor: string;
  activeBorder: string;
}> = [
  { id: 'buy',     label: 'BUY',     icon: '▲', activeColor: 'text-buy',       activeBorder: 'border-buy' },
  { id: 'sell',    label: 'SELL',    icon: '▼', activeColor: 'text-sell',      activeBorder: 'border-sell' },
  { id: 'analyze', label: 'LOOKUP',  icon: '⊙', activeColor: 'text-yellow-400', activeBorder: 'border-yellow-400' },
];

export function MobileBottomNav({ tab, onTabChange, buyCount, sellCount }: Props) {
  const counts: Partial<Record<MobileTab, number | undefined>> = { buy: buyCount, sell: sellCount };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => { if (t.id !== tab) { captureMobileTabSwitched({ from_tab: tab, to_tab: t.id }); } onTabChange(t.id); }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 pb-2.5 transition-colors ${
                isActive ? t.activeColor : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className={`absolute top-0 left-4 right-4 h-0.5 rounded-full ${t.activeBorder} bg-current`} />
              )}
              <span className="text-sm leading-none mt-1">{t.icon}</span>
              <span className="text-[10px] font-bold font-mono tracking-wider leading-none">{t.label}</span>
              {count != null && count > 0 && (
                <span className={`text-[9px] font-mono leading-none ${isActive ? 'opacity-70' : 'text-gray-700'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
