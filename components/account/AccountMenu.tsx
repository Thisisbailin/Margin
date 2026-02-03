import React, { useMemo, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import AboutModal from './AboutModal';

interface AccountMenuProps {
  onOpenTraffic: () => void;
  onOpenSettings: () => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ onOpenTraffic, onOpenSettings }) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const initials = useMemo(() => {
    const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || '';
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user?.fullName, user?.username, user?.primaryEmailAddress?.emailAddress]);

  const handleOpenTraffic = () => {
    setIsOpen(false);
    onOpenTraffic();
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    onOpenSettings();
  };

  const handleOpenAbout = () => {
    setIsOpen(false);
    setIsAboutOpen(true);
  };

  return (
    <div className="relative">
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-11 h-11 rounded-full border border-black/10 bg-white shadow-soft overflow-hidden flex items-center justify-center hover:border-accent/40 transition"
        aria-label="Account Menu"
      >
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-ink">{initials}</span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-[130] bg-transparent"
            aria-label="Close account menu"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 mt-4 w-80 bg-paper border border-black/5 rounded-2xl shadow-float overflow-hidden animate-fade-in z-[140]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-black/5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-black/10 bg-white overflow-hidden flex items-center justify-center">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-ink">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-ink truncate">{user?.fullName || user?.username || 'Researcher'}</div>
                <div className="text-[11px] text-gray-400 truncate">{user?.primaryEmailAddress?.emailAddress || 'Account'}</div>
              </div>
            </div>

            <div className="px-2 py-2">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.25em] text-gray-400">Projects</div>
              <button
                onClick={handleOpenTraffic}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition text-left"
              >
                <span className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m6 14V8m6 11V11m4 8V4" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">Traffic</div>
                  <div className="text-[11px] text-gray-400">Token metrics & usage</div>
                </div>
              </button>
              <button
                onClick={handleOpenSettings}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition text-left"
              >
                <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75h4.5m-5.25 0h6a2.25 2.25 0 012.25 2.25v12A2.25 2.25 0 0115.25 20.25h-6A2.25 2.25 0 017 18V6A2.25 2.25 0 019.75 3.75z" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">Settings</div>
                  <div className="text-[11px] text-gray-400">Models & preferences</div>
                </div>
              </button>
              <button
                onClick={handleOpenAbout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition text-left"
              >
                <span className="w-8 h-8 rounded-full bg-ink/5 text-ink flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25h1.5v4.5h-1.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h.008v.008H12z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">About</div>
                  <div className="text-[11px] text-gray-400">Manifesto & principles</div>
                </div>
              </button>
            </div>

            <div className="px-2 py-2 border-t border-black/5">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition text-left"
              >
                <span className="w-8 h-8 rounded-full bg-black/5 text-gray-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3-3m0 0l3 3m-3-3v12" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">Sign out</div>
                  <div className="text-[11px] text-gray-400">End this session</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountMenu;
