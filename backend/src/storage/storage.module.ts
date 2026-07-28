import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Object storage for user-uploaded media. Currently scan photographs; any later
 * upload (progress pictures, avatars) belongs here too, so the rules about what
 * may be stored and how it is read stay in one place.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
