# 1. Project src folder structure explained:

The structure follows Hexagonal Architecture (also called Ports and Adapters)

```
src
│
├── adapters
│   ├── driving
│   │   └── server.ts
│   │
│   └── driven
│       ├── DynamoDBTimeDepositRepository.ts
│       ├── DynamoDBWithdrawalRepository.ts
│       ├── InMemoryTimeDepositRepository.ts
│       └── InMemoryWithdrawalRepository.ts
│
├── application
│   ├── UpdateBalancesUseCase.ts
│   └── GetTimeDepositsUseCase.ts
│
├── domain
│   └── strategies
│       ├── InterestStrategy.ts
│       ├── BasicInterestStrategy.ts
│       ├── StudentInterestStrategy.ts
│       ├── PremiumInterestStrategy.ts
│       ├── InterestStrategyRegistry.ts
│       └── InterestConstants.ts
│
├── ports
│   ├── TimeDepositRepository.ts
│   └── WithdrawalRepository.ts
│
├── TimeDeposit.ts
├── TimeDepositCalculator.ts
└── index.ts
```

# 2.  Hexagonal Architecture Overview:

```
                ┌─────────────────────────────┐
                │        Driving Adapter       │
                │          (REST API)          │
                │        server.ts             │
                └──────────────┬───────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │     Application     │
                    │      Use Cases      │
                    │                    │
                    │ UpdateBalancesUseCase
                    │ GetTimeDepositsUseCase
                    └───────────┬────────┘
                                │
                                ▼
                     ┌───────────────────┐
                     │      Domain        │
                     │                   │
                     │ TimeDeposit       │
                     │ TimeDepositCalculator
                     │ InterestStrategies
                     └──────────┬────────┘
                                │
                                ▼
                         ┌───────────────┐
                         │     Ports      │
                         │ (Interfaces)   │
                         │                │
                         │ TimeDepositRepository
                         │ WithdrawalRepository
                         └───────┬────────┘
                                 │
                                 ▼
                      ┌────────────────────┐
                      │   Driven Adapters   │
                      │                    │
                      │ DynamoDB Repository
                      │ InMemory Repository
                      └────────────────────┘
```

Key idea:

Domain knows nothing about infrastructure.

Dependencies go inward only.

# 3. Domain Core Classes

The core domain logic lives here.

Main classes:

```
Existing code:
TimeDeposit - class can't be modified
TimeDepositCalculator - updateBalance method signature can't be modified

New code:
InterestStrategy
BasicInterestStrategy
StudentInterestStrategy
PremiumInterestStrategy
InterestStrategyRegistry
```

# 4. Class Relationship Diagram:
```
                      ┌─────────────────────┐
                      │    TimeDeposit      │
                      │---------------------│
                      │ id                  │
                      │ planType            │
                      │ balance             │
                      │ days                │
                      └─────────┬───────────┘
                                │
                                │ used by
                                ▼
                     ┌─────────────────────┐
                     │ TimeDepositCalculator│
                     │----------------------│
                     │ updateBalance()      │
                     │ calculateInterest()  │
                     └──────────┬───────────┘
                                │
                                │ selects strategy
                                ▼
                     ┌─────────────────────────┐
                     │ InterestStrategyRegistry│
                     └──────────┬──────────────┘
                                │
                ┌───────────────┼─────────────────┐
                ▼               ▼                 ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ Basic       │ │ Student     │ │ Premium     │
        │ Strategy    │ │ Strategy    │ │ Strategy    │
        └─────┬───────┘ └─────┬───────┘ └─────┬───────┘
              │               │               │
              └──── implements InterestStrategy ───────┘
```

# 5. Strategy Pattern

Your design uses Strategy Pattern to calculate interest.

Interface:

InterestStrategy

Implementations:

BasicInterestStrategy
StudentInterestStrategy
PremiumInterestStrategy

Diagram:
```
                 ┌─────────────────────────┐
                 │     InterestStrategy    │
                 │-------------------------│
                 │ calculateInterest()     │
                 └──────────┬──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ BasicInterest │   │ StudentInterest│ │ PremiumInterest│
 │ Strategy      │   │ Strategy      │ │ Strategy       │
 │ (1%)          │   │ (3% < 1yr)    │ │ (5% after 45d) │
 └──────────────┘   └──────────────┘   └──────────────┘
```

