import React, { useMemo, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { UserProficiency } from '../../types';
import AccountTraffic from './AccountTraffic';
import AccountSettings from './AccountSettings';

interface AccountMenuProps {
  userId?: string;
  projectId?: string;
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({
  userId,
  projectId,
  proficiency,
  onProficiencyChange
}) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'traffic' | 'settings'>('traffic');

  const initials = useMemo(() => {
    const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || '';
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user?.fullName, user?.username, user?.primaryEmailAddress?.emailAddress]);

  return (
    <div className="relative">
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
        <div className="fixed inset-0 z-[140]">
          <button
            className="absolute inset-0 bg-transparent"
            aria-label="Close account menu"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute top-20 right-12 w-[720px] max-w-[90vw] h-[78vh] bg-paper border border-black/5 rounded-[2rem] shadow-float overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-black/10 bg-white overflow-hidden flex items-center justify-center">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-ink">{initials}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">{user?.fullName || user?.username || 'Researcher'}</div>
                    <div className="text-[11px] text-gray-400">{user?.primaryEmailAddress?.emailAddress || 'Account'}</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 transition"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-6 px-6 py-4 border-b border-black/5">
                {([
                  { key: 'traffic' as const, label: 'Traffic' },
                  { key: 'settings' as const, label: 'Settings' }
                ]).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`text-xl font-display transition ${
                      tab === item.key ? 'text-ink' : 'text-ink/20 hover:text-ink/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6">
                {tab === 'traffic' ? (
                  <AccountTraffic
                    userId={userId}
                    projectId={projectId}
                    isActive={tab === 'traffic'}
                    className=""
                  />
                ) : (
                  <AccountSettings
                    proficiency={proficiency}
                    onProficiencyChange={onProficiencyChange}
                    isActive={tab === 'settings'}
                  />
                )}
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-black/5 bg-white/60">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Account</div>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 rounded-full border border-black/10 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-accent/30 hover:text-accent transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
