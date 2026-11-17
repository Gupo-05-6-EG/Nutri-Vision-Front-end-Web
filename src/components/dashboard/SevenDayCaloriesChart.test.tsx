import { render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { cloneElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SevenDayCaloriesChart } from '@/components/dashboard/SevenDayCaloriesChart';
import type { DailyCaloriesPoint } from '@/types/dashboard';

// O jsdom não mede elementos, então o ResponsiveContainer não desenharia nada:
// troca por um contêiner de tamanho fixo.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div>
        {cloneElement(children as ReactElement<{ width?: number; height?: number }>, {
          width: 640,
          height: 280,
        })}
      </div>
    ),
  };
});

const dias: DailyCaloriesPoint[] = [
  { date: '2026-11-10', label: '10/11', goalKcal: 2000, consumedKcal: 1950, mealCount: 4 },
  { date: '2026-11-11', label: '11/11', goalKcal: 2000, consumedKcal: 2400, mealCount: 5 },
  { date: '2026-11-12', label: '12/11', goalKcal: 2000, consumedKcal: 0, mealCount: 0 },
];

describe('SevenDayCaloriesChart', () => {
  it('tem nome acessível', () => {
    render(<SevenDayCaloriesChart days={dias} />);
    expect(
      screen.getByRole('img', {
        name: 'Gráfico de 7 dias comparando meta calórica e consumo real',
      }),
    ).toBeInTheDocument();
  });

  it('desenha as linhas de meta e de consumo com a legenda e os dias', () => {
    const { container } = render(<SevenDayCaloriesChart days={dias} />);
    expect(screen.getByText('Meta Calórica (kcal)')).toBeInTheDocument();
    expect(screen.getByText('Consumo Real (kcal)')).toBeInTheDocument();
    for (const dia of ['10/11', '11/11', '12/11']) {
      expect(screen.getByText(dia)).toBeInTheDocument();
    }
    const linhas = container.querySelectorAll('path.recharts-line-curve');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveAttribute('stroke-dasharray', '6 4');
  });

  it('renderiza sem dados', () => {
    render(<SevenDayCaloriesChart days={[]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
