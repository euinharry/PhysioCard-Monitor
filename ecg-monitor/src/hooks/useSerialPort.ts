import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type SerialConfig,
  type SerialPortState,
  type SerialConnectionState,
  DEFAULT_SERIAL_CONFIG,
} from '../types/ecg';

// ─── Hook 返回类型 ───────────────────────────────────────────

interface UseSerialPortReturn {
  /** 当前串口状态 */
  state: SerialPortState;
  /** 请求串口并连接 */
  connect: (config?: Partial<SerialConfig>) => Promise<void>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 发送数据 */
  send: (data: ArrayBuffer) => Promise<void>;
  /** 注册数据接收回调，返回取消注册函数 */
  onData: (callback: (data: ArrayBuffer) => void) => () => void;
  /** 注册错误回调，返回取消注册函数 */
  onError: (callback: (error: Error) => void) => () => void;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否可以连接（浏览器支持） */
  isSupported: boolean;
}

// ─── 默认状态 ─────────────────────────────────────────────────

function createInitialState(): SerialPortState {
  return {
    connectionState: 'closed',
    portName: null,
    config: { ...DEFAULT_SERIAL_CONFIG },
    bytesReceived: 0,
    bytesSent: 0,
    lastActivity: 0,
    lastError: null,
  };
}

// ─── Hook 实现 ────────────────────────────────────────────────

