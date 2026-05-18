/**
 * 固定容量环形缓冲区
 * - O(1) push/pop/peek
 * - 满时自动覆盖最旧数据
 * - 适用于实时 ECG 数据流
 */
export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0; // 下一次写入位置
  private count = 0; // 当前元素数量
  readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('RingBuffer capacity must be >= 1');
    this.capacity = capacity;
    this.buffer = new Array<T | undefined>(capacity);
  }

  /** 当前元素数量 */
  get length(): number {
    return this.count;
  }

  /** 是否已满 */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /** 是否为空 */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * 添加元素，满时覆盖最旧数据
   * @returns 被覆盖的元素（如有）
   */
  push(item: T): T | undefined {
    let overwritten: T | undefined;
    if (this.isFull) {
      overwritten = this.buffer[this.head];
    } else {
      this.count++;
    }
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    return overwritten;
  }

  /**
   * 移除并返回最旧元素
   */
  pop(): T | undefined {
    if (this.isEmpty) return undefined;
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    const item = this.buffer[tail];
    this.buffer[tail] = undefined;
    this.count--;
    return item;
  }

  /**
   * 查看最旧元素（不移除）
   */
  peek(): T | undefined {
    if (this.isEmpty) return undefined;
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    return this.buffer[tail];
  }

  /**
   * 查看最新元素（不移除）
   */
  peekLast(): T | undefined {
    if (this.isEmpty) return undefined;
    const last = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[last];
  }

  /**
   * 按索引访问（0 = 最旧）
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    const pos = (this.head - this.count + index + this.capacity) % this.capacity;
    return this.buffer[pos];
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = undefined;
    }
    this.head = 0;
    this.count = 0;
  }

  /**
   * 转换为普通数组（最旧 → 最新）
   */
  toArray(): T[] {
    const result = new Array<T>(this.count);
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(tail + i) % this.capacity]!;
    }
    return result;
  }

  /**
   * 批量推入（比逐个 push 更高效）
   * @returns 被覆盖的元素数组
   */
  pushMany(items: T[]): T[] {
    const overwritten: T[] = [];
    for (const item of items) {
      const old = this.push(item);
      if (old !== undefined) overwritten.push(old);
    }
    return overwritten;
  }

  /**
   * 遍历（最旧 → 最新）
   */
  forEach(callback: (item: T, index: number) => void): void {
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      callback(this.buffer[(tail + i) % this.capacity]!, i);
    }
  }

  /**
   * 支持 for...of 迭代
   */
  *[Symbol.iterator](): IterableIterator<T> {
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      yield this.buffer[(tail + i) % this.capacity]!;
    }
  }
}
