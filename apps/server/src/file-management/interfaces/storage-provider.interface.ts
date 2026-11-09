import { FileInfo } from '../types/file-info.type';

export interface StorageProvider {
  upload(file: Express.Multer.File, folder: string): Promise<FileInfo>;
  remove(filePath: string): Promise<void>;
}
