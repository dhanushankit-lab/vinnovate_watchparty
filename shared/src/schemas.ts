import { z } from 'zod';

export const MovieSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(1880).max(2100),
  genres: z.array(z.string()),
  rating: z.number().min(0).max(10),
  runtime: z.number().positive(),
  language: z.string(),
  description: z.string(),
  poster: z.string(),
  videoUrl: z.string().url(),
  backdrop: z.string().optional()
});

export const JoinMessageSchema = z.object({
  type: z.literal('join'),
  roomId: z.string().min(1).max(20),
  user: z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(40),
    avatarColor: z.string().min(3).max(20)
  })
});

export const NtpPingSchema = z.object({
  type: z.literal('ntp_ping'),
  clientSendTime: z.number()
});

export const SyncReportSchema = z.object({
  type: z.literal('sync_report'),
  report: z.object({
    rtt: z.number().min(0),
    drift: z.number(),
    position: z.number().min(0),
    syncStatus: z.enum(['in_sync', 'correcting', 'buffering', 'reconnecting'])
  })
});

export const PlayMessageSchema = z.object({
  type: z.literal('play'),
  actionId: z.string().min(1).max(64)
});

export const PauseMessageSchema = z.object({
  type: z.literal('pause'),
  actionId: z.string().min(1).max(64)
});

export const SeekMessageSchema = z.object({
  type: z.literal('seek'),
  position: z.number().min(0),
  actionId: z.string().min(1).max(64)
});

export const SetVideoMessageSchema = z.object({
  type: z.literal('set_video'),
  movie: MovieSchema,
  actionId: z.string().min(1).max(64)
});

export const BufferStartSchema = z.object({
  type: z.literal('buffer_start'),
  position: z.number().min(0)
});

export const BufferEndSchema = z.object({
  type: z.literal('buffer_end'),
  position: z.number().min(0)
});

export const StartCountdownSchema = z.object({
  type: z.literal('start_countdown'),
  seconds: z.number().int().min(1).max(10).default(3)
});

export const ChatMessageSchema = z.object({
  type: z.literal('chat'),
  text: z.string().min(1).max(500),
  videoTimestamp: z.number().optional()
});

export const TypingSchema = z.object({
  type: z.literal('typing'),
  isTyping: z.boolean()
});

export const ReactionSchema = z.object({
  type: z.literal('reaction'),
  emoji: z.string().min(1).max(10),
  videoTimestamp: z.number().min(0)
});

export const PlaylistAddSchema = z.object({
  type: z.literal('playlist_add'),
  movie: MovieSchema
});

export const PlaylistRemoveSchema = z.object({
  type: z.literal('playlist_remove'),
  itemId: z.string().min(1)
});

export const PlaylistUpvoteSchema = z.object({
  type: z.literal('playlist_upvote'),
  itemId: z.string().min(1)
});

export const PlaylistReorderSchema = z.object({
  type: z.literal('playlist_reorder'),
  itemIds: z.array(z.string())
});

export const PollCreateSchema = z.object({
  type: z.literal('poll_create'),
  question: z.string().min(2).max(200),
  options: z.array(z.object({
    text: z.string().min(1).max(100),
    movieId: z.string().optional()
  })).min(2).max(10),
  durationSeconds: z.number().int().min(5).max(300).optional()
});

export const PollVoteSchema = z.object({
  type: z.literal('poll_vote'),
  pollId: z.string().min(1),
  optionId: z.string().min(1)
});

export const PollEndSchema = z.object({
  type: z.literal('poll_end'),
  pollId: z.string().min(1)
});

export const TransferHostSchema = z.object({
  type: z.literal('transfer_host'),
  targetUserId: z.string().min(1)
});

export const UpdateSettingsSchema = z.object({
  type: z.literal('update_settings'),
  settings: z.object({
    controlMode: z.enum(['host_only', 'everyone']).optional(),
    pauseOnBuffering: z.boolean().optional(),
    maxParticipants: z.number().int().min(2).max(100).optional()
  })
});

export const AddSceneSchema = z.object({
  type: z.literal('add_scene'),
  title: z.string().min(1).max(80),
  timestamp: z.number().min(0)
});

export const NudgeUserSchema = z.object({
  type: z.literal('nudge_user'),
  targetUserId: z.string().min(1)
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  JoinMessageSchema,
  NtpPingSchema,
  SyncReportSchema,
  PlayMessageSchema,
  PauseMessageSchema,
  SeekMessageSchema,
  SetVideoMessageSchema,
  BufferStartSchema,
  BufferEndSchema,
  StartCountdownSchema,
  ChatMessageSchema,
  TypingSchema,
  ReactionSchema,
  PlaylistAddSchema,
  PlaylistRemoveSchema,
  PlaylistUpvoteSchema,
  PlaylistReorderSchema,
  PollCreateSchema,
  PollVoteSchema,
  PollEndSchema,
  TransferHostSchema,
  UpdateSettingsSchema,
  AddSceneSchema,
  NudgeUserSchema
]);
