import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { FileInfo } from '../types/file-info.type';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  private get rootPath(): string {
    return this.configService.get<string>('LOCAL_STORAGE_PATH', 'uploads');
  }

  private get baseUrl(): string {
    return this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:3000',
    );
  }

  async upload(file: Express.Multer.File, folder: string): Promise<FileInfo> {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname);
    const filePath = `${folder}/${file.fieldname}-${uniqueSuffix}${ext}`;
    const absolutePath = join(this.rootPath, filePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      filePath,
      fileUrl: `${this.baseUrl}/uploads/${filePath}`,
      fileMimeType: file.mimetype,
    };
  }

  async remove(filePath: string): Promise<void> {
    await unlink(join(this.rootPath, filePath)).catch(() => undefined);
  }
}
