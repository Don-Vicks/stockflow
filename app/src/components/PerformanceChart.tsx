import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function generateMockData() {
  const data = [];
  let currentValue = 10000;
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Random walk with a slight upward drift
    const change = (Math.random() - 0.45) * 200;
    currentValue += change;
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: currentValue,
    });
  }
  return data;
}

export function PerformanceChart() {
  const data = useMemo(() => generateMockData(), []);

  return (
    <div className="w-full h-48 border border-line bg-panel rounded-xl flex items-end relative overflow-hidden group p-4 pt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            hide 
          />
          <YAxis 
            hide 
            domain={['dataMin - 1000', 'dataMax + 1000']} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#151A22', 
              border: '1px solid #232A35',
              borderRadius: '8px',
              color: '#E9ECEF' 
            }}
            itemStyle={{ color: '#10b981' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any) => [`$${Number(value ?? 0).toFixed(2)}`, 'Portfolio Value']) as any}
            labelStyle={{ color: '#8891A1', marginBottom: '4px' }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
