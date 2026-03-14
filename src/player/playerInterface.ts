export interface PlayerInterface {
  play(): Promise<void>;

  getTime(): number;

  skipToTimestamp?(timestamp: number): void;
}
