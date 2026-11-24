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

  /**
   * Makes a new stored file from one that is already stored, so two records never share one file.
   * Reads the original through its public address, which works for every storage driver.
   */
  async copyStored(source: { url: string; path: string; mimeType?: string }, folder: string, fieldname: string): Promise<FileInfo> {
    const response = await fetch(source.url);
    if (!response.ok) throw new BadRequestException('The original file could not be read');
    const buffer = Buffer.from(await response.arrayBuffer());
    const name = source.path.split('/').pop() ?? 'file';
    const file = {
      buffer,
      size: buffer.length,
      originalname: name,
      fieldname,
      mimetype: source.mimeType ?? response.headers.get('content-type') ?? 'application/octet-stream',
    } as Express.Multer.File;
    return this.uploadFile(file, folder);
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
