export class IdempotencyStore {
  private static processed = new Set<string>();

  public static isDuplicate(eventId: string): boolean {
    if (this.processed.has(eventId)) return true;
    this.processed.add(eventId);
    return false;
  }

  public static clear(): void {
    this.processed.clear();
  }
}
