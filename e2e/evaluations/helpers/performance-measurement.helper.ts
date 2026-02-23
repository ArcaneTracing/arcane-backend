export interface MemoryUsage {
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
}
export interface PerformanceMetrics {
  executionTimeMs: number;
  memoryBeforeMB: number;
  memoryAfterMB: number;
  memoryDeltaMB: number;
  peakMemoryMB: number;
}
export function getMemoryUsage(): MemoryUsage {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: usage.heapUsed / 1024 / 1024,
    heapTotalMB: usage.heapTotal / 1024 / 1024,
    externalMB: usage.external / 1024 / 1024,
    rssMB: usage.rss / 1024 / 1024,
  };
}
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  label?: string,
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  if (global.gc) {
    global.gc();
  }

  const memoryBefore = getMemoryUsage();
  const startTime = performance.now();

  const result = await fn();

  const endTime = performance.now();
  const memoryAfter = getMemoryUsage();

  const metrics: PerformanceMetrics = {
    executionTimeMs: endTime - startTime,
    memoryBeforeMB: memoryBefore.heapUsedMB,
    memoryAfterMB: memoryAfter.heapUsedMB,
    memoryDeltaMB: memoryAfter.heapUsedMB - memoryBefore.heapUsedMB,
    peakMemoryMB: Math.max(memoryBefore.heapUsedMB, memoryAfter.heapUsedMB),
  };

  if (label) {
    console.log(`[E2E] [Performance] ${label}`);
    console.log(`  Execution time: ${metrics.executionTimeMs.toFixed(2)}ms`);
    console.log(`  Memory before: ${metrics.memoryBeforeMB.toFixed(2)}MB`);
    console.log(`  Memory after: ${metrics.memoryAfterMB.toFixed(2)}MB`);
    console.log(`  Memory delta: ${metrics.memoryDeltaMB.toFixed(2)}MB`);
  }

  return { result, metrics };
}
export function formatPerformanceMetrics(
  metrics: PerformanceMetrics,
  label: string,
): string {
  return `[Performance Test] ${label}
  Execution time: ${metrics.executionTimeMs.toFixed(2)}ms
  Memory before: ${metrics.memoryBeforeMB.toFixed(2)}MB
  Memory after: ${metrics.memoryAfterMB.toFixed(2)}MB
  Memory delta: ${metrics.memoryDeltaMB.toFixed(2)}MB
  Peak memory: ${metrics.peakMemoryMB.toFixed(2)}MB`;
}
