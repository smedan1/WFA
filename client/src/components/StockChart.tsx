import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { HistoricalDataPoint } from '../types';

interface Props {
  data: HistoricalDataPoint[];
  type: 'BUY' | 'SELL';
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-gray-400">{label}</p>
      <p className="font-bold text-white">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export function StockChart({ data, type, height = 80 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-gray-600 font-mono">
        No chart data
      </div>
    );
  }

  const color = type === 'BUY' ? '#22c55e' : '#ef4444';
  const gradientId = `gradient-${type.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    close: d.close,
  }));

  const prices = chartData.map((d) => d.close);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis domain={[minPrice, maxPrice]} hide />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="close"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
