# Sequence Diagram – Update Balance Flow

This diagram shows runtime execution when the API updates balances.

This shows clearly:

- API triggers the use case
- Use case retrieves deposits
- Calculator loops deposits
- Strategy calculates interest
- Updated balances are persisted

```mermaid
sequenceDiagram

participant Client
participant API
participant UseCase
participant Repo
participant Calculator
participant Registry
participant Strategy

Client->>API: POST /update-balances

API->>UseCase: execute()

UseCase->>Repo: findAllTimeDeposits()
Repo-->>UseCase: List<TimeDeposit>

UseCase->>Calculator: updateBalance(deposits)

loop for each deposit
Calculator->>Registry: getStrategy(planType)
Registry-->>Calculator: Strategy

Calculator->>Strategy: calculateInterest(balance, days)
Strategy-->>Calculator: interestAmount

Calculator->>Calculator: updateBalance()
end

UseCase->>Repo: saveAll(updatedDeposits)

Repo-->>UseCase: success

UseCase-->>API: response
API-->>Client: 200 OK
```