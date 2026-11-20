import { DocumentsService } from './documents.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['document.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = { candidateDocument: { findFirst: jest.fn() } };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const storage = { read: jest.fn().mockResolvedValue(Buffer.from('image-bytes')) };
  const automation = {};
  const ocr = { extractPassport: jest.fn().mockResolvedValue({ success: true }) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new DocumentsService(prisma as never, candidates as never, storage as never, automation as never, ocr as never, audit as never, timeline as never),
    prisma, storage, ocr,
  };
}

describe('DocumentsService.extract', () => {
  it('refuse l’extraction OCR sur un PDF — seules les images sont prises en charge pour l’instant', async () => {
    const { service, prisma, ocr } = build();
    prisma.candidateDocument.findFirst.mockResolvedValue({ id: 'd1', mimeType: 'application/pdf', filePath: 'x' });
    await expect(service.extract(actor(), 'd1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'OCR_UNSUPPORTED_FILE' }) });
    expect(ocr.extractPassport).not.toHaveBeenCalled();
  });

  it('lance l’extraction sur une image et renvoie le résultat sans jamais modifier le document', async () => {
    const { service, prisma, ocr, storage } = build();
    prisma.candidateDocument.findFirst.mockResolvedValue({ id: 'd1', mimeType: 'image/jpeg', filePath: 'path/to/file.jpg' });
    const result = await service.extract(actor(), 'd1');
    expect(storage.read).toHaveBeenCalledWith('orgA', 'path/to/file.jpg');
    expect(ocr.extractPassport).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
