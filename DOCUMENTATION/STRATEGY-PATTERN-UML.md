# Strategy Pattern UML Diagram

This diagram explains the interest calculation strategy design.

```mermaid
classDiagram

class InterestStrategy {
  <<interface>>
  +calculateInterest(balance, days)
}

class BasicInterestStrategy {
  +calculateInterest()
}

class StudentInterestStrategy {
  +calculateInterest()
}

class PremiumInterestStrategy {
  +calculateInterest()
}

class InterestStrategyRegistry {
  +getStrategy(planType)
}

class TimeDepositCalculator {
  +updateBalance(deposits)
}

class TimeDeposit {
  id
  planType
  balance
  days
}

InterestStrategy <|.. BasicInterestStrategy
InterestStrategy <|.. StudentInterestStrategy
InterestStrategy <|.. PremiumInterestStrategy

InterestStrategyRegistry --> InterestStrategy

TimeDepositCalculator --> InterestStrategyRegistry
TimeDepositCalculator --> TimeDeposit
```

---

The calculator:

selects strategy → strategy calculates interest

**This satisfies the requirement:**

Design must be extensible for future complexities

Because you can simply add:

GoldInterestStrategy
CryptoInterestStrategy
VIPInterestStrategy

without modifying the calculator.