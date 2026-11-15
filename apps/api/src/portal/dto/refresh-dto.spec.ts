import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PartnerRefreshDto } from '../../partner-portal/dto/partner-auth.dto';
import { PortalRefreshDto } from './candidate-auth.dto';

// Le navigateur envoie un corps vide `{}` : le refresh token voyage dans le cookie httpOnly.
// Le DTO ne doit donc pas rejeter l'absence de `refreshToken` (sinon 400 avant même la lecture du cookie,
// et la session du portail est perdue à chaque rechargement ou changement de langue).
describe.each([
  ['portail candidat', PortalRefreshDto],
  ['portail partenaire', PartnerRefreshDto],
])('DTO de refresh du %s', (_name, Dto) => {
  it('accepte un corps vide (token dans le cookie)', async () => {
    expect(await validate(plainToInstance(Dto as new () => object, {}))).toHaveLength(0);
  });

  it('accepte un token transmis dans le corps (application mobile)', async () => {
    expect(await validate(plainToInstance(Dto as new () => object, { refreshToken: 'abc' }))).toHaveLength(0);
  });

  it('refuse un token qui n’est pas une chaîne', async () => {
    expect(await validate(plainToInstance(Dto as new () => object, { refreshToken: 42 }))).not.toHaveLength(0);
  });
});
