import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordStrength, passwordStrength } from '@/components/PasswordStrength';

describe('PasswordStrength', () => {
  it('classifica a senha', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefghijkl')).toBe(2);
    expect(passwordStrength('Abcdefghijkl')).toBe(3);
    expect(passwordStrength('Abcdefghij1!')).toBe(4);
  });

  it('mostra o rotulo e some sem senha', () => {
    const { rerender, container } = render(<PasswordStrength password="Abcdefghij1!" />);
    expect(screen.getByText('Força da senha: Forte')).toBeInTheDocument();
    rerender(<PasswordStrength password="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
