import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useFollowList } from '@/providers/FollowListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { Users } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export type MentionSuggestionItem = {
  type: 'profile' | 'list'
  id: string
  label?: string
  members?: string[]
}

export interface MentionListProps {
  items: MentionSuggestionItem[]
  command: (payload: { id: string; label?: string; members?: string[] }) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

type Tab = 'profiles' | 'lists'

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [tab, setTab] = useState<Tab>('profiles')
  const { followingSet } = useFollowList()
  const { isUserTrusted } = useUserTrust()

  const profiles = useMemo(() => {
    const tier = (npub: string) => {
      const pubkey = userIdToPubkey(npub)
      if (followingSet.has(pubkey)) return 0
      if (isUserTrusted(pubkey)) return 1
      return 2
    }
    const profileItems: MentionSuggestionItem[] = props.items.filter((item) => item.type === 'profile')
    return profileItems
      .map((item, idx) => ({ item, idx, tier: tier(item.id) }))
      .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
      .map((x) => x.item)
  }, [props.items, followingSet, isUserTrusted])

  const lists: MentionSuggestionItem[] = useMemo(
    () => props.items.filter((item) => item.type === 'list'),
    [props.items]
  )

  const items: MentionSuggestionItem[] = tab === 'profiles' ? profiles : lists

  const selectItem = (index: number) => {
    const item = items[index] as MentionSuggestionItem | undefined

    if (item) {
      if (item.type === 'profile') {
        props.command({ id: item.id, label: formatNpub(item.id) })
      } else {
        // Mention a list: expand to all its member profiles (bounty #283)
        const members = item.members ?? []
        if (members.length) {
          props.command({ id: item.id, label: item.label, members })
        } else {
          props.command({ id: item.id, label: item.label })
        }
      }
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(items.length ? 0 : -1)
  }, [items, tab])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter' && selectedIndex >= 0) {
        enterHandler()
        return true
      }

      return false
    }
  }))

  if (!items.length) {
    return null
  }

  const hasLists = lists.length > 0

  return (
    <ScrollArea
      className="pointer-events-auto z-50 flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-background"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {hasLists && (
        <div className="flex items-center gap-1 border-b p-1">
          <button
            className={cn(
              'clickable rounded-md px-2 py-1 text-xs font-medium',
              tab === 'profiles' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
            onClick={() => setTab('profiles')}
            onMouseDown={(e) => e.preventDefault()}
          >
            {t('Profiles')}
          </button>
          <button
            className={cn(
              'clickable flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
              tab === 'lists' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
            onClick={() => setTab('lists')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Users className="size-3" />
            {t('Lists')}
          </button>
        </div>
      )}
      {items.map((rawItem, index) => {
        const item = rawItem as MentionSuggestionItem
        if (item.type === 'list') {
          return (
            <button
              className={cn(
                'm-1 flex w-80 cursor-pointer items-center gap-2 rounded-md p-2 text-start outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                selectedIndex === index && 'bg-accent text-accent-foreground'
              )}
              key={`list-${item.id}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <div className="w-0 flex-1 truncate">
                <div className="truncate font-semibold">{item.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t('{{count}} members', { count: item.members?.length ?? 0 })}
                </div>
              </div>
            </button>
          )
        }
        return (
          <button
            className={cn(
              'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              selectedIndex === index && 'bg-accent text-accent-foreground'
            )}
            key={item.id}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
              <SimpleUserAvatar userId={item.id} />
              <div className="w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SimpleUsername userId={item.id} className="truncate font-semibold" />
                  <FollowingBadge userId={item.id} />
                </div>
                <Nip05 pubkey={userIdToPubkey(item.id)} />
              </div>
            </div>
          </button>
        )
      })}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList
