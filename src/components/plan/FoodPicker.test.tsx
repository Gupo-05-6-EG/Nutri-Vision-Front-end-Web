import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FoodPicker } from '@/components/plan/FoodPicker';
import { arroz, fakeApi, frango, json } from '@/test/fakeApi';
import type { TacoFood } from '@/types/plan';

/** FoodPicker controlado, como o MealBlockEditor usa. */
function Harness({ onPick = vi.fn() }: { onPick?: (food: TacoFood) => void }) {
  const [value, setValue] = useState('');
  const [tacoId, setTacoId] = useState<number | null>(null);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <FoodPicker
        value={value}
        tacoId={tacoId}
        invalid={false}
        onType={(name) => {
          setValue(name);
          setTacoId(null);
        }}
        onPick={(food) => {
          setValue(food.nome);
          setTacoId(food.id);
          onPick(food);
        }}
      />
    </form>
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Alimento' });

describe('FoodPicker', () => {
  it('nao busca com menos de 2 caracteres', async () => {
    const { fetchMock } = fakeApi({ 'GET /alimentos-taco': () => json([arroz]) });
    render(<Harness />);

    await userEvent.type(combobox(), 'a');
    await new Promise((r) => setTimeout(r, 400));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('busca uma vez so depois de parar de digitar (debounce)', async () => {
    const { calls } = fakeApi({ 'GET /alimentos-taco': () => json([arroz]) });
    render(<Harness />);

    await userEvent.type(combobox(), 'arroz');

    expect(await screen.findByRole('option', { name: /Arroz/ })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/alimentos-taco?nome=arroz&limite=8');
  });

  it('codifica o termo na URL', async () => {
    const { calls } = fakeApi({ 'GET /alimentos-taco': () => json([]) });
    render(<Harness />);

    await userEvent.type(combobox(), 'pão & mel');
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].path).toBe(`/alimentos-taco?nome=${encodeURIComponent('pão & mel')}&limite=8`);
  });

  it('teclado: setas navegam, Enter escolhe, lista fecha', async () => {
    const onPick = vi.fn();
    fakeApi({ 'GET /alimentos-taco': () => json([arroz, frango]) });
    render(<Harness onPick={onPick} />);
    const user = userEvent.setup();

    await user.type(combobox(), 'ar');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('option', { name: /Frango/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}'); // volta ao primeiro
    expect(screen.getByRole('option', { name: /Arroz/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}'); // do primeiro vai ao ultimo
    await user.keyboard('{Enter}');

    expect(onPick).toHaveBeenCalledWith(frango);
    expect(combobox()).toHaveValue(frango.nome);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTitle('Alimento ligado à tabela TACO')).toBeInTheDocument();
  });

  it('Escape fecha a lista sem escolher', async () => {
    const onPick = vi.fn();
    fakeApi({ 'GET /alimentos-taco': () => json([arroz]) });
    render(<Harness onPick={onPick} />);
    const user = userEvent.setup();

    await user.type(combobox(), 'arroz');
    await screen.findByRole('option');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('falha na busca nao quebra: segue como texto livre', async () => {
    fakeApi({ 'GET /alimentos-taco': () => new Response('', { status: 500 }) });
    render(<Harness />);

    await userEvent.type(combobox(), 'arroz');
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox()).toHaveValue('arroz');
  });

  it('ignora a resposta de uma busca antiga', async () => {
    const pending: Record<string, (r: Response) => void> = {};
    fakeApi({
      'GET /alimentos-taco': (call) =>
        new Promise<Response>((resolve) => {
          pending[new URLSearchParams(call.path.split('?')[1]).get('nome')!] = resolve;
        }),
    });
    render(<Harness />);
    const user = userEvent.setup();

    await user.type(combobox(), 'arr');
    await vi.waitFor(() => expect(pending.arr).toBeDefined());
    await user.type(combobox(), 'oz');
    await vi.waitFor(() => expect(pending.arroz).toBeDefined());

    pending.arroz(json([arroz]));
    await screen.findByRole('option', { name: /Arroz/ });
    pending.arr(json([frango])); // chega depois, ja obsoleta
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByRole('option', { name: /Frango/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
