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
