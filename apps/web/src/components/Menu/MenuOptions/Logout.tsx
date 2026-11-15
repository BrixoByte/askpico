import React from 'react';
import useProfileStore from '@store/profile-store';
import { closeActiveChat } from '@store/store';
import LogoutIcon from '@icon/LogoutIcon';
import { useIsSignedIn } from '@utils/authGate';
import { supabase } from '@api/supabase';

const Logout = () => {
  const setProfile = useProfileStore((state) => state.setProfile);
  const signedIn = useIsSignedIn();

  if (!signedIn) return null;

  const signOut = async () => {
    closeActiveChat();
    await supabase?.auth.signOut({ scope: 'local' });
    setProfile({ name: '', email: '' });
    window.location.reload();
  };

  return (
    <a
      className='flex py-2.5 px-3 items-center gap-3 rounded-lg hover:bg-gray-100/80 transition-colors text-ink cursor-pointer text-sm dark:hover:bg-neutral-800'
      onClick={signOut}
    >
      <LogoutIcon />
      Sign out
    </a>
  );
};

export default Logout;
