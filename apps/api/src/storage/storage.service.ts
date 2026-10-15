import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { apiError } from '../common/errors/api-error';
import type { Env } from '../config/env';

/**
 * Stockage des documents candidats (privé, jamais public) et des images publiques de la landing page
 * (logos, photos — CMS Super Admin). Deux modes, choisis au démarrage selon la configuration :
 *
 * - S3-compatible (Cloudflare R2 ou équivalent) si S3_ENDPOINT & cie sont renseignés : persistant,
 *   survit aux redéploiements. C'est le mode recommandé en production.
 * - Disque local (comportement historique, Phase 3) sinon : utile en développement, mais le disque
 *   d'un conteneur Render est éphémère — un fichier écrit là peut disparaître au prochain déploiement.
 *   On ne bloque jamais le démarrage pour ça ; on dégrade simplement, comme pour le SMTP ou l'assistant IA.
 */
@Injectable()
export class StorageService {
  private readonly root = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage', 'documents');
  private readonly s3?: S3Client;
  private readonly privateBucket?: string;
  private readonly publicBucket?: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', { infer: true });
    this.privateBucket = this.config.get('S3_PRIVATE_BUCKET', { infer: true });
    this.publicBucket = this.config.get('S3_PUBLIC_BUCKET', { infer: true });
    this.publicBaseUrl = this.config.get('S3_PUBLIC_BASE_URL', { infer: true })?.replace(/\/+$/, '');

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        endpoint,
        region: this.config.get('S3_REGION', { infer: true }),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  // ---------- Documents privés (candidats) : signature inchangée depuis la Phase 3, aucun appelant à modifier. ----------

  private pathFor(organizationId: string, relative: string) {
    return join(this.root, organizationId, relative);
  }

  async save(organizationId: string, buffer: Buffer): Promise<string> {
    const relative = randomBytes(16).toString('hex');
    if (this.s3 && this.privateBucket) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.privateBucket, Key: `${organizationId}/${relative}`, Body: buffer }));
      return relative;
    }
    const full = this.pathFor(organizationId, relative);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, buffer);
    return relative;
  }

  async read(organizationId: string, relative: string): Promise<Buffer> {
    if (this.s3 && this.privateBucket) {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.privateBucket, Key: `${organizationId}/${relative}` }));
      return Buffer.from(await res.Body!.transformToByteArray());
    }
    return readFile(this.pathFor(organizationId, relative));
  }

  async remove(organizationId: string, relative: string): Promise<void> {
    if (this.s3 && this.privateBucket) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.privateBucket, Key: `${organizationId}/${relative}` }));
      return;
    }
    await rm(this.pathFor(organizationId, relative), { force: true });
  }

  // ---------- Images publiques (logos, photos de la landing page — CMS Super Admin). ----------

  /** Nécessite le stockage S3 configuré : pas de repli local sensé pour un fichier censé être servi publiquement. */
  async savePublic(buffer: Buffer, extension: string): Promise<string> {
    if (!this.s3 || !this.publicBucket || !this.publicBaseUrl) {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'STORAGE_NOT_CONFIGURED', "Stockage d'images non configuré");
    }
    const key = `${randomBytes(16).toString('hex')}.${extension.replace(/^\.+/, '')}`;
    await this.s3.send(new PutObjectCommand({ Bucket: this.publicBucket, Key: key, Body: buffer, ContentType: contentTypeFor(extension) }));
    return `${this.publicBaseUrl}/${key}`;
  }

  async removePublic(publicUrl: string): Promise<void> {
    if (!this.s3 || !this.publicBucket || !this.publicBaseUrl) return;
    if (!publicUrl.startsWith(this.publicBaseUrl)) return; // jamais supprimer un lien qui ne vient pas de notre propre bucket
    const key = publicUrl.slice(this.publicBaseUrl.length + 1);
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.publicBucket, Key: key }));
  }

  static sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

function contentTypeFor(extension: string): string {
  switch (extension.replace(/^\.+/, '').toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