# 6. Strategy Registry

Instead of if / switch, the code uses a registry.

InterestStrategyRegistry

Example concept:
```
registry = {
  basic: BasicInterestStrategy,
  student: StudentInterestStrategy,
  premium: PremiumInterestStrategy
}
```

This enables:
```
const strategy = registry.get(planType)
strategy.calculateInterest()
```

Benefits:

Open/Closed principle (Open for extension but not not for modification)

Easy to add new plans (platinum, elite)

No switch statements

# 7. TimeDepositCalculator Flow

The calculator is the core orchestrator of the domain logic.

Relationship Diagram:
```
TimeDepositCalculator
        │
        │ iterates
        ▼
List<TimeDeposit>
        │
        │ for each
        ▼
InterestStrategyRegistry
        │
        ▼
Correct InterestStrategy
        │
        ▼
calculateInterest()
        │
        ▼
updateBalance()
```

# 8. Execution Flow (Full System)

When the API endpoint runs:

```
HTTP Request
   │
   ▼
server.ts
   │
   ▼
UpdateBalancesUseCase
   │
   ▼
TimeDepositRepository.getAll()
   │
   ▼
TimeDepositCalculator.updateBalance()
   │
   ▼
InterestStrategyRegistry
   │
   ▼
Strategy.calculateInterest()
   │
   ▼
New Balance
   │
   ▼
TimeDepositRepository.save()
```

# 9. Application Layer

Use cases orchestrate the domain.

UpdateBalancesUseCase

Responsibilities:

1 Retrieve deposits
2 Run calculator
3 Persist updates

Diagram:
```
UpdateBalancesUseCase
        │
        │ uses
        ▼
TimeDepositRepository
        │
        ▼
TimeDepositCalculator
GetTimeDepositsUseCase

Just retrieves deposits.

GetTimeDepositsUseCase
        │
        ▼
TimeDepositRepository
```

# 10. Ports (Interfaces):

Ports define contracts.

TimeDepositRepository
WithdrawalRepository

Example:
```
interface TimeDepositRepository {
  findAll()
  save()
}
```

The domain depends only on interfaces, not implementations.

# 11. Driven Adapters

These implement the ports.
```
DynamoDBTimeDepositRepository
DynamoDBWithdrawalRepository
InMemoryTimeDepositRepository
InMemoryWithdrawalRepository
```

Diagram:
```

                TimeDepositRepository (Port)
                          ▲
                          │
          ┌───────────────┼────────────────┐
          ▼                                ▼
DynamoDBTimeDepositRepository     InMemoryTimeDepositRepository
```

# 12. Driving Adapter:
server.ts

This is the entry point.

It exposes the API endpoints required by the instructions.

Endpoints:

GET /time-deposits
POST /update-balances

Flow:
```
HTTP Request
  ↓
server.ts
  ↓
UseCase
  ↓
Domain
```

# 13. Why This Design:

This architecture provides:

1. Domain Isolation:

The domain is independent from infrastructure.

We could replace:

- DynamoDB
- REST
- Lambda
- Database

Without touching the domain.

2. Testability:

We already test the InMemoryRepositories, which mean we don't need to test the database.

3. Extensibility:

To add a new plan:

GoldInterestStrategy

We only need to create a new file like:

class GoldInterestStrategy implements InterestStrategy

And register it:

InterestStrategyRegistry.register("gold")

No other code changes are required.

# 14. Final Full Architecture Diagram:

```
                 ┌───────────────────────┐
                 │        API             │
                 │     server.ts          │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │      Application       │
                 │                       │
                 │ UpdateBalancesUseCase │
                 │ GetTimeDepositsUseCase│
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │        Domain          │
                 │                       │
                 │ TimeDeposit            │
                 │ TimeDepositCalculator  │
                 │ InterestStrategy       │
                 │ InterestRegistry       │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │         Ports          │
                 │                       │
                 │ TimeDepositRepository │
                 │ WithdrawalRepository  │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │     Infrastructure     │
                 │                       │
                 │ DynamoDB Repositories │
                 │ InMemory Repositories │
                 └───────────────────────┘
```