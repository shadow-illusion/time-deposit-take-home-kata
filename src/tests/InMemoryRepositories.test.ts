import { TimeDeposit } from '../TimeDeposit';
import { InMemoryTimeDepositRepository } from '../adapters/driven/InMemoryTimeDepositRepository';
import { InMemoryWithdrawalRepository } from '../adapters/driven/InMemoryWithdrawalRepository';
import { Withdrawal } from '../ports/WithdrawalRepository';

describe('InMemoryTimeDepositRepository', () => {
  let repo: InMemoryTimeDepositRepository;

  beforeEach(() => {
    repo = new InMemoryTimeDepositRepository();
  });

  test('starts empty', async () => {
    const all = await repo.findAll();
    expect(all).toEqual([]);
    expect(repo.size).toBe(0);
  });

  test('can be initialised with seed data', async () => {
    const seeded = new InMemoryTimeDepositRepository([
      new TimeDeposit(1, 'basic', 100, 30),
      new TimeDeposit(2, 'student', 200, 60),
    ]);
    const all = await seeded.findAll();
    expect(all).toHaveLength(2);
  });

  test('save persists a deposit', async () => {
    await repo.save(new TimeDeposit(1, 'basic', 1000, 45));
    expect(repo.size).toBe(1);

    const all = await repo.findAll();
    expect(all[0].id).toBe(1);
    expect(all[0].balance).toBe(1000);
  });

  test('save overwrites existing deposit with same id', async () => {
    await repo.save(new TimeDeposit(1, 'basic', 1000, 45));
    await repo.save(new TimeDeposit(1, 'basic', 2000, 45));

    expect(repo.size).toBe(1);
    const all = await repo.findAll();
    expect(all[0].balance).toBe(2000);
  });

  test('saveAll persists multiple deposits', async () => {
    await repo.saveAll([
      new TimeDeposit(1, 'basic', 100, 30),
      new TimeDeposit(2, 'student', 200, 60),
      new TimeDeposit(3, 'premium', 300, 90),
    ]);
    expect(repo.size).toBe(3);
  });

  test('findAll returns copies (not references to internal store)', async () => {
    await repo.save(new TimeDeposit(1, 'basic', 1000, 45));

    const all = await repo.findAll();
    all[0].balance = 9999; // mutate the returned copy

    const again = await repo.findAll();
    expect(again[0].balance).toBe(1000); // store unchanged
  });

  test('getById returns a copy', async () => {
    await repo.save(new TimeDeposit(1, 'basic', 1000, 45));

    const d = repo.getById(1)!;
    d.balance = 9999;

    expect(repo.getById(1)!.balance).toBe(1000);
  });

  test('getById returns undefined for non-existent id', () => {
    expect(repo.getById(999)).toBeUndefined();
  });

  test('clear removes all data', async () => {
    await repo.save(new TimeDeposit(1, 'basic', 1000, 45));
    repo.clear();
    expect(repo.size).toBe(0);
  });
});

describe('InMemoryWithdrawalRepository', () => {
  let repo: InMemoryWithdrawalRepository;

  beforeEach(() => {
    repo = new InMemoryWithdrawalRepository();
  });

  test('starts empty', async () => {
    const grouped = await repo.findAllGroupedByDepositId();
    expect(grouped.size).toBe(0);
  });

  test('can be initialised with seed data', async () => {
    const seeded = new InMemoryWithdrawalRepository([
      { id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' },
      { id: 2, timeDepositId: 1, amount: 200, date: '2026-02-01' },
    ]);
    const result = await seeded.findByTimeDepositId(1);
    expect(result).toHaveLength(2);
  });

  test('findByTimeDepositId returns only matching withdrawals', async () => {
    repo.add({ id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' });
    repo.add({ id: 2, timeDepositId: 2, amount: 200, date: '2026-02-01' });
    repo.add({ id: 3, timeDepositId: 1, amount: 300, date: '2026-03-01' });

    const result = await repo.findByTimeDepositId(1);
    expect(result).toHaveLength(2);
    expect(result.every((w) => w.timeDepositId === 1)).toBe(true);
  });

  test('findByTimeDepositId returns empty for non-existent deposit', async () => {
    repo.add({ id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' });

    const result = await repo.findByTimeDepositId(999);
    expect(result).toEqual([]);
  });

  test('findAllGroupedByDepositId groups correctly', async () => {
    repo.add({ id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' });
    repo.add({ id: 2, timeDepositId: 1, amount: 200, date: '2026-02-01' });
    repo.add({ id: 3, timeDepositId: 2, amount: 300, date: '2026-03-01' });

    const grouped = await repo.findAllGroupedByDepositId();

    expect(grouped.size).toBe(2);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });

  test('findByTimeDepositId returns copies (not references)', async () => {
    repo.add({ id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' });

    const result = await repo.findByTimeDepositId(1);
    result[0].amount = 9999;

    const again = await repo.findByTimeDepositId(1);
    expect(again[0].amount).toBe(100);
  });

  test('clear removes all data', () => {
    repo.add({ id: 1, timeDepositId: 1, amount: 100, date: '2026-01-01' });
    repo.clear();
    expect(repo.size).toBe(0);
  });
});
