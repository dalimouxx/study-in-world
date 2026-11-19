import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAgencySettingsDto } from './agency-settings.dto';

// Le fuseau sert à « aujourd'hui / demain » et à l'heure de la tournée des relances : une valeur qui n'est pas
// un fuseau IANA valide ferait échouer tous les calculs de dates de l'agence.
describe('UpdateAgencySettingsDto.timezone', () => {
  it('accepte un fuseau IANA', async () => {
    const errors = await validate(plainToInstance(UpdateAgencySettingsDto, { timezone: 'Africa/Tunis' }));
    expect(errors.filter((e) => e.property === 'timezone')).toHaveLength(0);
  });

  it('refuse un nom de ville qui n’est pas un fuseau', async () => {
    const errors = await validate(plainToInstance(UpdateAgencySettingsDto, { timezone: 'Tunis' }));
    expect(errors.filter((e) => e.property === 'timezone')).not.toHaveLength(0);
  });
});

describe('UpdateAgencySettingsDto — taxes', () => {
  const errs = async (o: object) => (await validate(plainToInstance(UpdateAgencySettingsDto, o))).map((e) => e.property);
  it('refuse un taux de TVA négatif ou supérieur à 100', async () => {
    expect(await errs({ vatRate: -1 })).toContain('vatRate');
    expect(await errs({ vatRate: 101 })).toContain('vatRate');
    expect(await errs({ vatRate: '19' })).toContain('vatRate');
  });
  it('accepte 19 %, un timbre de 1 et l’interrupteur', async () => {
    expect(await errs({ vatRate: 19, stampDuty: 1, taxesEnabled: true })).toEqual([]);
  });
});
