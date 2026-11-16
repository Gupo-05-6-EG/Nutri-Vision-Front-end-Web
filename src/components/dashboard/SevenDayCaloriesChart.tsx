/**
 * Gráfico de linhas (Recharts) de 7 dias comparando "Linha de Meta Calórica"
 * (fixa) vs "Linha de Consumo Real" (Task 5.2, RF07.1).
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyCaloriesPoint } from '@/types/dashboard';

export interface SevenDayCaloriesChartProps {
  days: DailyCaloriesPoint[];
}

export function SevenDayCaloriesChart({ days }: SevenDayCaloriesChartProps) {
  return (
    <div
      className="dashboard__chart"
      role="img"
      aria-label="Gráfico de 7 dias comparando meta calórica e consumo real"
    >
      <ResponsiveContainer width="100%" height={280} minWidth={320} minHeight={240}>
        <LineChart data={days} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted)" />
          <YAxis stroke="var(--muted)" unit=" kcal" width={80} />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              `${Number(value ?? 0).toLocaleString('pt-BR')} kcal`,
              String(name ?? ''),
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="goalKcal"
            name="Meta Calórica (kcal)"
            stroke="#9a6700"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="consumedKcal"
            name="Consumo Real (kcal)"
            stroke="#2e7d4f"
            strokeWidth={3}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
