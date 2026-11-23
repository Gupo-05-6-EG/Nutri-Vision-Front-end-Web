import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setAuthToken, setUnauthorizedHandler } from '@/lib/api';

afterEach(() => {
  cleanup();
  // Token do cliente HTTP e sessao salva nao vazam entre testes.
  setAuthToken(null);
  setUnauthorizedHandler(null);
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
