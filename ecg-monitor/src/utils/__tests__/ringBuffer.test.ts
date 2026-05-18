/**
 * RingBuffer 单元测试
 *
 * 测试覆盖：
 * 1. 构造与基本属性（capacity / length / isEmpty / isFull）
 * 2. push — 正常写入 & 满时覆盖
 * 3. pop  — 正常读取 & 空缓冲区
 * 4. peek / peekLast — 不移除的读取
 * 5. get  — 按索引访问
 * 6. clear — 清空
 * 7. toArray — 有序输出
 * 8. pushMany — 批量推入
 * 9. forEach / for...of — 遍历
 * 10. 边界：capacity=1、覆盖多轮
 */
import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../ringBuffer';

describe('RingBuffer', () => {
  // ─── 构造 ──────────────────────────────────────────────────
  describe('constructor', () => {
    it('应拒绝 capacity < 1', () => {
      expect(() => new RingBuffer(0)).toThrow(RangeError);
      expect(() => new RingBuffer(-1)).toThrow(RangeError);
    });

    it('capacity=1 时应正常工作', () => {
      const buf = new RingBuffer<number>(1);
      expect(buf.capacity).toBe(1);
      expect(buf.length).toBe(0);
      expect(buf.isEmpty).toBe(true);
      expect(buf.isFull).toBe(false);
    });
  });

  // ─── 基本属性 ──────────────────────────────────────────────
  describe('基本属性', () => {
    it('初始状态应为空', () => {
      const buf = new RingBuffer<string>(5);
      expect(buf.length).toBe(0);
      expect(buf.isEmpty).toBe(true);
      expect(buf.isFull).toBe(false);
    });

    it('push 后 length 递增', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      expect(buf.length).toBe(1);
      buf.push(2);
      expect(buf.length).toBe(2);
      buf.push(3);
      expect(buf.length).toBe(3);
      expect(buf.isFull).toBe(true);
    });
  });

  // ─── push & 覆盖 ──────────────────────────────────────────
  describe('push', () => {
    it('未满时 push 返回 undefined', () => {
      const buf = new RingBuffer<number>(3);
      expect(buf.push(1)).toBeUndefined();
      expect(buf.push(2)).toBeUndefined();
    });

    it('满时 push 应覆盖最旧数据并返回被覆盖值', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(10);
      buf.push(20);
      buf.push(30);
      // 缓冲区满：[10, 20, 30]
      expect(buf.push(40)).toBe(10); // 覆盖 10
      expect(buf.push(50)).toBe(20); // 覆盖 20
      expect(buf.length).toBe(3);
      expect(buf.toArray()).toEqual([30, 40, 50]);
    });

    it('capacity=1 时每次 push 都覆盖', () => {
      const buf = new RingBuffer<number>(1);
      expect(buf.push(1)).toBeUndefined();
      expect(buf.push(2)).toBe(1);
      expect(buf.push(3)).toBe(2);
      expect(buf.peek()).toBe(3);
    });
  });

  // ─── pop ───────────────────────────────────────────────────
  describe('pop', () => {
    it('空缓冲区 pop 返回 undefined', () => {
      const buf = new RingBuffer<number>(3);
      expect(buf.pop()).toBeUndefined();
    });

    it('pop 按 FIFO 顺序移除', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      expect(buf.pop()).toBe(1);
      expect(buf.pop()).toBe(2);
      expect(buf.pop()).toBe(3);
      expect(buf.pop()).toBeUndefined();
      expect(buf.isEmpty).toBe(true);
    });

    it('覆盖后 pop 顺序正确', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.push(4); // 覆盖 1
      buf.push(5); // 覆盖 2
      expect(buf.pop()).toBe(3);
      expect(buf.pop()).toBe(4);
      expect(buf.pop()).toBe(5);
    });
  });

  // ─── peek / peekLast ──────────────────────────────────────
  describe('peek & peekLast', () => {
    it('空缓冲区 peek 返回 undefined', () => {
      const buf = new RingBuffer<number>(3);
      expect(buf.peek()).toBeUndefined();
      expect(buf.peekLast()).toBeUndefined();
    });

    it('peek 返回最旧元素，peekLast 返回最新元素', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(10);
      buf.push(20);
      buf.push(30);
      expect(buf.peek()).toBe(10);
      expect(buf.peekLast()).toBe(30);
      // peek 不应移除元素
      expect(buf.length).toBe(3);
    });

    it('capacity=1 时 peek === peekLast', () => {
      const buf = new RingBuffer<number>(1);
      buf.push(42);
      expect(buf.peek()).toBe(42);
      expect(buf.peekLast()).toBe(42);
    });
  });

  // ─── get ───────────────────────────────────────────────────
  describe('get', () => {
    it('越界索引返回 undefined', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      expect(buf.get(-1)).toBeUndefined();
      expect(buf.get(1)).toBeUndefined();
    });

    it('按索引访问（0 = 最旧）', () => {
      const buf = new RingBuffer<number>(5);
      buf.push(10);
      buf.push(20);
      buf.push(30);
      expect(buf.get(0)).toBe(10);
      expect(buf.get(1)).toBe(20);
      expect(buf.get(2)).toBe(30);
    });

    it('覆盖后索引仍正确', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.push(4); // 覆盖 1
      expect(buf.get(0)).toBe(2);
      expect(buf.get(1)).toBe(3);
      expect(buf.get(2)).toBe(4);
    });
  });

  // ─── clear ─────────────────────────────────────────────────
  describe('clear', () => {
    it('清空后恢复初始状态', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.clear();
      expect(buf.length).toBe(0);
      expect(buf.isEmpty).toBe(true);
      expect(buf.isFull).toBe(false);
      expect(buf.peek()).toBeUndefined();
      expect(buf.toArray()).toEqual([]);
    });
  });

  // ─── toArray ───────────────────────────────────────────────
  describe('toArray', () => {
    it('空缓冲区返回空数组', () => {
      const buf = new RingBuffer<number>(3);
      expect(buf.toArray()).toEqual([]);
    });

    it('返回最旧→最新的有序数组', () => {
      const buf = new RingBuffer<number>(5);
      buf.push(3);
      buf.push(1);
      buf.push(4);
      buf.push(1);
      buf.push(5);
      expect(buf.toArray()).toEqual([3, 1, 4, 1, 5]);
    });

    it('覆盖后顺序正确', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.push(4);
      buf.push(5);
      expect(buf.toArray()).toEqual([3, 4, 5]);
    });
  });

  // ─── pushMany ──────────────────────────────────────────────
  describe('pushMany', () => {
    it('批量推入未满缓冲区', () => {
      const buf = new RingBuffer<number>(5);
      const overwritten = buf.pushMany([1, 2, 3]);
      expect(overwritten).toEqual([]);
      expect(buf.toArray()).toEqual([1, 2, 3]);
    });

    it('批量推入超过容量时返回被覆盖值', () => {
      const buf = new RingBuffer<number>(3);
      const overwritten = buf.pushMany([1, 2, 3, 4, 5]);
      expect(overwritten).toEqual([1, 2]);
      expect(buf.toArray()).toEqual([3, 4, 5]);
    });
  });

  // ─── 遍历 ──────────────────────────────────────────────────
  describe('forEach', () => {
    it('按 FIFO 顺序遍历', () => {
      const buf = new RingBuffer<number>(3);
      buf.push(10);
      buf.push(20);
      buf.push(30);
      const collected: { item: number; index: number }[] = [];
      buf.forEach((item, index) => collected.push({ item, index }));
      expect(collected).toEqual([
        { item: 10, index: 0 },
        { item: 20, index: 1 },
        { item: 30, index: 2 },
      ]);
    });
  });

  describe('for...of 迭代', () => {
    it('支持 for...of 循环', () => {
      const buf = new RingBuffer<string>(3);
      buf.push('a');
      buf.push('b');
      buf.push('c');
      const result: string[] = [];
      for (const item of buf) {
        result.push(item);
      }
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  // ─── 多轮覆盖压力测试 ──────────────────────────────────────
  describe('多轮覆盖', () => {
    it('反复覆盖 100 次后数据仍正确', () => {
      const buf = new RingBuffer<number>(3);
      for (let i = 0; i < 100; i++) {
        buf.push(i);
      }
      expect(buf.length).toBe(3);
      expect(buf.toArray()).toEqual([97, 98, 99]);
      expect(buf.peek()).toBe(97);
      expect(buf.peekLast()).toBe(99);
    });
  });
});
