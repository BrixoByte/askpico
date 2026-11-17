// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@api/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

import AuthModal from './AuthModal';

afterEach(() => cleanup());

describe('sign-in form', () => {
  it('renders only email/password sign-in — no magic-link control', () => {
    render(<AuthModal embedded onClose={vi.fn()} onSignedIn={vi.fn()} />);
    // Magic-link sign-in was removed: no button/link/input mentions it.
    expect(screen.queryByText(/magic/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /link/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /link/i })).toBeNull();
    // Email + password + submit are the only credentials path.
    expect(document.getElementById('auth-signin-email')).not.toBeNull();
    expect(document.getElementById('auth-signin-password')).not.toBeNull();
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeNull();
  });
});
