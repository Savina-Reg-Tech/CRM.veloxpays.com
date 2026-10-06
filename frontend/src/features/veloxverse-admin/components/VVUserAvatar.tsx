import { useId, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { isAvatarId } from '../avatars'
import { AvatarIllustration } from './AvatarIllustration'
import type { VVAdminUser } from '../types'

const SIZE: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-16 w-16',
}

/** A VeloxVerse customer's own profile picture — their uploaded photo, else the preset
 * illustration they picked, else initials (also used if the photo fails to load). */
export default function VVUserAvatar({
  user,
  size = 'md',
  className,
}: {
  user: Pick<VVAdminUser, 'fullName' | 'email' | 'avatarType' | 'avatarId' | 'avatarUrl'>
  size?: keyof typeof SIZE
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const [photoFailed, setPhotoFailed] = useState(false)
  const name = user.fullName || user.email

  if (user.avatarType === 'CUSTOM' && user.avatarUrl && !photoFailed) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        loading="lazy"
        onError={() => setPhotoFailed(true)}
        className={cn('shrink-0 rounded-full bg-gray-100 object-cover', SIZE[size], className)}
      />
    )
  }
  if (user.avatarId && isAvatarId(user.avatarId)) {
    return (
      <span className={cn('block shrink-0 overflow-hidden rounded-full', SIZE[size], className)}>
        <AvatarIllustration avatarId={user.avatarId} uid={uid} />
      </span>
    )
  }
  return <Avatar name={name} size={size} className={className} />
}
