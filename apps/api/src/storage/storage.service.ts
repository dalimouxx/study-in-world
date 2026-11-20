import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
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
  /**
   * Images publiques sur le disque du serveur (VPS) quand S3 n'est pas configuré : dans le même espace persistant que
   * les documents (volume Docker, inclus dans les sauvegardes), servies par GET /api/public/files/:nom.
   */
  readonly publicRoot = join(this.root, '_public');
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

  /** Adresse publique des images enregistrées sur le serveur (sans S3). */
  private get localPublicBaseUrl(): string {
    return `${this.config.get('APP_URL', { infer: true }).replace(/\/+$/, '')}/api/public/files`;
  }

  /** S3 si configuré ; sinon le disque du serveur (VPS), servi par l'API. */
  async savePublic(buffer: Buffer, extension: string): Promise<string> {
    const key = `${randomBytes(16).toString('hex')}.${extension.replace(/^\.+/, '').toLowerCase()}`;
    if (this.s3 && this.publicBucket && this.publicBaseUrl) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.publicBucket, Key: key, Body: buffer, ContentType: contentTypeFor(extension) }));
      return `${this.publicBaseUrl}/${key}`;
    }
    await mkdir(this.publicRoot, { recursive: true });
    await writeFile(join(this.publicRoot, key), buffer);
    return `${this.localPublicBaseUrl}/${key}`;
  }

  /** Lecture d'une image publique enregistrée sur le serveur ; null si le nom est invalide ou le fichier absent. */
  async readPublic(name: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!PUBLIC_FILE_NAME.test(name)) return null; // jamais de chemin (../) ni d'autre fichier que nos images
    try {
      return { buffer: await readFile(join(this.publicRoot, name)), contentType: contentTypeFor(name.split('.').pop()!) };
    } catch {
      return null;
    }
  }

  async removePublic(publicUrl: string): Promise<void> {
    if (this.s3 && this.publicBucket && this.publicBaseUrl) {
      if (!publicUrl.startsWith(this.publicBaseUrl)) return; // jamais supprimer un lien qui ne vient pas de notre propre bucket
      const key = publicUrl.slice(this.publicBaseUrl.length + 1);
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.publicBucket, Key: key }));
      return;
    }
    if (!publicUrl.startsWith(`${this.localPublicBaseUrl}/`)) return;
    const name = publicUrl.slice(this.localPublicBaseUrl.length + 1);
    if (PUBLIC_FILE_NAME.test(name)) await rm(join(this.publicRoot, name), { force: true });
  }

  static sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

/** Nom d'une image publique : 32 caractères hexadécimaux et une extension d'image. */
export const PUBLIC_FILE_NAME = /^[a-f0-9]{32}\.(png|jpg|jpeg|webp|svg)$/;

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
