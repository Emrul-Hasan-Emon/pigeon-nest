import { Global, Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Global()
@Module({
  providers: [FileUploadService, LocalStorageProvider, S3StorageProvider],
  exports: [FileUploadService],
})
export class FileManagementModule {}
