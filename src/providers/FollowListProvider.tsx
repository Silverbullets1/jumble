import { createFollowListDraftEvent } from '@/lib/draft-event'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'
import { formatError } from '@/lib/error'
import { toast } from 'sonner'

type TFollowListContext = {
  followingSet: Set<string>
  privateFollowingSet: Set<string>
  follow: (pubkey: string) => Promise<void>
  unfollow: (pubkey: string) => Promise<void>
  followPrivate: (pubkey: string) => void
  unfollowPrivate: (pubkey: string) => void
}

const FollowListContext = createContext<TFollowListContext | undefined>(undefined)

export const useFollowList = () => {
  const context = useContext(FollowListContext)
  if (!context) {
    throw new Error('useFollowList must be used within a FollowListProvider')
  }
  return context
}

export function FollowListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, followListEvent, publish, updateFollowListEvent } = useNostr()
  const followingSet = useMemo(
    () => new Set(followListEvent ? getPubkeysFromPTags(followListEvent.tags) : []),
    [followListEvent]
  )

  // #141: Private follows are stored locally only — never published to the
  // public follow list (NIP-02 kind 3). They are combined into the effective
  // following set so private follows still drive feeds and UI, but other
  // users cannot see them.
  const [privateFollowingSet, setPrivateFollowingSet] = useState<Set<string>>(() => {
    if (!accountPubkey) return new Set()
    return new Set(storage.getPrivateFollows(accountPubkey))
  })

  const effectiveFollowingSet = useMemo(() => {
    const combined = new Set(followingSet)
    privateFollowingSet.forEach((pk) => combined.add(pk))
    return combined
  }, [followingSet, privateFollowingSet])

  const persistPrivateFollows = (next: Set<string>) => {
    setPrivateFollowingSet(new Set(next))
    if (accountPubkey) {
      storage.setPrivateFollows(accountPubkey, Array.from(next))
    }
  }

  const follow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) {
      const result = confirm(t('FollowListNotFoundConfirmation'))

      if (!result) {
        return
      }
    }
    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat([['p', pubkey]]),
      followListEvent?.content
    )
    try {
      const newFollowListEvent = await publish(newFollowListDraftEvent)
      if (newFollowListEvent.pubkey !== accountPubkey) return
      await updateFollowListEvent(newFollowListEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to follow: ${err}`, { duration: 10_000 })
      })
    }
  }

  const unfollow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      followListEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
      followListEvent.content
    )
    try {
      const newFollowListEvent = await publish(newFollowListDraftEvent)
      if (newFollowListEvent.pubkey !== accountPubkey) return
      await updateFollowListEvent(newFollowListEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to unfollow: ${err}`, { duration: 10_000 })
      })
    }
  }

  // #141: Follow privately — adds to the local-only private follow list.
  // Also removes from public follow list if present, so the follow stays
  // private (no NIP-02 event reveals it).
  const followPrivate = async (pubkey: string) => {
    if (!accountPubkey) return

    const next = new Set(privateFollowingSet)
    next.add(pubkey)
    persistPrivateFollows(next)

    // If we were publicly following them, remove the public follow so it
    // becomes fully private.
    if (followingSet.has(pubkey)) {
      const followListEvent = await client.fetchFollowListEvent(accountPubkey)
      if (followListEvent) {
        const newFollowListDraftEvent = createFollowListDraftEvent(
          followListEvent.tags.filter(
            ([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey
          ),
          followListEvent.content
        )
        try {
          const newFollowListEvent = await publish(newFollowListDraftEvent)
          if (newFollowListEvent.pubkey === accountPubkey) {
            await updateFollowListEvent(newFollowListEvent)
          }
        } catch (error) {
          const errors = formatError(error)
          errors.forEach((err) => {
            toast.error(`Failed to make follow private: ${err}`, { duration: 10_000 })
          })
        }
      }
    }
  }

  const unfollowPrivate = (pubkey: string) => {
    if (!accountPubkey) return
    const next = new Set(privateFollowingSet)
    next.delete(pubkey)
    persistPrivateFollows(next)
  }

  return (
    <FollowListContext.Provider
      value={{
        followingSet: effectiveFollowingSet,
        privateFollowingSet,
        follow,
        unfollow,
        followPrivate,
        unfollowPrivate
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
