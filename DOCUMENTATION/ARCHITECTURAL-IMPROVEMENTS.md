## Add idempotency protection to balance updates.

**Because if the job runs twice, then the interest could be applied twice.**

Solution: `idempotencyKey or calculationDate lock`

Example DynamoDB field: `lastInterestCalculationDate`

It prevents recalculating the same period.

## Proposed AWS Balance Recalculation at Scale (Millions of Deposits):


#### Problem statement: 

When deposits grow to millions, recalculating balances with a single Lambda becomes problematic because:

- DynamoDB scan limits
- Lambda 15-minute timeout
- cost spikes
- retry complexity

The scalable solution is distributed recalculation using Step Functions and parallel workers.

```mermaid
flowchart TB

Scheduler[EventBridge Scheduler\Daily Trigger]

Scheduler --> StepFunctions

subgraph Orchestration
StepFunctions[Step Functions\Balance Recalculation Workflow]
end

StepFunctions --> ShardGenerator

ShardGenerator[Shard Generator Lambda\Split Deposits into Segments]

ShardGenerator --> ParallelWorkers

subgraph Parallel Processing
Worker1[Lambda Worker 1\Segment A]
Worker2[Lambda Worker 2\Segment B]
Worker3[Lambda Worker 3\Segment C]
WorkerN[Lambda Worker N]
end

ParallelWorkers --> Worker1
ParallelWorkers --> Worker2
ParallelWorkers --> Worker3
ParallelWorkers --> WorkerN

subgraph Database
Deposits[(DynamoDB\nTimeDeposits Table)]
Withdrawals[(DynamoDB\nWithdrawals Table)]
end

Worker1 --> Deposits
Worker2 --> Deposits
Worker3 --> Deposits
WorkerN --> Deposits

Deposits --> Streams

subgraph Events
Streams[DynamoDB Streams]
EventBridge[EventBridge]
AuditLambda[Audit Processor Lambda]
AuditTable[(Balance Audit Log Table)]
end

Streams --> EventBridge
EventBridge --> AuditLambda
AuditLambda --> AuditTable
```

**Advantages of this architecture:**
- horizontally scalable
- safe retries
- fault isolation
- auditability
- no table scans inside one lambda


## Proposed AWS Security Enhanced Architecture:

`Client → VPN / DirectConnect → VPC → Private API Gateway → Lambda`

```mermaid
flowchart TB

Client[Internal Banking Systems]

subgraph Corporate Network
VPN[Site-to-Site VPN / Direct Connect]
end

subgraph AWS VPC
Endpoint[VPC Interface Endpoint\nPrivate API Gateway Access]

PrivateAPI[Private API Gateway]

SG[Lambda Security Group]

LambdaGet[Lambda: GetTimeDeposits]
LambdaUpdate[Lambda: UpdateBalances]
AuditLambda[Lambda: Audit Processor]
end


subgraph DynamoDB
Deposits[(timeDeposits)]
Withdrawals[(withdrawals)]
AuditTable[(balanceAuditLog)]
end


subgraph Event Processing
Streams[DynamoDB Streams]
EventBridge[EventBridge Bus]
end


subgraph Observability
Logs[CloudWatch Logs]
Dashboard[CloudWatch Dashboard]
XRay[X-Ray Tracing]
end


Client --> VPN
VPN --> Endpoint
Endpoint --> PrivateAPI

PrivateAPI --> LambdaGet
PrivateAPI --> LambdaUpdate

LambdaGet --> Deposits
LambdaGet --> Withdrawals

LambdaUpdate --> Deposits

Deposits --> Streams
Streams --> EventBridge
EventBridge --> AuditLambda
AuditLambda --> AuditTable

LambdaGet --> Logs
LambdaUpdate --> Logs
AuditLambda --> Logs

LambdaGet --> XRay
LambdaUpdate --> XRay
AuditLambda --> XRay
```

---

### 1. Private API Gateway

    Only reachable through:

    VPC Interface Endpoint

    No internet exposure.


### 2. Corporate Network Access
    Internal systems connect via:

    Site-to-Site VPN

    AWS Direct Connect

    Typical bank topology:

    Datacenter → DirectConnect → AWS VPC

### 3. VPC Endpoint Policy

    Controls which principals can call the API.

    Example restriction:

    only internal IAM roles

### 4. Lambda Security Groups

    Restrict outbound access.

    Best practice:

    deny internet egress

### 5. Event Driven Audit Trail

    Balance changes produce events that are critical for financial compliance:
    ```
    DynamoDB Streams
        ↓
    EventBridge
        ↓
    Audit Lambda
        ↓
    Immutable audit log
    ```

---

## Security Layers Summary:

- **Corporate VPN Layer:** restrict external access
- **Private API Gateway Layer:** internal-only API
- **VPC Endpoint Layer:** private access path
- **API Resource Policy Layer:** allow only trusted accounts
- **IAM Authorization	Layer:** authenticate callers
- **Lambda Security Groups Layer:**	network isolation
- **DynamoDB Encryption Layer:** protect financial data
- **Audit Logs Layer:**	regulatory compliance