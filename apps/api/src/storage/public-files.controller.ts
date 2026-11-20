import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { apiError } from '../common/errors/api-error';
import { StorageService } from './storage.service';

/** Images publiques de la page d'accueil (logos, photos) enregistrées sur le serveur quand S3 n'est pas configuré. */
@ApiTags('public')
@Controller('public/files')
export class PublicFilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':name')
  async file(@Param('name') name: string, @Res() res: Response) {
    const file = await this.storage.readPublic(name);
    if (!file) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image introuvable');
    res.set({
      'Content-Type': file.contentType,
      // Nom aléatoire : le contenu ne change jamais, il peut rester en cache.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Une image SVG ouverte seule ne peut exécuter aucun script (même domaine que la plateforme).
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(file.buffer);
  }
}
