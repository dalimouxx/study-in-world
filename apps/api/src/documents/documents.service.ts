import { HttpStatus, Injectable } from '@nestjs/common';
import { TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { StorageService } from '../storage/storage.service';
import { AutomationEngineService } from '../automation/automation-engine.service';
import { OcrService } from '../ocr/ocr.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { ReviewDocumentDto, UploadDocumentDto } from './dto/document.dto';

const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly storage: StorageService,
    private readonly automation: AutomationEngineService,
    private readonly ocr: OcrService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async list(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    return this.prisma.candidateDocument.findMany({
      where: { organizationId: actor.organizationId, candidateId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });
  }

  async upload(actor: AuthUser, candidateId: string, dto: UploadDocumentDto, file: { buffer: Buffer; mimetype: string; size: number }, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    if (!ALLOWED_MIME.has(file.mimetype)) throw apiError(HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE_TYPE', 'Type de fichier non pris en charge (PDF, JPEG, PNG, WEBP uniquement)');
    if (file.size > MAX_SIZE) throw apiError(HttpStatus.BAD_REQUEST, 'FILE_TOO_LARGE', 'Fichier trop volumineux (15 Mo maximum)');

    const lastVersion = await this.prisma.candidateDocument.findFirst({
      where: { organizationId: actor.organizationId, candidateId, type: dto.type, deletedAt: null },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const filePath = await this.storage.save(actor.organizationId, file.buffer);
    const doc = await this.prisma.candidateDocument.create({
      data: {
        organizationId: actor.organizationId,
        candidateId,
        type: dto.type,
        label: dto.label,
        version: (lastVersion?.version ?? 0) + 1,
        filePath,
        mimeType: file.mimetype,
        size: file.size,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        uploadedById: actor.id,
      },
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.DOCUMENT, `Document ajouté : ${dto.label} (v${doc.version})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'document.upload', entity: 'CandidateDocument', entityId: doc.id, metadata: { candidateId, type: dto.type }, meta });
    return doc;
  }

  async review(actor: AuthUser, id: string, dto: ReviewDocumentDto, meta: RequestMeta) {
    const doc = await this.find(actor, id);
    const updated = await this.prisma.candidateDocument.update({
      where: { id },
      data: { status: dto.status, reviewNote: dto.reviewNote, expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined },
    });
    await this.timeline.add(
      actor.organizationId,
      'CANDIDATE',
      doc.candidateId,
      TimelineType.DOCUMENT,
      `Document « ${doc.label} » : ${dto.status}`,
      actor.id,
    );
    if (dto.status === 'REJECTED') {
      await this.automation.fire(actor.organizationId, 'DOCUMENT_REJECTED', undefined, doc.candidateId, actor.id);
    }
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'document.review', entity: 'CandidateDocument', entityId: id, metadata: { status: dto.status }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    const doc = await this.find(actor, id);
    await this.prisma.candidateDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'document.delete', entity: 'CandidateDocument', entityId: id, metadata: { candidateId: doc.candidateId }, meta });
  }

  async download(actor: AuthUser, id: string) {
    const doc = await this.find(actor, id);
    const buffer = await this.storage.read(actor.organizationId, doc.filePath);
    return { buffer, mimeType: doc.mimeType, filename: `${doc.label}${doc.version > 1 ? `-v${doc.version}` : ''}` };
  }

  private async find(actor: AuthUser, id: string) {
    const doc = await this.prisma.candidateDocument.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
    if (!doc) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Document introuvable');
    return doc;
  }

  /**
   * OCR (section 20) : lecture seule, ne modifie jamais le document ni le candidat. Uniquement les images —
   * un PDF nécessiterait une conversion en image d'abord, hors périmètre pour l'instant.
   */
  async extract(actor: AuthUser, id: string) {
    const doc = await this.find(actor, id);
    if (!doc.mimeType.startsWith('image/')) {
      throw apiError(HttpStatus.BAD_REQUEST, 'OCR_UNSUPPORTED_FILE', 'L’extraction automatique ne fonctionne que sur une image (pas un PDF pour l’instant)');
    }
    const buffer = await this.storage.read(actor.organizationId, doc.filePath);
    return this.ocr.extractPassport(buffer);
  }
}