export function useSerialPort(): UseSerialPortReturn {
  const [state, setState] = useState<SerialPortState>(createInitialState);

  // Refs for mutable values that don't trigger re-renders
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readLoopRef = useRef<boolean>(false);
  const reconnectRef = useRef<boolean>(false);
  const configRef = useRef<SerialConfig>({ ...DEFAULT_SERIAL_CONFIG });

  // Callback registries
  const dataCallbacksRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set());
  const errorCallbacksRef = useRef<Set<(error: Error) => void>>(new Set());

  // ─── 辅助函数 ──────────────────────────────────────────────

  const updateState = useCallback((patch: Partial<SerialPortState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const setError = useCallback((message: string) => {
    updateState({
      connectionState: 'error' as SerialConnectionState,
      lastError: message,
      lastActivity: Date.now(),
    });
    const err = new Error(message);
    errorCallbacksRef.current.forEach(cb => {
      try { cb(err); } catch { /* 静默 */ }
    });
  }, [updateState]);

  const notifyData = useCallback((data: ArrayBuffer) => {
    dataCallbacksRef.current.forEach(cb => {
      try { cb(data); } catch { /* 静默 */ }
    });
  }, []);

  // ─── 读取循环 ──────────────────────────────────────────────

  const startReadLoop = useCallback(async (port: SerialPort) => {
    if (!port.readable) return;

    readLoopRef.current = true;
    const reader = port.readable.getReader();
    readerRef.current = reader;

    try {
      while (readLoopRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          const buffer = value.buffer.slice(
            value.byteOffset,
            value.byteOffset + value.byteLength,
          );
            updateState({
            bytesReceived: state.bytesReceived + value.byteLength,
            lastActivity: Date.now(),
          });
          notifyData(buffer as ArrayBuffer);
        }
      }
    } catch (err) {
      if (readLoopRef.current) {
        setError(`读取错误: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  }, [updateState, notifyData, setError]);

  const stopReadLoop = useCallback(() => {
    readLoopRef.current = false;
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
  }, []);

  // ─── 重连逻辑 ──────────────────────────────────────────────

  const attemptReconnect = useCallback(async () => {
    if (!reconnectRef.current || !portRef.current) return;

    updateState({ connectionState: 'opening' as SerialConnectionState });

    try {
      const port = portRef.current;
      const serialOptions: SerialOptions = {
        baudRate: configRef.current.baudRate,
        dataBits: configRef.current.dataBits as 7 | 8,
        stopBits: configRef.current.stopBits as 1 | 2,
        parity: configRef.current.parity as 'none' | 'even' | 'odd',
        bufferSize: configRef.current.bufferSize,
        flowControl: configRef.current.flowControl,
      };

      await port.open(serialOptions);
      updateState({
        connectionState: 'open' as SerialConnectionState,
        lastError: null,
      });

      // Restart read loop
      await startReadLoop(port);
    } catch (err) {
      setError(`重连失败: ${err instanceof Error ? err.message : String(err)}`);
      // Retry after delay
      if (reconnectRef.current) {
        setTimeout(attemptReconnect, 2000);
      }
    }
  }, [updateState, setError, startReadLoop]);

  // ─── 断开处理 ──────────────────────────────────────────────

  const handleDisconnect = useCallback(async () => {
    stopReadLoop();

    if (writerRef.current) {
      try { await writerRef.current.close(); } catch { /* 静默 */ }
      writerRef.current = null;
    }

    if (portRef.current) {
      try { await portRef.current.close(); } catch { /* 静默 */ }
      portRef.current = null;
    }

    updateState({
      connectionState: 'closed' as SerialConnectionState,
      portName: null,
    });
  }, [stopReadLoop, updateState]);

  // ─── 公开方法 ──────────────────────────────────────────────

  const connect = useCallback(async (config?: Partial<SerialConfig>) => {
    // Merge config
    const mergedConfig: SerialConfig = { ...DEFAULT_SERIAL_CONFIG, ...config };
    configRef.current = mergedConfig;

    // Check support
    if (!navigator.serial) {
      setError('浏览器不支持 Web Serial API');
      return;
    }

    updateState({
      connectionState: 'opening' as SerialConnectionState,
      config: mergedConfig,
      lastError: null,
    });

    try {
      // Request port from user
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // Open with config
      const serialOptions: SerialOptions = {
        baudRate: mergedConfig.baudRate,
        dataBits: mergedConfig.dataBits as 7 | 8,
        stopBits: mergedConfig.stopBits as 1 | 2,
        parity: mergedConfig.parity as 'none' | 'even' | 'odd',
        bufferSize: mergedConfig.bufferSize,
        flowControl: mergedConfig.flowControl,
      };

      await port.open(serialOptions);

      // Extract port info
      const info = port.getInfo();
      const portName = info.usbVendorId
        ? `USB:${info.usbVendorId.toString(16)}:${info.usbProductId?.toString(16) ?? '?'}`
        : 'Serial';

      updateState({
        connectionState: 'open' as SerialConnectionState,
        portName,
        lastActivity: Date.now(),
        lastError: null,
      });

      // Enable auto-reconnect
      reconnectRef.current = true;

      // Start reading
      await startReadLoop(port);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // User cancelled requestPort is not an error
      if (message.includes('cancelled') || message.includes('No port selected')) {
        updateState({ connectionState: 'closed' as SerialConnectionState });
        return;
      }
      setError(`连接失败: ${message}`);
    }
  }, [updateState, setError, startReadLoop]);

  const disconnect = useCallback(async () => {
    reconnectRef.current = false;
    await handleDisconnect();
  }, [handleDisconnect]);

  const send = useCallback(async (data: ArrayBuffer) => {
    if (!portRef.current || !portRef.current.writable) {
      setError('串口未连接或不可写');
      return;
    }

    let writer = writerRef.current;
    if (!writer) {
      writer = portRef.current.writable.getWriter();
      writerRef.current = writer;
    }

    try {
      await writer.write(new Uint8Array(data));
      updateState({
        bytesSent: state.bytesSent + data.byteLength,
        lastActivity: Date.now(),
      });
    } catch (err) {
      setError(`发送失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [setError, updateState]);

  const onData = useCallback((callback: (data: ArrayBuffer) => void) => {
    dataCallbacksRef.current.add(callback);
    return () => {
      dataCallbacksRef.current.delete(callback);
    };
  }, []);

  const onError = useCallback((callback: (error: Error) => void) => {
    errorCallbacksRef.current.add(callback);
    return () => {
      errorCallbacksRef.current.delete(callback);
    };
  }, []);

  // ─── 监听断开事件 ──────────────────────────────────────────

  useEffect(() => {
    const handlePortDisconnect = () => {
      if (reconnectRef.current) {
        updateState({ connectionState: 'opening' as SerialConnectionState });
        // Attempt reconnect after short delay
        setTimeout(attemptReconnect, 1000);
      } else {
        handleDisconnect();
      }
    };

    // Poll for disconnection (Web Serial doesn't fire events reliably)
    const interval = setInterval(() => {
      if (portRef.current && !portRef.current.connected) {
        handlePortDisconnect();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      reconnectRef.current = false;
      stopReadLoop();
      if (writerRef.current) {
        writerRef.current.close().catch(() => {});
        writerRef.current = null;
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
        portRef.current = null;
      }
    };
  }, [attemptReconnect, handleDisconnect, stopReadLoop, updateState]);

  // ─── 返回值 ────────────────────────────────────────────────

  return {
    state,
    connect,
    disconnect,
    send,
    onData,
    onError,
    isConnected: state.connectionState === 'open',
    isSupported: typeof navigator !== 'undefined' && 'serial' in navigator,
  };
}
