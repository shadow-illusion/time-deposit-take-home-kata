# IMPORTANT:

- To run Docker locally you will need to have it installed in your machine. [Docker Desktop](https://www.docker.com/products/docker-desktop/), [Homebrew Formula](https://formulae.brew.sh/formula/docker).

- You will need to install the [Mermaid extension]( mermaidchart.com) or use the [Mermaid Website](https://mermaid.ai/) to see some of the flowcharts in this folder.

## `src` folder architecture remarks:

This solution follows Hexagonal Architecture (Ports and Adapters) to isolate domain logic from infrastructure.

Key characteristics:
```
• Domain-driven design
• Strategy pattern for interest calculations
• Repository pattern via ports
• Replaceable infrastructure adapters
• Extensible interest calculation logic
```