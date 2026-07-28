import { Module } from '@nestjs/common';
import { AiContextModule } from '../ai-context/ai-context.module';
import { StorageModule } from '../storage/storage.module';
import { ScannerController } from './scanner.controller';
import { ScannerProcessor } from './scanner.processor';
import { ScannerService } from './scanner.service';

/**
 * Scanner module — food photograph, colour-quality photograph, and barcode.
 *
 * All three live together because they share the same shape: analyse an input,
 * score it against the user, write one `scan_results` row. The worker exists for
 * the minority of scans that outrun their inline budget, and calls back into the
 * same service the request path uses.
 */
@Module({
  imports: [AiContextModule, StorageModule],
  controllers: [ScannerController],
  providers: [ScannerService, ScannerProcessor],
  exports: [ScannerService],
})
export class ScannerModule {}
