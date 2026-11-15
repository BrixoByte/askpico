import { useEffect, useState } from 'react';
import { isSignedInSession, supabase } from '@api/supabase';
import useAuthGateStore from '@store/auth-gate-store';

// Runs the action only for signed-in accounts. Guests see the sign-in prompt
// instead, so costly or persistent features never reach the server anonymously.
export const gateSignedIn = async (message: string, action: () => void): Promise<void> => {
  if (await isSignedInSession()) {
    action();
    return;
  }
  useAuthGateStore.getState().open(message);
};

export const useIsSignedIn = (): boolean => {
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    isSignedInSession().then((value) => {
      if (!cancelled) setSignedIn(value);
    });
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session && !session.user.is_anonymous);
    });
    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
};
