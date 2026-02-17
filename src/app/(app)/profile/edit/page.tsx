'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft01Icon, Camera01Icon, Cancel01Icon, FloppyDiskIcon, Loading02Icon, MinusSignIcon, RotateRight01Icon, ZoomInAreaIcon, ZoomOutAreaIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'

// ─── Crop Helper ────────────────────────────────────────────────────────────

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const radians = (rotation * Math.PI) / 180

  // Calculate bounding box of rotated image
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const bBoxWidth = image.width * cos + image.height * sin
  const bBoxHeight = image.width * sin + image.height * cos

  // Set canvas size to bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // Translate and rotate
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(radians)
  ctx.translate(-image.width / 2, -image.height / 2)

  // Draw the image
  ctx.drawImage(image, 0, 0)

  // Extract the cropped region
  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')!

  // Output at the crop size (max 512px for avatar)
  const outputSize = Math.min(pixelCrop.width, 512)
  croppedCanvas.width = outputSize
  croppedCanvas.height = outputSize

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

const creativeSkillSuggestions = [
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Illustration', 'Branding', 'Motion Graphics',
  'Social Media', 'Content Writing', 'Animation', '3D Design',
  'Mobile Development', 'Logo Design', 'Copywriting', 'SEO',
]

const mentorSkillSuggestions = [
  'Leadership', 'Communication', 'Coaching', 'Career Development',
  'Portfolio Review', 'Creative Direction', 'Project Management',
  'Industry Knowledge', 'Networking', 'Problem Solving',
  'Strategic Planning', 'Team Building', 'Public Speaking', 'Negotiation',
  'Mentoring', 'Talent Development',
]

const mentorExpertiseSuggestions = [
  'Career Guidance', 'Portfolio Review', 'Technical Skills', 'Creative Direction',
  'Business Strategy', 'Industry Networking', 'Personal Branding', 'Freelancing Tips',
  'Project Management', 'Interview Prep', 'Resume Building', 'Pitch Coaching',
]

interface UserProfile {
  full_name: string
  bio: string
  location: string
  skills: string[]
  website?: string
  social_links?: {
    twitter?: string
    linkedin?: string
    instagram?: string
    behance?: string
    dribbble?: string
  }
}

