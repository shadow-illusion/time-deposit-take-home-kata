import { TimeDeposit } from '../TimeDeposit';
import { TimeDepositCalculator } from '../TimeDepositCalculator';
import { InMemoryTimeDepositRepository } from '../adapters/driven/InMemoryTimeDepositRepository';
import { InMemoryWithdrawalRepository } from '../adapters/driven/InMemoryWithdrawalRepository';
import { GetTimeDepositsUseCase } from '../application/GetTimeDepositsUseCase';
import { UpdateBalancesUseCase } from '../application/UpdateBalancesUseCase';
import { Withdrawal } from '../ports/WithdrawalRepository';

describe('GetTimeDepositsUseCase', () => {
  let depositRepo: InMemoryTimeDepositRepository;
  let withdrawalRepo: InMemoryWithdrawalRepository;
  let useCase: GetTimeDepositsUseCase;

  beforeEach(() => {
    depositRepo = new InMemoryTimeDepositRepository();
    withdrawalRepo = new InMemoryWithdrawalRepository();
    useCase = new GetTimeDepositsUseCase(depositRepo, withdrawalRepo);
  });

  test('returns empty array when no deposits exist', async () => {
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  test('returns deposits with empty withdrawals when none exist', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 100_000, 45));
    await depositRepo.save(new TimeDeposit(2, 'student', 50_000, 100));

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      planType: 'basic',
      balance: 100_000,
      days: 45,
      withdrawals: [],
    });
    expect(result[1]).toEqual({
      id: 2,
      planType: 'student',
      balance: 50_000,
      days: 100,
      withdrawals: [],
    });
  });

  test('enriches deposits with their withdrawal records', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 100_000, 45));
    await depositRepo.save(new TimeDeposit(2, 'premium', 250_000, 60));

    withdrawalRepo.add({ id: 1, timeDepositId: 1, amount: 500, date: '2026-01-15' });
    withdrawalRepo.add({ id: 2, timeDepositId: 1, amount: 1200, date: '2026-02-20' });
    withdrawalRepo.add({ id: 3, timeDepositId: 2, amount: 3000, date: '2026-03-01' });

    const result = await useCase.execute();

    expect(result).toHaveLength(2);

    const deposit1 = result.find((d) => d.id === 1)!;
    expect(deposit1.withdrawals).toHaveLength(2);
    expect(deposit1.withdrawals[0].amount).toBe(500);
    expect(deposit1.withdrawals[1].amount).toBe(1200);

    const deposit2 = result.find((d) => d.id === 2)!;
    expect(deposit2.withdrawals).toHaveLength(1);
    expect(deposit2.withdrawals[0].amount).toBe(3000);
  });

  test('deposits with no withdrawals get empty array, not undefined', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 100_000, 45));
    // No withdrawals added for deposit 1

    const result = await useCase.execute();
    expect(result[0].withdrawals).toEqual([]);
  });

  test('response matches the required API schema: id, planType, balance, days, withdrawals', async () => {
    await depositRepo.save(new TimeDeposit(42, 'premium', 999.99, 200));

    const result = await useCase.execute();

    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('planType');
    expect(result[0]).toHaveProperty('balance');
    expect(result[0]).toHaveProperty('days');
    expect(result[0]).toHaveProperty('withdrawals');
    expect(Object.keys(result[0])).toHaveLength(5);
  });
});

describe('UpdateBalancesUseCase', () => {
  let depositRepo: InMemoryTimeDepositRepository;
  let calculator: TimeDepositCalculator;
  let useCase: UpdateBalancesUseCase;

  beforeEach(() => {
    depositRepo = new InMemoryTimeDepositRepository();
    calculator = new TimeDepositCalculator();
    useCase = new UpdateBalancesUseCase(depositRepo, calculator);
  });

  test('returns 0 updated when no deposits exist', async () => {
    const result = await useCase.execute();
    expect(result.updatedCount).toBe(0);
  });

  test('updates a basic plan deposit balance with interest', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 120_000, 45));

    const result = await useCase.execute();

    expect(result.updatedCount).toBe(1);

    const updated = await depositRepo.findAll();
    // (120000 × 0.01) / 12 = 100
    expect(updated[0].balance).toBe(120_100);
  });

  test('updates a student plan deposit balance with interest', async () => {
    await depositRepo.save(new TimeDeposit(1, 'student', 120_000, 100));

    await useCase.execute();

    const updated = await depositRepo.findAll();
    // (120000 × 0.03) / 12 = 300
    expect(updated[0].balance).toBe(120_300);
  });

  test('updates a premium plan deposit balance with interest', async () => {
    await depositRepo.save(new TimeDeposit(1, 'premium', 120_000, 46));

    await useCase.execute();

    const updated = await depositRepo.findAll();
    // (120000 × 0.05) / 12 = 500
    expect(updated[0].balance).toBe(120_500);
  });

  test('does not add interest for deposits in grace period', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 100_000, 10));

    await useCase.execute();

    const updated = await depositRepo.findAll();
    expect(updated[0].balance).toBe(100_000); // unchanged
  });

  test('persists updated balances back to the repository', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 120_000, 45));
    await depositRepo.save(new TimeDeposit(2, 'premium', 120_000, 46));

    await useCase.execute();

    // Verify the repo has the updated values (not the originals)
    const stored1 = depositRepo.getById(1)!;
    const stored2 = depositRepo.getById(2)!;
    expect(stored1.balance).toBe(120_100);
    expect(stored2.balance).toBe(120_500);
  });

  test('handles multiple deposits in a single execution', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 120_000, 45));
    await depositRepo.save(new TimeDeposit(2, 'student', 120_000, 100));
    await depositRepo.save(new TimeDeposit(3, 'premium', 120_000, 46));

    const result = await useCase.execute();
    expect(result.updatedCount).toBe(3);
  });

  test('executing twice compounds interest correctly', async () => {
    await depositRepo.save(new TimeDeposit(1, 'basic', 120_000, 45));

    await useCase.execute();
    const afterFirst = depositRepo.getById(1)!;
    expect(afterFirst.balance).toBe(120_100);

    await useCase.execute();
    const afterSecond = depositRepo.getById(1)!;
    // (120100 × 0.01) / 12 = 100.083... → rounded 100.08 → 120200.08
    expect(afterSecond.balance).toBe(120_200.08);
  });
});
