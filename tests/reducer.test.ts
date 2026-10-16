import { describe, it, expect } from 'vitest';
import {
  createInitialRoomState,
  applyPlay,
  applyPause,
  applySeek,
  applySetVideo,
  applyParticipantJoin,
  applyParticipantLeave,
  applyPlaylistAdd,
  applyPlaylistUpvote,
  applyPollCreate,
  applyPollVote,
  applyBufferStart,
  applyBufferEnd,
  applyTransferHost
} from '../shared/src/reducer';
import { Movie, PlaylistItem } from '../shared/src/types';

describe('Room State Reducer', () => {
  const sampleMovie: Movie = {
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    genres: ['Animation', 'Fantasy'],
    rating: 7.5,
    runtime: 888,
    language: 'English',
    description: 'A fantasy story about searching for Scales.',
    poster: 'http://example.com/sintel.jpg',
    videoUrl: 'http://example.com/sintel.mp4'
  };

  it('creates initial room state with monotonic version 1', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000, sampleMovie);
    expect(room.code).toBe('TEST-01');
    expect(room.hostId).toBe('user-1');
    expect(room.playback.status).toBe('paused');
    expect(room.playback.version).toBe(1);
    expect(room.version).toBe(1);
    expect(room.playback.videoId).toBe('sintel');
  });

  it('increments version and sets scheduledStartTime on play', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const updated = applyPlay(room, 2000, 150);

    expect(updated.playback.status).toBe('playing');
    expect(updated.playback.scheduledStartTime).toBe(2150);
    expect(updated.playback.version).toBe(2);
    expect(updated.version).toBe(2);
  });

  it('preserves play idempotency if already playing', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const playing = applyPlay(room, 2000, 150);
    const again = applyPlay(playing, 2500, 150);

    expect(again.version).toBe(playing.version);
    expect(again.playback.version).toBe(playing.playback.version);
  });

  it('computes accurate position and halts schedule on pause', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const playing = applyPlay(room, 2000, 0);
    const paused = applyPause(playing, 5000);

    expect(paused.playback.status).toBe('paused');
    expect(paused.playback.positionAtRef).toBe(3);
    expect(paused.playback.scheduledStartTime).toBeNull();
    expect(paused.version).toBe(3);
  });

  it('applies seek correctly in both playing and paused modes', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const pausedSeek = applySeek(room, 45.5, 2000, 150);
    expect(pausedSeek.playback.positionAtRef).toBe(45.5);
    expect(pausedSeek.playback.scheduledStartTime).toBeNull();

    const playing = applyPlay(pausedSeek, 3000, 150);
    const playingSeek = applySeek(playing, 120.0, 4000, 200);
    expect(playingSeek.playback.positionAtRef).toBe(120.0);
    expect(playingSeek.playback.scheduledStartTime).toBe(4200);
  });

  it('swaps video and resets playback position', () => {
    const room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const updated = applySetVideo(room, sampleMovie, 2000);

    expect(updated.playback.videoId).toBe('sintel');
    expect(updated.playback.positionAtRef).toBe(0);
    expect(updated.playback.status).toBe('paused');
  });

  it('manages participant joins and re-joins without duplication', () => {
    let room = createInitialRoomState('TEST-01', 'user-1', 1000);
    room = applyParticipantJoin(room, { id: 'u1', name: 'Alice', avatarColor: '#fff' }, 1000);
    expect(room.participants['u1'].connected).toBe(true);
    expect(room.participants['u1'].isHost).toBe(true);

    room = applyParticipantJoin(room, { id: 'u2', name: 'Bob', avatarColor: '#000' }, 1100);
    expect(room.participants['u2'].connected).toBe(true);
    expect(room.participants['u2'].isHost).toBe(false);

    room = applyParticipantLeave(room, 'u1', 1200);
    expect(room.participants['u1'].connected).toBe(false);
    expect(room.hostId).toBe('u2');
    expect(room.participants['u2'].isHost).toBe(true);

    room = applyParticipantJoin(room, { id: 'u1', name: 'Alice Reconnected', avatarColor: '#fff' }, 1300);
    expect(room.participants['u1'].connected).toBe(true);
    expect(Object.keys(room.participants).length).toBe(2);
  });

  it('manages collaborative playlist additions and upvoting sorting', () => {
    let room = createInitialRoomState('TEST-01', 'user-1', 1000);
    const item1: PlaylistItem = {
      id: 'item-1',
      movieId: 'sintel',
      title: 'Sintel',
      poster: '',
      duration: 888,
      videoUrl: '',
      addedByUserId: 'u1',
      addedByUserName: 'Alice',
      upvotes: ['u1'],
      addedAt: 1000
    };
    const item2: PlaylistItem = {
      id: 'item-2',
      movieId: 'tears',
      title: 'Tears of Steel',
      poster: '',
      duration: 734,
      videoUrl: '',
      addedByUserId: 'u2',
      addedByUserName: 'Bob',
      upvotes: [],
      addedAt: 1050
    };

    room = applyPlaylistAdd(room, item1);
    room = applyPlaylistAdd(room, item2);
    expect(room.playlist.length).toBe(2);

    room = applyPlaylistUpvote(room, 'item-2', 'u2');
    room = applyPlaylistUpvote(room, 'item-2', 'u3');
    expect(room.playlist[1].id).toBe('item-2');
  });

  it('handles group polls creation and voting', () => {
    let room = createInitialRoomState('TEST-01', 'user-1', 1000);
    room = applyPollCreate(room, {
      id: 'poll-1',
      question: 'Next film?',
      options: [
        { id: 'opt-1', text: 'Sintel', votes: [] },
        { id: 'opt-2', text: 'Tears of Steel', votes: [] }
      ],
      createdBy: 'u1',
      createdByName: 'Alice',
      createdAt: 1000,
      expiresAt: 2000,
      isActive: true
    });

    expect(room.activePoll?.question).toBe('Next film?');

    room = applyPollVote(room, 'poll-1', 'opt-1', 'u1');
    expect(room.activePoll?.options[0].votes).toContain('u1');

    room = applyPollVote(room, 'poll-1', 'opt-2', 'u1');
    expect(room.activePoll?.options[0].votes).not.toContain('u1');
    expect(room.activePoll?.options[1].votes).toContain('u1');
  });

  it('handles buffering state with configurable pause setting', () => {
    let room = createInitialRoomState('TEST-01', 'user-1', 1000);
    room.settings.pauseOnBuffering = true;
    room = applyPlay(room, 2000, 0);

    room = applyBufferStart(room, 'u2', 3000);
    expect(room.playback.status).toBe('buffering');
    expect(room.playback.bufferingParticipants).toContain('u2');

    room = applyBufferEnd(room, 'u2', 4000, 150);
    expect(room.playback.status).toBe('playing');
    expect(room.playback.bufferingParticipants.length).toBe(0);
    expect(room.playback.scheduledStartTime).toBe(4150);
  });

  it('allows manual host transfer', () => {
    let room = createInitialRoomState('TEST-01', 'u1', 1000);
    room = applyParticipantJoin(room, { id: 'u1', name: 'Alice', avatarColor: '#111' }, 1000);
    room = applyParticipantJoin(room, { id: 'u2', name: 'Bob', avatarColor: '#222' }, 1050);

    room = applyTransferHost(room, 'u2');
    expect(room.hostId).toBe('u2');
    expect(room.participants['u2'].isHost).toBe(true);
    expect(room.participants['u1'].isHost).toBe(false);
  });
});
