export {};

declare global {
  interface NumberConstructor {
    isInteger(value: any): value is number;
  }
}
