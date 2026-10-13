import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Stockage local des documents candidats (Phase 3). En attendant l'intégration S3 (phase ultérieure),
 * les fichiers sont écrits hors de tout dossier public et ne sont accessibles qu'via un contrôleur authentifié.
 */
@Injectable()
export class StorageService {
  private readonly root = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage', 'documents');

  private pathFor(organizationId: string, relative: string) {
    return join(this.root, organizationId, relative);
  }

  async save(organizationId: string, buffer: Buffer): Promise<string> {
    const relative = `${randomBytes(16).toString('hex')}`;
    const full = this.pathFor(organizationId, relative);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, buffer);
    return relative;
  }

  read(organizationId: string, relative: string): Promise<Buffer> {
    return readFile(this.pathFor(organizationId, relative));
  }

  remove(organizationId: string, relative: string): Promise<void> {
    return rm(this.pathFor(organizationId, relative), { force: true });
  }

  static sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
