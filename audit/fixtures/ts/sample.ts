const BACK_LABELS: Record<string, string> = {
  "team-analysis": "back to team",
};

enum Level {
  Info,
  Warn,
}

interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  private count = 0;

  log(message: string): void {
    this.count += 1;
    const prefix = `[${Level.Info}]`;
    console.log(`${prefix} ${message} #${this.count}`);
  }
}

function resolveLabel(from: string, fallback?: string): string {
  const n = parseInt(from, 10);
  const label = BACK_LABELS[from] ?? fallback ?? `unknown-${n}`;
  return label;
}

type Handler = (input: string) => string;
const handler: Handler = (input) => resolveLabel(input);
export const result = handler("team-analysis");