export default function EditProfilePage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { role } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('creative')
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    bio: '',
    location: '',
    skills: [],
    website: '',
    social_links: {},
  })
  const [skillInput, setSkillInput] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Crop dialog state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Mentor-specific fields
  const [mentorExpertise, setMentorExpertise] = useState<string[]>([])
  const [expertiseInput, setExpertiseInput] = useState('')
  const [isAvailableForMentorship, setIsAvailableForMentorship] = useState(true)
  const [maxMentees, setMaxMentees] = useState(5)

  const skillSuggestions = userRole === 'mentor' ? mentorSkillSuggestions : creativeSkillSuggestions

  // Load profile on mount
  useEffect(() => {
    if (isLoaded && user) {
      loadProfile()
    }
  }, [isLoaded, user])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profiles')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setProfile({
            full_name: data.profile.full_name || user?.fullName || '',
            bio: data.profile.bio || '',
            location: data.profile.location || '',
            skills: data.profile.skills || [],
            website: data.profile.website || '',
            social_links: data.profile.social_links || {},
          })
          // Store the user role from DB
          const dbRole = data.profile.role || role || 'creative'
          setUserRole(dbRole)
          // Load mentor-specific fields
          if (dbRole === 'mentor') {
            setMentorExpertise(data.profile.mentor_expertise || [])
            setIsAvailableForMentorship(data.profile.is_available_for_mentorship ?? true)
            setMaxMentees(data.profile.max_mentees || 5)
          }
        } else {
          // Use Clerk user data as default
          setProfile(prev => ({
            ...prev,
            full_name: user?.fullName || '',
          }))
          setUserRole(role || 'creative')
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfile(prev => ({
        ...prev,
        full_name: user?.fullName || '',
      }))
      setUserRole(role || 'creative')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      toast.error('Please enter your name')
      return
    }

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        full_name: profile.full_name.trim(),
        bio: profile.bio.trim(),
        location: profile.location.trim(),
        skills: profile.skills,
        website: profile.website?.trim() || null,
        social_links: profile.social_links,
        avatar_url: user?.imageUrl || null,
      }

      // Include mentor-specific fields only for mentors
      if (userRole === 'mentor') {
        payload.mentor_expertise = mentorExpertise
        payload.is_available_for_mentorship = isAvailableForMentorship
        payload.max_mentees = maxMentees
      }

      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success('Profile updated successfully!')
        router.push('/profile')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddSkill = () => {
    if (!skillInput.trim()) return
    if (profile.skills.length >= 10) {
      toast.error('Maximum 10 skills allowed')
      return
    }
    if (!profile.skills.includes(skillInput.trim())) {
      setProfile({
        ...profile,
        skills: [...profile.skills, skillInput.trim()],
      })
    }
    setSkillInput('')
  }

  const handleRemoveSkill = (skill: string) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter(s => s !== skill),
    })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Read the file as data URL and open crop dialog
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setCroppedAreaPixels(null)
    })
    reader.readAsDataURL(file)

    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleCropSave = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return

    setIsUploading(true)
    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation)

      // Set preview
      const previewUrl = URL.createObjectURL(croppedBlob)
      setAvatarPreview(previewUrl)

      // Upload to Clerk
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })
      await user?.setProfileImage({ file: croppedFile })

      // Reload user to get the updated Clerk imageUrl
      await user?.reload()

      // Sync avatar URL to Supabase so other users can see the photo
      if (user?.imageUrl) {
        await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: user.imageUrl }),
        })
      }

      toast.success('Profile photo updated!')
      setCropImageSrc(null)
    } catch (error) {
      console.error('Error updating avatar:', error)
      toast.error('Failed to update profile photo')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCropCancel = () => {
    setCropImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
  }

  if (isLoading || !isLoaded) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl pb-28 md:pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link href="/profile">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Edit Profile</h1>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
        </div>
        <Button
          className="bg-foreground text-background hover:bg-foreground/90 hidden md:inline-flex"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> : <HugeiconsIcon icon={FloppyDiskIcon} className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      {/* ── Avatar ── */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative">
          <Avatar className="w-28 h-28 ring-2 ring-border">
            <AvatarImage src={avatarPreview || user?.imageUrl} />
            <AvatarFallback className="text-3xl bg-muted text-muted-foreground font-medium">
              {profile.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
          >
            <HugeiconsIcon icon={Camera01Icon} className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Change photo
        </button>
      </div>

      {/* ── Basic Information ── */}
      <section className="mb-8">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Basic Information
        </p>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-sm">Full Name *</Label>
            <Input
              id="full_name"
              placeholder="Your full name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Freetown, Sierra Leone"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-sm">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell people about yourself..."
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={4}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {profile.bio.length}/500
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website" className="text-sm">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourwebsite.com"
              value={profile.website}
              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border mb-8" />

      {/* ── Skills ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Skills
          </p>
          <span className="text-[11px] text-muted-foreground">{profile.skills.length}/10</span>
        </div>

        {/* Current skills */}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-sm py-1.5 px-3 bg-muted text-foreground"
              >
                {skill}
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add input */}
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Add a skill..."
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
            list="skill-suggestions"
          />
          <datalist id="skill-suggestions">
            {skillSuggestions
              .filter(s => !profile.skills.includes(s))
              .map((skill) => (
                <option key={skill} value={skill} />
              ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddSkill}
            disabled={!skillInput.trim() || profile.skills.length >= 10}
          >
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
          </Button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5">
          {skillSuggestions
            .filter(s => !profile.skills.includes(s))
            .slice(0, 8)
            .map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="cursor-pointer text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => {
                  if (profile.skills.length < 10) {
                    setProfile({ ...profile, skills: [...profile.skills, skill] })
                  }
                }}
              >
                + {skill}
              </Badge>
            ))}
        </div>
      </section>

      {/* ── Mentorship Settings (mentor only) ── */}
      {userRole === 'mentor' && (
        <>
          <div className="border-t border-border mb-8" />

          <section className="mb-8">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-5">
              Mentorship Settings
            </p>

            <div className="space-y-6">
              {/* Availability */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Available for Mentorship</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAvailableForMentorship
                      ? 'Creatives can see you and send requests'
                      : 'Hidden from mentor discovery'}
                  </p>
                </div>
                <Switch
                  checked={isAvailableForMentorship}
                  onCheckedChange={setIsAvailableForMentorship}
                />
              </div>

              {/* Max mentees */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Maximum Mentees</p>
                <p className="text-xs text-muted-foreground mb-3">
                  How many mentees can you manage at once?
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => setMaxMentees(prev => Math.max(1, prev - 1))}
                    disabled={maxMentees <= 1}
                  >
                    <HugeiconsIcon icon={MinusSignIcon} className="w-4 h-4" />
                  </Button>
                  <span className="text-lg font-semibold text-foreground w-8 text-center tabular-nums">{maxMentees}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => setMaxMentees(prev => Math.min(20, prev + 1))}
                    disabled={maxMentees >= 20}
                  >
                    <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1">of 20</span>
                </div>
              </div>

              {/* Expertise areas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Expertise Areas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">What areas can you mentor creatives in?</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{mentorExpertise.length}/10</span>
                </div>

                {mentorExpertise.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {mentorExpertise.map((area) => (
                      <Badge
                        key={area}
                        variant="secondary"
                        className="text-sm py-1.5 px-3 bg-muted text-foreground"
                      >
                        {area}
                        <button
                          onClick={() => setMentorExpertise(prev => prev.filter(e => e !== area))}
                          className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Add expertise area..."
                    value={expertiseInput}
                    onChange={(e) => setExpertiseInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (expertiseInput.trim() && !mentorExpertise.includes(expertiseInput.trim()) && mentorExpertise.length < 10) {
                          setMentorExpertise(prev => [...prev, expertiseInput.trim()])
                          setExpertiseInput('')
                        }
                      }
                    }}
                    list="expertise-suggestions"
                  />
                  <datalist id="expertise-suggestions">
                    {mentorExpertiseSuggestions
                      .filter(s => !mentorExpertise.includes(s))
                      .map((area) => (
                        <option key={area} value={area} />
                      ))}
                  </datalist>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (expertiseInput.trim() && !mentorExpertise.includes(expertiseInput.trim()) && mentorExpertise.length < 10) {
                        setMentorExpertise(prev => [...prev, expertiseInput.trim()])
                        setExpertiseInput('')
                      }
                    }}
                    disabled={!expertiseInput.trim() || mentorExpertise.length >= 10}
                  >
                    <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {mentorExpertiseSuggestions
                    .filter(s => !mentorExpertise.includes(s))
                    .slice(0, 8)
                    .map((area) => (
                      <Badge
                        key={area}
                        variant="outline"
                        className="cursor-pointer text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={() => {
                          if (mentorExpertise.length < 10) {
                            setMentorExpertise(prev => [...prev, area])
                          }
                        }}
                      >
                        + {area}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Mobile Save ── */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border md:hidden z-40">
        <Button
          className="w-full bg-foreground text-background hover:bg-foreground/90"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> : <HugeiconsIcon icon={FloppyDiskIcon} className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* ── Crop Dialog ── */}
      <Dialog open={!!cropImageSrc} onOpenChange={(open) => { if (!open) handleCropCancel() }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold">Crop Photo</DialogTitle>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-black/95">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={ZoomOutAreaIcon} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-border cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <HugeiconsIcon icon={ZoomInAreaIcon} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>

            {/* Rotate */}
            <div className="flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
              >
                <HugeiconsIcon icon={RotateRight01Icon} className="w-3.5 h-3.5" />
                Rotate
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" className="flex-1" onClick={handleCropCancel} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                onClick={handleCropSave}
                disabled={isUploading || !croppedAreaPixels}
              >
                {isUploading ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isUploading ? 'Uploading...' : 'Save Photo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
