// Mirror of VeloxVerse frontend/src/lib/avatars.ts — the preset profile illustrations a customer
// can pick. Keep in sync if VeloxVerse adds presets (an unknown id falls back to initials).
/** Preset avatar identifiers — must stay in sync with backend/src/constants/avatars.ts */
export const AVATAR_IDS = [
  'velox-01',
  'velox-02',
  'velox-03',
  'velox-04',
  'velox-05',
  'velox-06',
  'velox-07',
  'velox-08',
  'velox-09',
  'velox-10',
  'velox-11',
  'velox-12',
  'velox-13',
  'velox-14',
  'velox-15',
  'velox-16',
  'velox-17',
  'velox-18',
  'velox-19',
  'velox-20',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export type HairStyle = 'short' | 'long' | 'curly' | 'bun' | 'spiky' | 'bald';
export type Accessory = 'none' | 'glasses' | 'sunglasses' | 'headphones' | 'cap';

export interface AvatarDefinition {
  id: AvatarId;
  label: string;
  bgFrom: string;
  bgTo: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: HairStyle;
  accessory: Accessory;
}

export const AVATARS: AvatarDefinition[] = [
  { id: 'velox-01', label: 'Aurora', bgFrom: '#6366f1', bgTo: '#8b5cf6', skin: '#f5d0b5', hair: '#2d1b0e', shirt: '#ffffff', hairStyle: 'long', accessory: 'none' },
  { id: 'velox-02', label: 'Blaze', bgFrom: '#f97316', bgTo: '#ef4444', skin: '#c68642', hair: '#1a1a1a', shirt: '#fef3c7', hairStyle: 'spiky', accessory: 'none' },
  { id: 'velox-03', label: 'Coral', bgFrom: '#ec4899', bgTo: '#f43f5e', skin: '#ffdbac', hair: '#8b4513', shirt: '#fce7f3', hairStyle: 'curly', accessory: 'glasses' },
  { id: 'velox-04', label: 'Delta', bgFrom: '#0ea5e9', bgTo: '#06b6d4', skin: '#e0ac69', hair: '#3d2314', shirt: '#e0f2fe', hairStyle: 'short', accessory: 'none' },
  { id: 'velox-05', label: 'Ember', bgFrom: '#dc2626', bgTo: '#b91c1c', skin: '#8d5524', hair: '#000000', shirt: '#fee2e2', hairStyle: 'bald', accessory: 'sunglasses' },
  { id: 'velox-06', label: 'Frost', bgFrom: '#38bdf8', bgTo: '#818cf8', skin: '#ffdbac', hair: '#c0c0c0', shirt: '#f0f9ff', hairStyle: 'short', accessory: 'none' },
  { id: 'velox-07', label: 'Grove', bgFrom: '#22c55e', bgTo: '#14b8a6', skin: '#c68642', hair: '#2d1b0e', shirt: '#dcfce7', hairStyle: 'curly', accessory: 'cap' },
  { id: 'velox-08', label: 'Haven', bgFrom: '#a855f7', bgTo: '#d946ef', skin: '#f5d0b5', hair: '#4a2c17', shirt: '#faf5ff', hairStyle: 'bun', accessory: 'none' },
  { id: 'velox-09', label: 'Iris', bgFrom: '#eab308', bgTo: '#f97316', skin: '#e0ac69', hair: '#1a1a1a', shirt: '#fef9c3', hairStyle: 'long', accessory: 'headphones' },
  { id: 'velox-10', label: 'Jade', bgFrom: '#10b981', bgTo: '#059669', skin: '#8d5524', hair: '#2d1b0e', shirt: '#ecfdf5', hairStyle: 'short', accessory: 'glasses' },
  { id: 'velox-11', label: 'Kai', bgFrom: '#3b82f6', bgTo: '#1d4ed8', skin: '#ffdbac', hair: '#1a1a1a', shirt: '#dbeafe', hairStyle: 'spiky', accessory: 'none' },
  { id: 'velox-12', label: 'Luna', bgFrom: '#64748b', bgTo: '#334155', skin: '#f5d0b5', hair: '#c0c0c0', shirt: '#f1f5f9', hairStyle: 'long', accessory: 'none' },
  { id: 'velox-13', label: 'Mira', bgFrom: '#f472b6', bgTo: '#e879f9', skin: '#c68642', hair: '#8b4513', shirt: '#fdf2f8', hairStyle: 'bun', accessory: 'glasses' },
  { id: 'velox-14', label: 'Nova', bgFrom: '#7c3aed', bgTo: '#4f46e5', skin: '#e0ac69', hair: '#3d2314', shirt: '#ede9fe', hairStyle: 'curly', accessory: 'none' },
  { id: 'velox-15', label: 'Onyx', bgFrom: '#171717', bgTo: '#404040', skin: '#8d5524', hair: '#000000', shirt: '#d4d4d4', hairStyle: 'short', accessory: 'sunglasses' },
  { id: 'velox-16', label: 'Pine', bgFrom: '#15803d', bgTo: '#166534', skin: '#ffdbac', hair: '#4a2c17', shirt: '#bbf7d0', hairStyle: 'spiky', accessory: 'cap' },
  { id: 'velox-17', label: 'Quartz', bgFrom: '#cbd5e1', bgTo: '#94a3b8', skin: '#f5d0b5', hair: '#d4a574', shirt: '#ffffff', hairStyle: 'long', accessory: 'headphones' },
  { id: 'velox-18', label: 'River', bgFrom: '#0284c7', bgTo: '#0369a1', skin: '#c68642', hair: '#2d1b0e', shirt: '#bae6fd', hairStyle: 'short', accessory: 'none' },
  { id: 'velox-19', label: 'Sage', bgFrom: '#84cc16', bgTo: '#65a30d', skin: '#e0ac69', hair: '#1a1a1a', shirt: '#ecfccb', hairStyle: 'bald', accessory: 'glasses' },
  { id: 'velox-20', label: 'Tide', bgFrom: '#06b6d4', bgTo: '#0891b2', skin: '#8d5524', hair: '#3d2314', shirt: '#cffafe', hairStyle: 'curly', accessory: 'none' },
];

const avatarMap = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatar(id: string | null | undefined): AvatarDefinition | null {
  if (!id) return null;
  return avatarMap.get(id as AvatarId) ?? null;
}

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
