import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { EyeOff, Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { followingSet, privateFollowingSet, follow, unfollow, followPrivate, unfollowPrivate } =
    useFollowList()
  const [updating, setUpdating] = useState(false)
  const [hover, setHover] = useState(false)
  const isFollowing = useMemo(() => followingSet.has(pubkey), [followingSet, pubkey])
  const isPrivateFollowing = useMemo(
    () => privateFollowingSet.has(pubkey),
    [privateFollowingSet, pubkey]
  )

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return

      setUpdating(true)
      await follow(pubkey)
      setUpdating(false)
    })
  }

  const handleFollowPrivate = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return

      setUpdating(true)
      await followPrivate(pubkey)
      setUpdating(false)
    })
  }

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isFollowing) return

      setUpdating(true)
      if (isPrivateFollowing) {
        unfollowPrivate(pubkey)
      } else {
        await unfollow(pubkey)
      }
      setUpdating(false)
    })
  }

  return isFollowing ? (
    <div onClick={(e) => e.stopPropagation()}>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="min-w-28 rounded-full"
            variant={hover ? 'destructive' : 'secondary'}
            disabled={updating}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {updating ? (
              <Loader className="animate-spin" />
            ) : hover ? (
              t('Unfollow')
            ) : isPrivateFollowing ? (
              t('Following (private)')
            ) : (
              t('buttonFollowing')
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Unfollow')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to unfollow this user?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnfollow} variant="destructive">
              {t('Unfollow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button className="min-w-28 rounded-full" onClick={handleFollow} disabled={updating}>
        {updating ? <Loader className="animate-spin" /> : t('Follow')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-muted-foreground hover:text-foreground"
        onClick={handleFollowPrivate}
        disabled={updating}
        title={t('Follow privately')}
      >
        <EyeOff size={16} />
      </Button>
    </div>
  )
}
