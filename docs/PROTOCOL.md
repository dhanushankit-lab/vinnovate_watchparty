# Watch Party Real-Time Protocol Specification

## 1. Overview
The Watch Party protocol is a typed, full-duplex WebSocket protocol operating over JSON messages. It guarantees deterministic, monotonic room state transitions across all participants, sub-millisecond clock synchronization, scheduled synchronized playback execution, and collision-free playlist and poll interactions.

## 2. Monotonic State & Versioning
Every state transition on the server increments a monotonically increasing integer `version`.
- The server is the single source of truth.
- Clients attach an `actionId` to non-idempotent mutation requests (play, pause, seek, set_video).
- Competing concurrent commands are serialized strictly by server arrival order. The winner updates the state and increments `version`; subsequent losers receive the updated state and discard stale local optimistic predictions.
- Clients ignore any state broadcast whose `version` is less than or equal to their locally held version.

## 3. NTP Clock Synchronization
Playback coordination relies on Network Time Protocol (NTP) round-trip time estimation.
Clients initiate a 4-timestamp exchange every 5 seconds or upon joining:

1. Client records local timestamp $t_0$ and transmits `{"type": "ntp_ping", "clientSendTime": t0}`.
2. Server receives at $t_1$, generates response at $t_2$, and sends `{"type": "ntp_pong", "clientSendTime": t0, "serverReceiveTime": t1, "serverSendTime": t2}`.
3. Client receives response at local timestamp $t_3$.
4. Computations:
   $$\text{RTT} = (t_3 - t_0) - (t_2 - t_1)$$
   $$\theta = \frac{(t_1 - t_0) + (t_2 - t_3)}{2}$$
5. The client maintains a sliding window of recent samples, applies an outlier filter eliminating samples above $1.5 \times \text{min(RTT)}$, and computes the median offset $\hat{\theta}$.
6. Estimated server time is:
   $$\text{serverTime}_{\text{est}} = \text{localTime} + \hat{\theta}$$

## 4. Scheduled Playback Execution
To eliminate client network jitter discrepancies during playback start:
- When a user issues a `play` or `seek` command while playing, the server computes a lead execution time:
  $$\text{scheduledStartTime} = \text{serverTime}_{\text{now}} + \text{LEAD\_TIME}\quad (\text{LEAD\_TIME} = 150\text{ ms})$$
- Clients receiving the broadcast hold the position and schedule execution at wall-clock moment:
  $$\Delta t = \text{scheduledStartTime} - \text{serverTime}_{\text{est}}$$
- When $\Delta t \le 0$, all clients trigger `HTMLVideoElement.play()` concurrently.

## 5. Client Drift Correction Tiers
Every client evaluates playback drift every 500 ms:
$$\text{expectedPosition} = \text{positionAtRef} + \frac{\text{serverTime}_{\text{est}} - \text{serverTimeAtRef}}{1000} \times \text{playbackRate}$$
$$\text{drift} = (\text{actualPosition} - \text{expectedPosition}) \times 1000\text{ ms}$$

Tiers:
- $|\text{drift}| \le 80\text{ ms}$: Inaudible tolerance band. No action taken; playback rate set to $1.0\times$.
- $80\text{ ms} < |\text{drift}| \le 1500\text{ ms}$: Smooth inaudible rate adjustment.
  - If $\text{drift} > 0$ (client ahead): playback rate adjusted to $0.95\times$.
  - If $\text{drift} < 0$ (client behind): playback rate adjusted to $1.05\times$.
- $|\text{drift}| > 1500\text{ ms}$: Hard seek directly to `expectedPosition`.

## 6. Message Schemas

### Client to Server Messages
- `join`: `{ "type": "join", "roomId": string, "user": { "id": string, "name": string, "avatarColor": string } }`
- `ntp_ping`: `{ "type": "ntp_ping", "clientSendTime": number }`
- `sync_report`: `{ "type": "sync_report", "report": { "rtt": number, "drift": number, "position": number, "syncStatus": "in_sync" | "correcting" | "buffering" } }`
- `play`: `{ "type": "play", "actionId": string }`
- `pause`: `{ "type": "pause", "actionId": string }`
- `seek`: `{ "type": "seek", "position": number, "actionId": string }`
- `set_video`: `{ "type": "set_video", "movie": Movie, "actionId": string }`
- `start_countdown`: `{ "type": "start_countdown", "seconds": number }`
- `buffer_start`: `{ "type": "buffer_start", "position": number }`
- `buffer_end`: `{ "type": "buffer_end", "position": number }`
- `chat`: `{ "type": "chat", "text": string, "videoTimestamp"?: number }`
- `typing`: `{ "type": "typing", "isTyping": boolean }`
- `reaction`: `{ "type": "reaction", "emoji": string, "videoTimestamp": number }`
- `playlist_add`: `{ "type": "playlist_add", "movie": Movie }`
- `playlist_remove`: `{ "type": "playlist_remove", "itemId": string }`
- `playlist_upvote`: `{ "type": "playlist_upvote", "itemId": string }`
- `playlist_reorder`: `{ "type": "playlist_reorder", "itemIds": string[] }`
- `poll_create`: `{ "type": "poll_create", "question": string, "options": { "text": string, "movieId"?: string }[], "durationSeconds"?: number }`
- `poll_vote`: `{ "type": "poll_vote", "pollId": string, "optionId": string }`
- `poll_end`: `{ "type": "poll_end", "pollId": string }`
- `transfer_host`: `{ "type": "transfer_host", "targetUserId": string }`
- `update_settings`: `{ "type": "update_settings", "settings": RoomSettings }`
- `add_scene`: `{ "type": "add_scene", "title": string, "timestamp": number }`
- `nudge_user`: `{ "type": "nudge_user", "targetUserId": string }`

### Server to Client Messages
- `room_snapshot`: Full authoritative state sent on join or delta recovery.
- `ntp_pong`: NTP response payload with timestamps.
- `playback_update`: Authoritative playback state and monotonic version.
- `participant_joined` / `participant_updated` / `participant_left`: Participant presence and sync metrics.
- `chat_message`: Broadcasted message with optional spoiler video timestamp.
- `user_typing`: Transient typing indicator broadcast.
- `reaction_broadcast`: Real-time floating reaction and updated heatmap bucket.
- `playlist_update`: Updated queue ordering and upvote tallies.
- `poll_update`: Live voting counters and poll status.
- `scenes_update`: Saved scene bookmarks.
- `settings_update`: Room control permissions and buffer behaviors.
- `countdown_start`: Broadcasted start countdown with synchronized epoch.
- `nudge_received`: Personal notification toast.
- `error`: Error codes (PERMISSION_DENIED, RATE_LIMIT_EXCEEDED, VALIDATION_FAILED).
