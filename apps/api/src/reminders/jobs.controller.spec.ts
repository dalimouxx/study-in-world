import { JobsController } from './jobs.controller';

const build = (secret?: string) => {
  const reminders = { runDue: jest.fn().mockResolvedValue([{ organizationId: 'orgA', counts: {} }]) };
  const config = { get: jest.fn().mockImplementation((k: string) => (k === 'JOBS_SECRET' ? secret : undefined)) };
  return { controller: new JobsController(reminders as never, config as never), reminders };
};

describe('POST /jobs/daily-reminders', () => {
  it('404 sans JOBS_SECRET configuré', async () => {
    const { controller, reminders } = build(undefined);
    await expect(controller.dailyReminders('Bearer quelque-chose')).rejects.toMatchObject({ status: 404 });
    expect(reminders.runDue).not.toHaveBeenCalled();
  });

  it('401 avec une mauvaise clé', async () => {
    const { controller } = build('un-secret-tres-long-de-24-car');
    await expect(controller.dailyReminders('Bearer mauvais')).rejects.toMatchObject({ status: 401 });
    await expect(controller.dailyReminders(undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('200 avec la bonne clé : lance la tournée externe', async () => {
    const { controller, reminders } = build('un-secret-tres-long-de-24-car');
    await expect(controller.dailyReminders('Bearer un-secret-tres-long-de-24-car')).resolves.toEqual([{ organizationId: 'orgA', counts: {} }]);
    expect(reminders.runDue).toHaveBeenCalledWith(expect.any(Date), 'external');
  });
});
