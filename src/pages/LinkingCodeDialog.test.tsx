import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LinkingCodeDialog, linkCodeUri } from '@/pages/LinkingCodeDialog';
import { fakeApi, json } from '@/test/fakeApi';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async (text: string) => `data:image/png;base64,${btoa(text)}`) },
}));

describe('LinkingCodeDialog', () => {
  it('so gera o codigo quando o nutricionista pede, com QR Code', async () => {
    const { calls } = fakeApi({
      'POST /linking-code': () =>
        json({ codigo: '482913', status: 'ativo', expira_em: '2026-11-20T12:00:00Z' }),
    });
    const onClose = vi.fn();
    const { rerender } = render(<LinkingCodeDialog open={false} onClose={onClose} />);
    expect(calls).toHaveLength(0);

    rerender(<LinkingCodeDialog open onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Código de vinculação' })).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gerar código' }));

    expect(await screen.findByLabelText('Código 482913')).toHaveTextContent('482913');
    expect(screen.getByRole('img', { name: 'QR Code do código 482913' })).toHaveAttribute(
      'src',
      `data:image/png;base64,${btoa(linkCodeUri('482913'))}`,
    );
    expect(screen.getByText(/Válido até/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar novo código' })).toBeInTheDocument();
    expect(calls).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('mostra o erro da API', async () => {
    fakeApi({ 'POST /linking-code': () => json({ detail: 'Perfil nao autorizado' }, 403) });
    render(<LinkingCodeDialog open onClose={() => {}} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Gerar código' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('o QR leva o codigo no formato que o app le', () => {
    expect(linkCodeUri('123456')).toBe('nutrivision://vinculo?codigo=123456');
  });
});
