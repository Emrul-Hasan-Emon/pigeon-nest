import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { extname } from 'node:path';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { FileInfo } from '../types/file-info.type';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private client: S3Client | undefined;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME', '');
    this.region = this.configService.get<string>('AWS_REGION', '');
  }

  // Built on first use, not in the constructor: this provider is always
  // instantiated regardless of STORAGE_DRIVER, and the S3 SDK throws if
  // region is empty — which it is until a bucket actually exists.
  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({ region: this.region });
    }
    return this.client;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<FileInfo> {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname);
    const filePath = `${folder}/${file.fieldname}-${uniqueSuffix}${ext}`;

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      filePath,
      fileUrl: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filePath}`,
      fileMimeType: file.mimetype,
    };
  }

  async remove(filePath: string): Promise<void> {
    await this.getClient()
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: filePath }))
      .catch(() => undefined);
  }
}
