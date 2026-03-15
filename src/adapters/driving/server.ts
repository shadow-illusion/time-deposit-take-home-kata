import express, { Request, Response } from 'express';
import { TimeDeposit } from '../../domain';
import { TimeDepositCalculator } from '../../domain';
import { InMemoryTimeDepositRepository } from '../driven/InMemoryTimeDepositRepository';
import { InMemoryWithdrawalRepository } from '../driven/InMemoryWithdrawalRepository';
import { GetTimeDepositsUseCase } from '../../application/GetTimeDepositsUseCase';
import { UpdateBalancesUseCase } from '../../application/UpdateBalancesUseCase';
import { Withdrawal } from '../../ports/WithdrawalRepository';

/**
 * Local Express server — DRIVING ADAPTER for local development.
 *
 * Uses in-memory repositories (no AWS dependencies required).
 * Provides the same two API endpoints as the Lambda + API Gateway stack:
 *   GET  /time-deposits                → Retrieve all deposits with withdrawals
 *   POST /time-deposits/update-balances → Recalculate all balances
 *
 * This proves the hexagonal architecture works: same use cases,
 * different driving adapter (Express vs Lambda), different driven
 * adapters (InMemory vs DynamoDB).
 */

// ─── Seed Data ──────────────────────────────────────────────────────────────
const seedDeposits: TimeDeposit[] = [
  new TimeDeposit(1, 'basic', 100_000, 45),
  new TimeDeposit(2, 'student', 50_000, 100),
  new TimeDeposit(3, 'premium', 250_000, 60),
  new TimeDeposit(4, 'basic', 75_000, 10),      // Grace period — no interest
  new TimeDeposit(5, 'student', 30_000, 400),    // Past 1 year — no interest
];

const seedWithdrawals: Withdrawal[] = [
  { id: 1, timeDepositId: 1, amount: 500, date: '2026-01-15' },
  { id: 2, timeDepositId: 1, amount: 1200, date: '2026-02-20' },
  { id: 3, timeDepositId: 3, amount: 3000, date: '2026-03-01' },
];

// ─── Composition Root (wire adapters → use cases) ───────────────────────────
const timeDepositRepo = new InMemoryTimeDepositRepository(seedDeposits);
const withdrawalRepo = new InMemoryWithdrawalRepository(seedWithdrawals);
const calculator = new TimeDepositCalculator();

const getTimeDepositsUseCase = new GetTimeDepositsUseCase(timeDepositRepo, withdrawalRepo);
const updateBalancesUseCase = new UpdateBalancesUseCase(timeDepositRepo, calculator);

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /time-deposits
app.get('/time-deposits', async (_req: Request, res: Response) => {
  try {
    const result = await getTimeDepositsUseCase.execute();
    res.json({
      data: result,
      metadata: { count: result.length },
    });
  } catch (error) {
    console.error('GET /time-deposits error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /time-deposits/update-balances
app.post('/time-deposits/update-balances', async (_req: Request, res: Response) => {
  try {
    const result = await updateBalancesUseCase.execute();
    res.json({
      message: 'Balances updated successfully',
      metadata: { updatedCount: result.updatedCount },
    });
  } catch (error) {
    console.error('POST /time-deposits/update-balances error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Start Server ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Time Deposit API — Local Development Server                  ║
║                                                               ║
║  Base URL:  http://localhost:${PORT}                            ║
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /time-deposits                 → List all deposits    ║
║    POST /time-deposits/update-balances → Update balances      ║
║    GET  /health                        → Health check         ║
║                                                               ║
║  Seed data: ${seedDeposits.length} deposits, ${seedWithdrawals.length} withdrawals                      ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export { app };
