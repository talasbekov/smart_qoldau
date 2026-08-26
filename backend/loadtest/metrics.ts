// Сбор задержек по шагам сценария. Хранятся все значения, а не бегущее
// среднее: интересуют хвосты (p95/p99), по среднему нагрузочный тест
// читать бессмысленно — оно прячет ровно те случаи, ради которых тест и
// затевается.
export class Metric {
  private readonly values: number[] = [];
  private failures = 0;

  constructor(readonly name: string) {}

  record(ms: number): void {
    this.values.push(ms);
  }

  fail(): void {
    this.failures++;
  }

  async measure<T>(fn: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const result = await fn();
      this.record(performance.now() - started);
      return result;
    } catch (e) {
      this.fail();
      throw e;
    }
  }

  private percentile(p: number): number {
    if (!this.values.length) return NaN;
    const sorted = [...this.values].sort((a, b) => a - b);
    // Ближайший ранг: на выборках в сотни значений интерполяция ничего не
    // уточняет, а объяснять её в отчёте пришлось бы.
    const index = Math.min(
      sorted.length - 1,
      Math.ceil((p / 100) * sorted.length) - 1,
    );
    return sorted[Math.max(0, index)];
  }

  summary(): {
    name: string;
    count: number;
    failures: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  } {
    return {
      name: this.name,
      count: this.values.length,
      failures: this.failures,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
      max: this.values.length ? Math.max(...this.values) : NaN,
    };
  }
}

export class MetricSet {
  private readonly metrics = new Map<string, Metric>();

  get(name: string): Metric {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = new Metric(name);
      this.metrics.set(name, metric);
    }
    return metric;
  }

  table(): void {
    const rows = [...this.metrics.values()].map((m) => {
      const s = m.summary();
      return {
        шаг: s.name,
        успешно: s.count,
        ошибок: s.failures,
        'p50, мс': round(s.p50),
        'p95, мс': round(s.p95),
        'p99, мс': round(s.p99),
        'max, мс': round(s.max),
      };
    });
    console.table(rows);
  }

  markdown(): string {
    const header =
      '| Шаг | Успешно | Ошибок | p50, мс | p95, мс | p99, мс | max, мс |\n' +
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n';
    const lines = [...this.metrics.values()].map((m) => {
      const s = m.summary();
      return `| ${s.name} | ${s.count} | ${s.failures} | ${round(s.p50)} | ${round(s.p95)} | ${round(s.p99)} | ${round(s.max)} |`;
    });
    return header + lines.join('\n') + '\n';
  }

  totalFailures(): number {
    return [...this.metrics.values()].reduce(
      (sum, m) => sum + m.summary().failures,
      0,
    );
  }
}

function round(v: number): string {
  return Number.isFinite(v) ? v.toFixed(0) : '—';
}

/// Ограниченный по параллельности проход по списку: 500 одновременных
/// открытых сокетов — часть теста, а 500 одновременных HTTP-запросов на
/// этапе подготовки — нет, они только искажают картину.
export async function pooled<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    })(),
  );
  await Promise.all(runners);
  return results;
}
