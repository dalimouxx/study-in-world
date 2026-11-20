import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageService } from './storage.service';

describe('StorageService — images publiques sur le serveur (sans S3)', () => {
  const build = () => {
    process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), 'siw-storage-'));
    const config = { get: (k: string) => ({ APP_URL: 'https://studyinworld.net/' })[k] };
    return new StorageService(config as never);
  };
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  it('enregistre une image et renvoie son adresse publique sur l’API', async () => {
    const s = build();
    const url = await s.savePublic(PNG, '.PNG');
    expect(url).toMatch(/^https:\/\/studyinworld\.net\/api\/public\/files\/[a-f0-9]{32}\.png$/);
    const file = await s.readPublic(url.split('/').pop()!);
    expect(file).toEqual({ buffer: PNG, contentType: 'image/png' });
  });

  it('refuse tout nom qui n’est pas une de nos images (pas de ../ ni d’autre fichier)', async () => {
    const s = build();
    expect(await s.readPublic('../../etc/passwd')).toBeNull();
    expect(await s.readPublic('..%2F..%2Fenv')).toBeNull();
    expect(await s.readPublic('a'.repeat(32) + '.html')).toBeNull();
    expect(await s.readPublic('a'.repeat(32) + '.png')).toBeNull(); // absent
  });

  it('supprime une image enregistrée, jamais un lien extérieur', async () => {
    const s = build();
    const url = await s.savePublic(PNG, 'png');
    await s.removePublic('https://ailleurs.example/x.png');
    await s.removePublic(url);
    expect(await s.readPublic(url.split('/').pop()!)).toBeNull();
  });
});
