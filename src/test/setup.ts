import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { logout } from '@/lib/auth';

afterEach(() => {
  cleanup();
  logout(); // token do cliente HTTP e sessionStorage nao vazam entre testes
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
