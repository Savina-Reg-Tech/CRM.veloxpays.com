// Mirror of VeloxVerse frontend/src/components/profile/AvatarIllustration.tsx.

import { cn } from '@/lib/utils';
import { getAvatar, type AvatarDefinition } from '../avatars';

interface AvatarIllustrationProps {
  avatarId: string;
  className?: string;
  /** Unique prefix for SVG gradient ids when multiple avatars render on one page. */
  uid?: string;
}

function Hair({ def }: { def: AvatarDefinition }) {
  const { hair, hairStyle } = def;
  switch (hairStyle) {
    case 'long':
      return (
        <path
          d="M22 42 C18 28, 28 16, 50 16 C72 16, 82 28, 78 42 C76 36, 68 30, 50 30 C32 30, 24 36, 22 42 Z"
          fill={hair}
        />
      );
    case 'curly':
      return (
        <>
          <circle cx="30" cy="28" r="10" fill={hair} />
          <circle cx="50" cy="20" r="11" fill={hair} />
          <circle cx="70" cy="28" r="10" fill={hair} />
          <ellipse cx="50" cy="34" rx="28" ry="14" fill={hair} />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx="50" cy="18" r="12" fill={hair} />
          <path d="M24 40 C22 26, 34 18, 50 18 C66 18, 78 26, 76 40 Z" fill={hair} />
        </>
      );
    case 'spiky':
      return (
        <path
          d="M26 38 L30 18 L38 32 L44 14 L50 30 L56 14 L62 32 L70 18 L74 38 C70 30, 60 26, 50 26 C40 26, 30 30, 26 38 Z"
          fill={hair}
        />
      );
    case 'bald':
      return null;
    default:
      return (
        <path
          d="M26 40 C24 28, 34 18, 50 18 C66 18, 76 28, 74 40 C70 32, 62 28, 50 28 C38 28, 30 32, 26 40 Z"
          fill={hair}
        />
      );
  }
}

function Accessory({ def }: { def: AvatarDefinition }) {
  switch (def.accessory) {
    case 'glasses':
      return (
        <>
          <circle cx="38" cy="52" r="9" fill="none" stroke="#1e293b" strokeWidth="2.5" />
          <circle cx="62" cy="52" r="9" fill="none" stroke="#1e293b" strokeWidth="2.5" />
          <path d="M47 52 H53" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'sunglasses':
      return (
        <>
          <rect x="28" y="46" width="18" height="12" rx="4" fill="#0f172a" opacity="0.85" />
          <rect x="54" y="46" width="18" height="12" rx="4" fill="#0f172a" opacity="0.85" />
          <path d="M46 52 H54" stroke="#0f172a" strokeWidth="2.5" />
        </>
      );
    case 'headphones':
      return (
        <>
          <path
            d="M28 52 C28 36, 38 26, 50 26 C62 26, 72 36, 72 52"
            fill="none"
            stroke="#334155"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="22" y="48" width="10" height="16" rx="4" fill="#334155" />
          <rect x="68" y="48" width="10" height="16" rx="4" fill="#334155" />
        </>
      );
    case 'cap':
      return (
        <>
          <path d="M20 38 C24 24, 38 18, 50 18 C62 18, 76 24, 80 38 L50 34 Z" fill={def.shirt} />
          <path d="M18 38 H82 C78 44, 64 48, 50 48 C36 48, 22 44, 18 38 Z" fill={def.shirt} opacity="0.9" />
        </>
      );
    default:
      return null;
  }
}

export function AvatarIllustration({ avatarId, className, uid = 'a' }: AvatarIllustrationProps) {
  const def = getAvatar(avatarId);
  if (!def) return null;

  const gradId = `${uid}-${def.id}-bg`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`${def.label} avatar`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={def.bgFrom} />
          <stop offset="100%" stopColor={def.bgTo} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      <ellipse cx="50" cy="88" rx="30" ry="10" fill="#000" opacity="0.12" />
      <path d="M30 92 C34 72, 42 66, 50 66 C58 66, 66 72, 70 92 Z" fill={def.shirt} />
      <circle cx="50" cy="54" r="22" fill={def.skin} />
      <Hair def={def} />
      {def.accessory !== 'cap' && def.accessory !== 'sunglasses' && def.accessory !== 'glasses' && (
        <>
          <circle cx="40" cy="52" r="2.5" fill="#1e293b" />
          <circle cx="60" cy="52" r="2.5" fill="#1e293b" />
        </>
      )}
      <path
        d="M42 62 Q50 68 58 62"
        fill="none"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <Accessory def={def} />
      {def.accessory === 'glasses' || def.accessory === 'sunglasses' ? null : (
        def.accessory === 'headphones' ? (
          <>
            <circle cx="40" cy="52" r="2" fill="#1e293b" />
            <circle cx="60" cy="52" r="2" fill="#1e293b" />
          </>
        ) : null
      )}
    </svg>
  );
}
