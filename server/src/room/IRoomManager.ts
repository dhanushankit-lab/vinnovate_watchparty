import { Movie } from '@watch-party/shared';
import { Room } from './Room';

export interface IRoomManager {
  getRoom(code: string): Promise<Room | undefined>;
  createRoom(hostId?: string, initialMovie?: Movie): Promise<Room>;
  deleteRoom(code: string): Promise<void>;
  hasRoom(code: string): Promise<boolean>;
  getActiveRoomCount(): number;
  cleanupStaleRooms(): Promise<number>;
}
