'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, AttachmentIcon, Cancel01Icon, Download01Icon, FileAttachmentIcon, Image01Icon, Loading02Icon, Mic01Icon, SentIcon, SmileIcon, SquareIcon, Tick01Icon, TickDouble01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatAttachment {
  name: string
  url: string
  size: number
  type: string
}

interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string
  subject: string
  content: string
  is_read: boolean
  created_at: string
  attachments?: ChatAttachment[]
}

interface Partner {
  user_id: string
  full_name: string
  avatar_url: string | null
  role: string
  bio: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateString: string) {
  const d = new Date(dateString)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateString: string) {
  const d = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'long' })
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getDateKey(dateString: string) {
  const d = new Date(dateString)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const partnerId = params.partnerId as string
  const userId = user?.id

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [partner, setPartner] = useState<Partner | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ── Load conversation ──
  const loadConversation = useCallback(async () => {
    if (!partnerId) return
    try {
      const res = await fetch(
        `/api/messages/conversation?partner_id=${partnerId}`
      )
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setPartner(data.partner || null)
      }
    } catch (err) {
      console.error('Error loading conversation:', err)
    } finally {
      setIsLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    loadConversation()
  }, [loadConversation])

  // ── Scroll to bottom ──
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    })
  }, [])

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Small delay to ensure DOM has rendered
      setTimeout(() => scrollToBottom(false), 50)
    }
  }, [isLoading, messages.length, scrollToBottom])

  // ── Supabase Realtime subscription ──
  useEffect(() => {
    if (!userId || !partnerId) return

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`chat-${userId}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          // Only add if it's from our chat partner
          if (newMsg.sender_id === partnerId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            // Mark as read immediately since chat is open
            fetch('/api/messages', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message_id: newMsg.id }),
            }).catch(() => {})
            // Scroll to new message
            setTimeout(() => scrollToBottom(true), 100)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, partnerId, scrollToBottom])

  // ── Send message ──
  const handleSend = async () => {
    const text = inputText.trim()
    if (!text && attachments.length === 0) return
    if (!partnerId) return

    setIsSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: partnerId,
          subject: '',
          content: text || (attachments.length > 0 ? '📎 Shared files' : ''),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setInputText('')
        setAttachments([])
        setTimeout(() => scrollToBottom(true), 100)
        // Refocus input
        inputRef.current?.focus()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send')
      }
    } catch (err) {
      console.error('Send error:', err)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  // ── Keyboard handler ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── File upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'posts')

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              url: data.url,
              size: file.size,
              type: file.type,
            },
          ])
        } else {
          toast.error(`Failed to upload ${file.name}`)
        }
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/ogg',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())

        const rawMime = mediaRecorder.mimeType || 'audio/webm'
        const baseMime = rawMime.split(';')[0] // e.g. 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: rawMime })
        const ext = baseMime.includes('ogg') ? 'ogg' : 'webm'
        const fileName = `voice_${Date.now()}.${ext}`

        if (audioBlob.size < 100) {
          toast.error('Recording was too short or empty')
          return
        }

        // Upload voice message
        setIsUploading(true)
        try {
          const formData = new FormData()
          formData.append('file', audioBlob, fileName)
          formData.append('bucket', 'posts')

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            // Send as message immediately
            const sendRes = await fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                receiver_id: partnerId,
                subject: '',
                content: '🎤 Voice message',
                attachments: [
                  {
                    name: fileName,
                    url: data.url,
                    size: audioBlob.size,
                    type: rawMime,
                  },
                ],
              }),
            })

            if (sendRes.ok) {
              const sendData = await sendRes.json()
              setMessages((prev) => [...prev, sendData.message])
              setTimeout(() => scrollToBottom(true), 100)
            } else {
              toast.error('Failed to send voice message')
            }
          } else {
            const errData = await res.json().catch(() => ({}))
            console.error('Upload failed:', errData)
            toast.error('Failed to upload voice message')
          }
        } catch (err) {
          console.error('Voice upload error:', err)
          toast.error('Failed to send voice message')
        } finally {
          setIsUploading(false)
        }
      }

      // Use timeslice (250ms) so data is captured progressively during recording
      mediaRecorder.start(250)
      setIsRecording(true)
      setRecordingDuration(0)

      // Timer for duration display
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone access error:', err)
      toast.error('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setRecordingDuration(0)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop())
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingDuration(0)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // ── Group messages by date ──
  const groupedMessages: { dateLabel: string; msgs: ChatMessage[] }[] = []
  let lastDateKey = ''
  for (const msg of messages) {
    const key = getDateKey(msg.created_at)
    if (key !== lastDateKey) {
      groupedMessages.push({
        dateLabel: formatDateLabel(msg.created_at),
        msgs: [msg],
      })
      lastDateKey = key
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto">
      {/* ━━━ Chat Header ━━━ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          onClick={() => router.back()}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
        </Button>

        <Avatar className="w-9 h-9 ring-2 ring-emerald-500/30">
          <AvatarImage src={partner?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold text-sm">
            {partner?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('') || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground text-sm truncate">
            {partner?.full_name || 'Chat'}
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">
              {partner?.role === 'mentor' ? 'Mentor' : 'Mentee'}
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
        >
          Active Mentorship
        </Badge>
      </motion.div>

      {/* ━━━ Messages Area ━━━ */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={SmileIcon} className="w-8 h-8 text-brand-purple-600 dark:text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Start a conversation
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Send a message to {partner?.full_name || 'your mentor'} to begin
              your mentorship journey.
            </p>
          </motion.div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-muted/80 text-[10px] font-medium text-muted-foreground">
                  {group.dateLabel}
                </span>
              </div>

              {/* Messages */}
              {group.msgs.map((msg, mi) => {
                const isMine = msg.sender_id === userId
                const showAvatar =
                  !isMine &&
                  (mi === 0 ||
                    group.msgs[mi - 1]?.sender_id !== msg.sender_id)

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, delay: mi * 0.02 }}
                    className={cn(
                      'flex gap-2 mb-1',
                      isMine ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* Partner avatar */}
                    {!isMine && (
                      <div className="w-7 flex-shrink-0">
                        {showAvatar && (
                          <Avatar className="w-7 h-7">
                            <AvatarImage
                              src={partner?.avatar_url || undefined}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-[10px] font-bold">
                              {partner?.full_name
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={cn(
                        'max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 relative group/bubble',
                        isMine
                          ? 'bg-brand-500 text-brand-dark rounded-br-md'
                          : 'bg-card border border-border/60 text-foreground rounded-bl-md'
                      )}
                    >
                      {/* Text content */}
                      {msg.content && (
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div
                          className={cn(
                            'flex flex-col gap-1.5',
                            msg.content ? 'mt-2' : ''
                          )}
                        >
                          {msg.attachments.map((file, fi) => {
                            const isImage = file.type?.startsWith('image/')
                            const isAudio = file.type?.startsWith('audio/')
                            return isAudio ? (
                              <div
                                key={fi}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2.5 rounded-lg',
                                  isMine
                                    ? 'bg-white/15'
                                    : 'bg-muted/60 border border-border/40'
                                )}
                              >
                                <HugeiconsIcon icon={Mic01Icon} className={cn('w-4 h-4 flex-shrink-0', isMine ? 'text-white/80' : 'text-brand-purple-600 dark:text-brand-400')} />
                                <audio
                                  controls
                                  preload="auto"
                                  src={file.url}
                                  className={cn(
                                    'h-10 min-w-[180px] max-w-[260px]',
                                    isMine ? '[&::-webkit-media-controls-panel]:bg-white/20' : ''
                                  )}
                                />
                              </div>
                            ) : isImage ? (
                              <a
                                key={fi}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg overflow-hidden"
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="max-w-full max-h-48 rounded-lg object-cover"
                                />
                              </a>
                            ) : (
                              <a
                                key={fi}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-xs',
                                  isMine
                                    ? 'bg-white/15 hover:bg-white/25'
                                    : 'bg-muted/60 hover:bg-muted border border-border/40'
                                )}
                              >
                                <HugeiconsIcon icon={FileAttachmentIcon} className={cn(
                                                                                'w-4 h-4 flex-shrink-0',
                                                                                isMine
                                                                                  ? 'text-white/80'
                                                                                  : 'text-blue-500'
                                                                              )} />
                                <span className="truncate max-w-[120px] font-medium">
                                  {file.name}
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px] flex-shrink-0',
                                    isMine
                                      ? 'text-white/60'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {formatFileSize(file.size)}
                                </span>
                                <HugeiconsIcon icon={Download01Icon} className={cn(
                                                                                'w-3 h-3 flex-shrink-0',
                                                                                isMine
                                                                                  ? 'text-white/60'
                                                                                  : 'text-muted-foreground'
                                                                              )} />
                              </a>
                            )
                          })}
                        </div>
                      )}

                      {/* Timestamp + read status */}
                      <div
                        className={cn(
                          'flex items-center gap-1 mt-1',
                          isMine ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <span
                          className={cn(
                            'text-[9px]',
                            isMine
                              ? 'text-white/60'
                              : 'text-muted-foreground/60'
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                        {isMine && (
                          msg.is_read ? (
                            <HugeiconsIcon icon={TickDouble01Icon} className="w-3 h-3 text-white/70" />
                          ) : (
                            <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3 text-white/50" />
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ━━━ Input Area ━━━ */}
      <div className="border-t border-border/60 bg-background/80 backdrop-blur-md px-4 py-3">
        {/* Attachment preview strip */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-2"
            >
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
                    <span className="text-foreground truncate max-w-[100px]">
                      {file.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isRecording ? (
            /* ── Recording UI ── */
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 flex-shrink-0 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={cancelRecording}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
              </Button>

              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-red-500/5 border border-red-500/20">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"
                />
                <span className="text-sm font-medium text-red-500">
                  Recording...
                </span>
                <span className="text-sm tabular-nums text-red-400 ml-auto">
                  {formatRecordingTime(recordingDuration)}
                </span>
              </div>

              <motion.div whileTap={{ scale: 0.9 }}>
                <Button
                  size="sm"
                  className="h-10 w-10 p-0 rounded-full flex-shrink-0 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                  onClick={stopRecording}
                >
                  <HugeiconsIcon icon={SquareIcon} className="w-4 h-4" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            /* ── Normal Input UI ── */
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-end gap-2"
            >
              {/* Attachment button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 flex-shrink-0 rounded-full text-muted-foreground hover:text-brand-purple-600 dark:hover:text-brand-400"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={AttachmentIcon} className="w-5 h-5" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.pptx,.xlsx,.psd,.ai,.svg,audio/*"
                onChange={handleFileUpload}
              />

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className={cn(
                    'w-full resize-none rounded-2xl border border-border/60 bg-muted/40 px-4 py-2.5',
                    'text-sm text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 focus:border-brand-500/40',
                    'transition-all duration-200 max-h-32 overflow-y-auto'
                  )}
                  style={{
                    height: 'auto',
                    minHeight: '42px',
                  }}
                  onInput={(e) => {
                    const el = e.target as HTMLTextAreaElement
                    el.style.height = 'auto'
                    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
                  }}
                />
              </div>

              {/* Voice record / Send button */}
              {inputText.trim() || attachments.length > 0 ? (
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    size="sm"
                    className="h-10 w-10 p-0 rounded-full flex-shrink-0 bg-brand-500 hover:bg-brand-600 text-brand-dark shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 transition-all duration-200"
                    onClick={handleSend}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={SentIcon} className="w-4 h-4" />
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    size="sm"
                    className="h-10 w-10 p-0 rounded-full flex-shrink-0 bg-muted text-muted-foreground hover:text-brand-purple-600 dark:hover:text-brand-400 hover:bg-brand-purple-500/10 dark:bg-brand-500/10 transition-all duration-200"
                    onClick={startRecording}
                    disabled={isUploading}
                  >
                    <HugeiconsIcon icon={Mic01Icon} className="w-5 h-5" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint text */}
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          {isRecording
            ? 'Tap stop to send · Tap X to cancel'
            : 'Enter to send · Shift+Enter new line · Mic for voice'}
        </p>
      </div>
    </div>
  )
}
