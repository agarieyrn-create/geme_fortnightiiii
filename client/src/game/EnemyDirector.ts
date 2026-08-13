// Stormfall: Last Horizon — enemy collection and lifecycle director.
export type EnemyAgentLike<TContext> = { alive: boolean; update: (delta: number, context: TContext) => void; dispose: () => void };

export class EnemyDirector<TAgent extends EnemyAgentLike<TContext>, TContext> {
  constructor(readonly agents: TAgent[]) {}

  update(delta: number, context: TContext) {
    this.agents.forEach((agent) => {
      if (agent.alive) agent.update(delta, context);
    });
  }

  dispose() {
    this.agents.forEach((agent) => agent.dispose());
    this.agents.length = 0;
  }

  remaining() {
    return this.agents.filter((agent) => agent.alive).length;
  }
}
