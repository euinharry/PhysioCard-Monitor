/**
 * 数据路由层 - 按 PhysioParameter 类型分发串口数据到对应缓冲区
 * 位于数据流水线第二层：Serial Port → Data Parser → DataRouter → Per-Parameter Buffers → Views
 */

import { PhysioParameter, type PhysioFrame } from '../types/physio';

/**
 * DataRouter 类 - 数据路由引擎
 * 将解析后的 PhysioFrame 分发到对应参数的消费者队列
 */
export class DataRouter {
  /** 每个参数对应的回调函数集合 */
  private subscribers: Map<PhysioParameter, Set<(frame: PhysioFrame) => void>>;

  constructor() {
    this.subscribers = new Map();
    // 初始化所有参数类型的订阅集合
    for (const param of Object.values(PhysioParameter)) {
      this.subscribers.set(param, new Set());
    }
  }

  /**
   * 分发单个数据帧到对应参数的消费者队列
   * @param frame 生理参数数据帧
   */
  dispatch(frame: PhysioFrame): void {
    const callbacks = this.subscribers.get(frame.parameter);
    if (!callbacks || callbacks.size === 0) {
      return;
    }

    // 按注册顺序执行所有回调，每个回调包装 try-catch
    for (const callback of callbacks) {
      try {
        callback(frame);
      } catch (error) {
        console.warn(
          `[DataRouter] 参数 ${frame.parameter} 的回调执行异常:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * 批量分发多个数据帧
   * @param frames 生理参数数据帧数组
   */
  dispatchMany(frames: PhysioFrame[]): void {
    if (!frames || frames.length === 0) {
      return;
    }

    for (const frame of frames) {
      this.dispatch(frame);
    }
  }

  /**
   * 订阅某个参数的数据
   * @param parameter 生理参数类型
   * @param callback 数据帧回调函数
   * @returns 取消订阅函数（调用后移除该回调）
   */
  subscribe(parameter: PhysioParameter, callback: (frame: PhysioFrame) => void): () => void {
    const callbacks = this.subscribers.get(parameter);
    if (!callbacks) {
      // 未知参数类型 - 静默跳过
      console.warn(`[DataRouter] 未知参数类型: ${parameter}`);
      return () => {};
    }

    callbacks.add(callback);

    // 返回取消订阅函数（闭包）
    return () => {
      callbacks.delete(callback);
    };
  }

  /**
   * 获取指定参数的订阅者数量
   * @param parameter 生理参数类型
   * @returns 订阅者数量
   */
  getSubscriberCount(parameter: PhysioParameter): number {
    const callbacks = this.subscribers.get(parameter);
    return callbacks ? callbacks.size : 0;
  }

  /**
   * 清空所有订阅
   */
  clear(): void {
    for (const callbacks of this.subscribers.values()) {
      callbacks.clear();
    }
  }
}

/** 单例实例（延迟初始化） */
let routerInstance: DataRouter | null = null;

/**
 * 获取 DataRouter 单例
 * @returns DataRouter 实例
 */
export function getDataRouter(): DataRouter {
  if (!routerInstance) {
    routerInstance = new DataRouter();
  }
  return routerInstance;
}