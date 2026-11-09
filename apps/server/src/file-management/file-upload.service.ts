import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './interfaces/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { FileInfo } from './types/file-info.type';
import { StorageDriver } from './enums/storage-driver.enum';

@Injectable()
export class FileUploadService {
  private readonly provider: StorageProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    private readonly s3StorageProvider: S3StorageProvider,
  ) {
    const driver = this.configService.get<string>(
      'STORAGE_DRIVER',
      StorageDriver.LOCAL,
    );
    this.provider =
      driver === StorageDriver.S3
        ? this.s3StorageProvider
        : this.localStorageProvider;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<FileInfo> {
    this.validFileOrThrow(file);
    return this.provider.upload(file, folder);
  }

  async uploadFiles(
    files: Array<Express.Multer.File>,
    folder: string,
  ): Promise<FileInfo[]> {
    if (!files) {
      return [];
    }

    const filesInfo: FileInfo[] = [];
    for (const file of files) {
      filesInfo.push(await this.uploadFile(file, folder));
    }
    return filesInfo;
  }

  async removeFile(filePath: string): Promise<void> {
    await this.provider.remove(filePath);
  }

  async removeFiles(filesInfo: FileInfo[]): Promise<void> {
    for (const fileInfo of filesInfo) {
      await this.removeFile(fileInfo.filePath);
    }
  }

  private validFileOrThrow(file: Express.Multer.File) {
    if (!file || file.size === 0) {
      throw new BadRequestException('Invalid request. File is missing');
    }
  }
}
