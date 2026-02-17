'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, AttachmentIcon, Cancel01Icon, CircleIcon, Download01Icon, FileAttachmentIcon, Image01Icon, InboxIcon, Loading02Icon, Mail01Icon, Refresh01Icon, Search01Icon, SentIcon, UserIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import SpotlightCard from '@/components/SpotlightCard'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/components/shared/offline-banner'

interface MessageUser {
  full_name: string
  avatar_url: string | null
}

interface MessageAttachment {
  name: string
  url: string
  size: number
  type: string
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  subject: string
  content: string
  is_read: boolean
  created_at: string
  attachments?: MessageAttachment[]
  sender?: MessageUser
  receiver?: MessageUser
}

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  // Compose state
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Attachments state
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number; type: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search users for compose
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ user_id: string; full_name: string; avatar_url: string | null }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<{ user_id: string; full_name: string; avatar_url: string | null } | null>(null)

  // Auto-open compose from URL params (e.g. from mentorship page)
  useEffect(() => {
    const compose = searchParams.get('compose')
    const toId = searchParams.get('to')
    const toName = searchParams.get('name')

    if (compose === 'true' && toId) {
      setRecipientId(toId)
      setSelectedRecipient({
        user_id: toId,
        full_name: toName || 'User',
        avatar_url: null,
      })
      setIsComposeOpen(true)
    }
  }, [searchParams])

  // Cached fetch for messages (changes when folder changes)
  const { data: msgData, isLoading: isMsgLoading, refresh: refreshMessages } = useCachedFetch<{ messages?: Message[] }>(
    `/api/messages?folder=${folder}`,
    {
      cacheKey: `messages:${folder}`,
      ttlMs: 15 * 60 * 1000, // 15 min
      deps: [folder],
    }
  )

  useEffect(() => {
    if (msgData?.messages) setMessages(msgData.messages)
    if (!isMsgLoading) setIsLoading(false)
  }, [msgData, isMsgLoading])

  const loadMessages = () => {
    refreshMessages()
  }

  const markAsRead = async (messageId: string) => {
    try {
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId }),
      })
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, is_read: true } : m)
      )
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleOpenMessage = (message: Message) => {
    setSelectedMessage(message)
    if (folder === 'inbox' && !message.is_read) {
      markAsRead(message.id)
    }
  }

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=user`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results?.map((r: Record<string, unknown>) => ({
          user_id: r.id as string,
          full_name: r.title as string,
          avatar_url: (r.imageUrl as string) || null,
        })) || [])
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendMessage = async () => {
    if (!recipientId) {
      toast.error('Please select a recipient')
      return
    }
    if (!content.trim()) {
      toast.error('Please write a message')
      return
    }

    setIsSending(true)
    try {
      // If offline, queue message for later sync
      if (!navigator.onLine) {
        const localId = `offline_msg_${Date.now()}`
        try {
          const { addToSyncQueue } = await import('@/lib/offline/indexed-db')
          await addToSyncQueue({
            id: localId,
            action: 'create',
            table: 'messages',
            data: {
              receiver_id: recipientId,
              subject: subject.trim(),
              content: content.trim(),
              attachments: attachments.length > 0 ? attachments : undefined,
            },
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
          })
        } catch {}
        toast.success('Message saved offline — will send when you reconnect')
        setIsComposeOpen(false)
        resetCompose()
        setIsSending(false)
        return
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: recipientId,
          subject: subject.trim(),
          content: content.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })

      if (response.ok) {
        toast.success('Message sent!')
        setIsComposeOpen(false)
        resetCompose()
        if (folder === 'sent') {
          loadMessages()
        }
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const resetCompose = () => {
    setRecipientId('')
    setSelectedRecipient(null)
    setSubject('')
    setContent('')
    setUserSearchQuery('')
    setSearchResults([])
    setAttachments([])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          setAttachments(prev => [...prev, {
            name: file.name,
            url: data.url,
            size: file.size,
            type: file.type,
          }])
        } else {
          toast.error(`Failed to upload ${file.name}`)
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const filteredMessages = messages.filter(m => {
    if (!searchQuery) return true
    const lowerQuery = searchQuery.toLowerCase()
    const contactName = folder === 'inbox'
      ? (m.sender as MessageUser)?.full_name
      : (m.receiver as MessageUser)?.full_name
    return (
      contactName?.toLowerCase().includes(lowerQuery) ||
      m.subject?.toLowerCase().includes(lowerQuery) ||
      m.content?.toLowerCase().includes(lowerQuery)
    )
  })

  const unreadCount = messages.filter(m => !m.is_read).length

  const getContactInfo = (message: Message) => {
    if (folder === 'inbox') {
      return {
        name: (message.sender as MessageUser)?.full_name || 'Unknown User',
        avatar: (message.sender as MessageUser)?.avatar_url,
      }
    }
    return {
      name: (message.receiver as MessageUser)?.full_name || 'Unknown User',
      avatar: (message.receiver as MessageUser)?.avatar_url,
    }
  }

  // Message detail view
  if (selectedMessage) {
    const contact = getContactInfo(selectedMessage)
    return (
      <div className="container mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 max-w-2xl">
        <Button variant="ghost" className="mb-4" onClick={() => setSelectedMessage(null)}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
          Back to Messages
        </Button>

        <SpotlightCard className="pt-6">
          <div>
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={contact.avatar || undefined} />
                <AvatarFallback className="bg-brand-500 text-brand-dark">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">{contact.name}</p>
                <p className="text-xs text-muted-foreground">
                  {folder === 'inbox' ? 'From' : 'To'} &middot; {formatDistanceToNow(selectedMessage.created_at)}
                </p>
              </div>
            </div>

            {/* Subject */}
            {selectedMessage.subject && (
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {selectedMessage.subject}
              </h2>
            )}

            {/* Content */}
            <div className="whitespace-pre-wrap text-foreground">
              {selectedMessage.content}
            </div>

            {/* Attachments */}
            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/60">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Attachments ({selectedMessage.attachments.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedMessage.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border/60 hover:border-brand-500/40 transition-colors text-xs group/file"
                    >
                      {file.type.startsWith('image/') ? (
                        <HugeiconsIcon icon={Image01Icon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
                      ) : (
                        <HugeiconsIcon icon={FileAttachmentIcon} className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      <span className="text-foreground truncate max-w-[140px]">{file.name}</span>
                      <span className="text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <HugeiconsIcon icon={Download01Icon} className="w-3 h-3 text-muted-foreground group-hover/file:text-brand-purple-600 dark:group-hover/file:text-brand-400 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Reply action */}
            {folder === 'inbox' && (
              <div className="mt-6 pt-4 border-t border-border">
                <Button
                  className="bg-brand-500 hover:bg-brand-600"
                  onClick={() => {
                    setRecipientId(selectedMessage.sender_id)
                    setSelectedRecipient({
                      user_id: selectedMessage.sender_id,
                      full_name: contact.name,
                      avatar_url: contact.avatar || null,
                    })
                    setSubject(
                      selectedMessage.subject
                        ? `Re: ${selectedMessage.subject.replace(/^Re: /, '')}`
                        : ''
                    )
                    setIsComposeOpen(true)
                    setSelectedMessage(null)
                  }}
                >
                  <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                  Reply
                  </Button>
              </div>
            )}
          </div>
        </SpotlightCard>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 max-w-2xl">
      <OfflineBanner message="You're offline — showing cached messages" />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground">
            {folder === 'inbox' && unreadCount > 0
              ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
              : 'Send and receive messages'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadMessages} disabled={isLoading}>
            <HugeiconsIcon icon={Refresh01Icon} className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </Button>
          <Dialog open={isComposeOpen} onOpenChange={(open) => {
            setIsComposeOpen(open)
            if (!open) resetCompose()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-brand-500 hover:bg-brand-600">
                <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                Compose
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
                <DialogDescription>
                  Send a message to another user on the platform
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Recipient */}
                <div className="space-y-2">
                  <Label>To <span className="text-red-500">*</span></Label>
                  {selectedRecipient ? (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={selectedRecipient.avatar_url || undefined} />
                        <AvatarFallback className="bg-brand-500 text-brand-dark text-xs">
                          {selectedRecipient.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium flex-1">{selectedRecipient.full_name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setSelectedRecipient(null)
                          setRecipientId('')
                        }}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        placeholder="Search for a user..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value)
                          searchUsers(e.target.value)
                        }}
                      />
                      {isSearching && (
                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                          <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> Searching...
                        </div>
                      )}
                      {searchResults.length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden">
                          {searchResults.map((user) => (
                            <button
                              key={user.user_id}
                              className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors text-left"
                              onClick={() => {
                                setSelectedRecipient(user)
                                setRecipientId(user.user_id)
                                setSearchResults([])
                                setUserSearchQuery('')
                              }}
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={user.avatar_url || undefined} />
<AvatarFallback className="bg-brand-500 text-brand-dark text-xs">
                                {user.full_name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{user.full_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="msg-subject">Subject</Label>
                  <Input
                    id="msg-subject"
                    placeholder="Message subject (optional)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor="msg-content">
                    Message <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="msg-content"
                    placeholder="Type your message..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                  />
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Attachments</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={AttachmentIcon} className="w-3 h-3" />
                      )}
                      {isUploading ? 'Uploading...' : 'Attach File'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt,.zip,.pptx,.xlsx"
                      onChange={handleFileUpload}
                    />
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border/60 text-xs"
                        >
                          {file.type.startsWith('image/') ? (
                            <HugeiconsIcon icon={Image01Icon} className="w-3 h-3 text-brand-purple-600 dark:text-brand-400" />
                          ) : (
                            <HugeiconsIcon icon={FileAttachmentIcon} className="w-3 h-3 text-blue-500" />
                          )}
                          <span className="text-foreground truncate max-w-[120px]">{file.name}</span>
                          <span className="text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)}MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-muted-foreground hover:text-red-500 transition-colors ml-0.5"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsComposeOpen(false)
                      resetCompose()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-brand-500 hover:bg-brand-600"
                    onClick={handleSendMessage}
                    disabled={isSending || !recipientId || !content.trim()}
                  >
                    {isSending ? (
                      <>
                        <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Folder Tabs */}
      <Tabs value={folder} onValueChange={(v) => setFolder(v as 'inbox' | 'sent')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <HugeiconsIcon icon={InboxIcon} className="w-4 h-4" />
            Inbox
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <HugeiconsIcon icon={SentIcon} className="w-4 h-4" />
            Sent
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative mb-6">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
        </div>
      ) : filteredMessages.length > 0 ? (
        <div className="space-y-2">
          {filteredMessages.map((message) => {
            const contact = getContactInfo(message)
            return (
              <SpotlightCard
                key={message.id}
                className={cn(
                  'p-4 cursor-pointer hover:border-brand-500/30 transition-colors'
                )}
                onClick={() => handleOpenMessage(message)}
              >
                <div className="flex items-center gap-3">
                    {folder === 'inbox' && !message.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={contact.avatar || undefined} />
                      <AvatarFallback className="bg-brand-500 text-brand-dark">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-sm text-foreground truncate',
                          folder === 'inbox' && !message.is_read && 'font-semibold'
                        )}>
                          {contact.name}
                        </p>
                        {folder === 'inbox' && !message.is_read && (
                          <HugeiconsIcon icon={CircleIcon} className="w-2 h-2 fill-brand-purple-600 dark:fill-brand-400 text-brand-purple-600 dark:text-brand-400 flex-shrink-0" />
                        )}
                      </div>
                      {message.subject && (
                        <p className={cn(
                          'text-sm truncate',
                          folder === 'inbox' && !message.is_read
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        )}>
                          {message.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {message.content.substring(0, 80)}
                        {message.content.length > 80 && '...'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {message.attachments && message.attachments.length > 0 && (
                        <HugeiconsIcon icon={AttachmentIcon} className="w-3 h-3 text-muted-foreground" />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(message.created_at)}
                      </p>
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
              </SpotlightCard>
            )
          })}
        </div>
      ) : (
        <SpotlightCard className="py-16 text-center">
          <div>
            <HugeiconsIcon icon={Mail01Icon} className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? 'No matching messages' : `No messages in ${folder}`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : folder === 'inbox'
                  ? 'Your inbox is empty'
                  : "You haven't sent any messages yet"}
            </p>
            {!searchQuery && (
              <Button
                className="bg-brand-500 hover:bg-brand-600"
                onClick={() => setIsComposeOpen(true)}
              >
                <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                Send a Message
              </Button>
            )}
          </div>
        </SpotlightCard>
      )}
    </div>
  )
}
