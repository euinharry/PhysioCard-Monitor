/**
 * DataRouter 单元测试
 *
 * 测试覆盖：
 * 1. 构造 — 初始状态正确
 * 2. subscribe + dispatch — 按参数类型分发到对应回调
 * 3. dispatchMany — 批量路由
 * 4. 多参数订阅 — 各参数独立分发
 * 5. 取消订阅 — unsubscribe 移除回调
 * 6. 重复取消 — 幂等
 * 7. dispatch 无订阅者 — 无错误
 * 8. dispatchMany 空数组 — 无错误
 * 9. clear — 清除所有订阅
 * 10. getSubscriberCount — 订阅计数
 * 11. 回调异常隔离 — 单个异常不影响其他回调
 * 12. 未知参数类型 — 静默处理
 * 13. getDataRouter — 单例工厂
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataRouter, getDataRouter } from '../dataRouter';
import { PhysioParameter, type PhysioFrame } from '../../types/physio';

function makeFrame(
  parameter: PhysioParameter,
  overrides: Partial<PhysioFrame> = {},
): PhysioFrame {
  return {
    parameter,
    timestamp: Date.now(),
    channels: {},
    ...overrides,
  };
}

describe('DataRouter', () => {
  let router: DataRouter;

  beforeEach(() => {
    router = new DataRouter();
  });

  // ─── 构造 ──────────────────────────────────────────────────
  describe('constructor', () => {
    it('初始时所有参数订阅者数量应为 0', () => {
      for (const param of Object.values(PhysioParameter)) {
        expect(router.getSubscriberCount(param)).toBe(0);
      }
    });
  });

  // ─── subscribe + dispatch ──────────────────────────────────
  describe('subscribe & dispatch', () => {
    it('订阅后 dispatch 应调用回调并传递正确的帧', () => {
      const callback = vi.fn();
      router.subscribe(PhysioParameter.ECG, callback);

      const frame = makeFrame(PhysioParameter.ECG, { timestamp: 1000, channels: { II: 42 } });
      router.dispatch(frame);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(frame);
    });

    it('只应通知所订阅参数类型的回调', () => {
      const ecgCallback = vi.fn();
      const spo2Callback = vi.fn();
      router.subscribe(PhysioParameter.ECG, ecgCallback);
      router.subscribe(PhysioParameter.SpO2, spo2Callback);

      router.dispatch(makeFrame(PhysioParameter.ECG));

      expect(ecgCallback).toHaveBeenCalledTimes(1);
      expect(spo2Callback).not.toHaveBeenCalled();
    });

    it('同一参数多个回调应全部收到通知', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      router.subscribe(PhysioParameter.Respiration, cb1);
      router.subscribe(PhysioParameter.Respiration, cb2);

      router.dispatch(makeFrame(PhysioParameter.Respiration));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // ─── dispatchMany ──────────────────────────────────────────
  describe('dispatchMany', () => {
    it('应分发所有帧到对应参数的回调', () => {
      const ecgCb = vi.fn();
      const spo2Cb = vi.fn();
      router.subscribe(PhysioParameter.ECG, ecgCb);
      router.subscribe(PhysioParameter.SpO2, spo2Cb);

      const frames = [
        makeFrame(PhysioParameter.ECG, { timestamp: 1, channels: { II: 10 } }),
        makeFrame(PhysioParameter.SpO2, { timestamp: 2, channels: { SpO2: 98 } }),
        makeFrame(PhysioParameter.ECG, { timestamp: 3, channels: { II: 20 } }),
      ];
      router.dispatchMany(frames);

      expect(ecgCb).toHaveBeenCalledTimes(2);
      expect(ecgCb).toHaveBeenNthCalledWith(1, frames[0]);
      expect(ecgCb).toHaveBeenNthCalledWith(2, frames[2]);
      expect(spo2Cb).toHaveBeenCalledTimes(1);
      expect(spo2Cb).toHaveBeenCalledWith(frames[1]);
    });

    it('空数组不应报错', () => {
      expect(() => router.dispatchMany([])).not.toThrow();
    });

    it('null/undefined 不应报错', () => {
      expect(() => router.dispatchMany(null as unknown as PhysioFrame[])).not.toThrow();
      expect(() => router.dispatchMany(undefined as unknown as PhysioFrame[])).not.toThrow();
    });
  });

  // ─── 取消订阅 ──────────────────────────────────────────────
  describe('unsubscribe', () => {
    it('取消订阅后不应再收到通知', () => {
      const callback = vi.fn();
      const unsubscribe = router.subscribe(PhysioParameter.ECG, callback);

      router.dispatch(makeFrame(PhysioParameter.ECG));
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      router.dispatch(makeFrame(PhysioParameter.ECG));
      expect(callback).toHaveBeenCalledTimes(1); // 没有增加
    });

    it('重复取消应是幂等的', () => {
      const callback = vi.fn();
      const unsubscribe = router.subscribe(PhysioParameter.ECG, callback);

      unsubscribe();
      unsubscribe(); // 第二次不应抛出

      router.dispatch(makeFrame(PhysioParameter.ECG));
      expect(callback).not.toHaveBeenCalled();
    });

    it('取消后订阅者也应退出订阅', () => {
      const callback = vi.fn();
      const unsubscribe = router.subscribe(PhysioParameter.Temperature, callback);
      expect(router.getSubscriberCount(PhysioParameter.Temperature)).toBe(1);

      unsubscribe();
      expect(router.getSubscriberCount(PhysioParameter.Temperature)).toBe(0);
    });
  });

  // ─── dispatch 无订阅者 ─────────────────────────────────────
  describe('dispatch without subscribers', () => {
    it('dispatch 到无订阅者的参数不应报错', () => {
      const frame = makeFrame(PhysioParameter.EMG);
      expect(() => router.dispatch(frame)).not.toThrow();
    });

    it('getSubscriberCount 对无订阅参数返回 0', () => {
      expect(router.getSubscriberCount(PhysioParameter.EMG)).toBe(0);
    });
  });

  // ─── clear ─────────────────────────────────────────────────
  describe('clear', () => {
    it('clear 后所有回调应被移除', () => {
      const callback = vi.fn();
      router.subscribe(PhysioParameter.ECG, callback);
      router.subscribe(PhysioParameter.SpO2, callback);
      expect(router.getSubscriberCount(PhysioParameter.ECG)).toBe(1);
      expect(router.getSubscriberCount(PhysioParameter.SpO2)).toBe(1);

      router.clear();

      for (const param of Object.values(PhysioParameter)) {
        expect(router.getSubscriberCount(param)).toBe(0);
      }

      router.dispatch(makeFrame(PhysioParameter.ECG));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ─── getSubscriberCount ────────────────────────────────────
  describe('getSubscriberCount', () => {
    it('应准确反映订阅者数量', () => {
      expect(router.getSubscriberCount(PhysioParameter.ECG)).toBe(0);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      router.subscribe(PhysioParameter.ECG, cb1);
      expect(router.getSubscriberCount(PhysioParameter.ECG)).toBe(1);

      router.subscribe(PhysioParameter.ECG, cb2);
      expect(router.getSubscriberCount(PhysioParameter.ECG)).toBe(2);

      // 其他参数不受影响
      expect(router.getSubscriberCount(PhysioParameter.SpO2)).toBe(0);
    });
  });

  // ─── 回调异常隔离 ─────────────────────────────────────────
  describe('callback exception isolation', () => {
    it('一个回调抛出异常不应阻止其他回调执行', () => {
      const goodCallback = vi.fn();
      const badCallback = vi.fn(() => {
        throw new Error('模拟异常');
      });

      router.subscribe(PhysioParameter.ECG, badCallback);
      router.subscribe(PhysioParameter.ECG, goodCallback);

      // 不应抛出
      const frame = makeFrame(PhysioParameter.ECG);
      expect(() => router.dispatch(frame)).not.toThrow();

      expect(goodCallback).toHaveBeenCalledTimes(1);
      expect(goodCallback).toHaveBeenCalledWith(frame);
    });
  });

  // ─── 未知参数类型 ──────────────────────────────────────────
  describe('unknown parameter', () => {
    it('subscribe 未知参数类型应返回空函数且不抛出', () => {
      const callback = vi.fn();
      // 使用一个不在 PhysioParameter 枚举中的值
      const unsub = router.subscribe('UNKNOWN' as PhysioParameter, callback);
      expect(typeof unsub).toBe('function');
      expect(callback).not.toHaveBeenCalled();
    });

    it('getSubscriberCount 对未知参数应返回 0', () => {
      const count = router.getSubscriberCount('UNKNOWN' as PhysioParameter);
      expect(count).toBe(0);
    });

    it('dispatch 使用未知参数不应抛出', () => {
      const frame = makeFrame('UNKNOWN' as PhysioParameter);
      expect(() => router.dispatch(frame)).not.toThrow();
    });
  });

  // ─── getDataRouter 单例 ────────────────────────────────────
  describe('getDataRouter singleton', () => {
    it('多次调用应返回同一实例', () => {
      const instance1 = getDataRouter();
      const instance2 = getDataRouter();
      expect(instance1).toBe(instance2);
    });

    it('单例是 DataRouter 的实例', () => {
      const instance = getDataRouter();
      expect(instance).toBeInstanceOf(DataRouter);
    });
  });
});
