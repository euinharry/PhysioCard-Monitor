/** 12导联标识 */
export enum ECGLead {
  I = 'I',
  II = 'II',
  III = 'III',
  aVR = 'aVR',
  aVL = 'aVL',
  aVF = 'aVF',
  V1 = 'V1',
  V2 = 'V2',
  V3 = 'V3',
  V4 = 'V4',
  V5 = 'V5',
  V6 = 'V6',
}

/** 12导联列表（有序） */
export const ECG_LEADS: readonly ECGLead[] = [
  ECGLead.I, ECGLead.II, ECGLead.III,
  ECGLead.aVR, ECGLead.aVL, ECGLead.aVF,
  ECGLead.V1, ECGLead.V2, ECGLead.V3,
  ECGLead.V4, ECGLead.V5, ECGLead.V6,
];

/** 单帧ECG数据 */
export interface ECGData {
  /** 时间戳（ms） */
  timestamp: number;
  /** 12导联采样值（有符号16位整数） */
  leads: Record<ECGLead, number>;
}

/** 串口帧配置 */
export interface FrameConfig {
  /** 帧头标记 */
  header: [number, number];
  /** 帧尾标记 */
  footer: [number, number];
  /** 每个导联的字节数（默认2=16bit） */
  bytesPerSample: number;
  /** 导联数量（默认12） */
  leadCount: number;
}

/** 默认帧配置 */
export const DEFAULT_FRAME_CONFIG: FrameConfig = {
  header: [0xaa, 0x55],
  footer: [0x0d, 0x0a],
  bytesPerSample: 2,
  leadCount: 12,
};

/** 数据点（用于波形渲染） */
export interface DataPoint {
  x: number;
  y: number;
}

// ─── 串口配置 ─────────────────────────────────────────────────

/** 串口通信参数 */
export interface SerialConfig {
  /** 波特率（默认115200） */
  baudRate: 9600 | 19200 | 38400 | 57600 | 115200 | 230400 | 460800 | 921600;
  /** 数据位（默认8） */
  dataBits: 5 | 6 | 7 | 8;
  /** 停止位（默认1） */
  stopBits: 1 | 1.5 | 2;
  /** 校验位（默认none） */
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  /** 读缓冲区大小（字节，默认1024） */
  bufferSize: number;
  /** 流控制（默认none） */
  flowControl: 'none' | 'hardware';
}

/** 默认串口配置 */
export const DEFAULT_SERIAL_CONFIG: SerialConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 1024,
  flowControl: 'none',
};

// ─── 串口状态 ─────────────────────────────────────────────────

/** 串口连接状态 */
export type SerialConnectionState = 'closed' | 'opening' | 'open' | 'closing' | 'error';

/** 串口运行时状态 */
export interface SerialPortState {
  /** 连接状态 */
  connectionState: SerialConnectionState;
  /** 已连接的端口名（如 COM3） */
  portName: string | null;
  /** 当前配置 */
  config: SerialConfig;
  /** 累计接收字节数 */
  bytesReceived: number;
  /** 累计发送字节数 */
  bytesSent: number;
  /** 最后活跃时间戳（ms） */
  lastActivity: number;
  /** 最近错误信息 */
  lastError: string | null;
}

// ─── 波形显示 ─────────────────────────────────────────────────

/** 波形显示配置 */
export interface WaveformDisplayConfig {
  /** 显示时间窗口（秒，默认5） */
  timeWindow: number;
  /** 采样率（Hz，默认250） */
  sampleRate: number;
  /** 波形线条宽度（px，默认1.5） */
  lineWidth: number;
  /** 波形颜色映射（导联→颜色） */
  leadColors: Record<ECGLead, string>;
  /** 背景色 */
  backgroundColor: string;
  /** 网格颜色 */
  gridColor: string;
  /** 网格是否可见 */
  showGrid: boolean;
  /** 波形增益（mm/mV，默认10） */
  gain: number;
  /** 走纸速度（mm/s，默认25） */
  paperSpeed: number;
  /** 各导联可见性 */
  leadVisibility: Record<ECGLead, boolean>;
}

/** 默认波形显示配置 */
export const DEFAULT_WAVEFORM_CONFIG: WaveformDisplayConfig = {
  timeWindow: 5,
  sampleRate: 250,
  lineWidth: 1.5,
  leadColors: {
    [ECGLead.I]: '#00FF00',
    [ECGLead.II]: '#00FF00',
    [ECGLead.III]: '#00FF00',
    [ECGLead.aVR]: '#FFFF00',
    [ECGLead.aVL]: '#FFFF00',
    [ECGLead.aVF]: '#FFFF00',
    [ECGLead.V1]: '#FF6B6B',
    [ECGLead.V2]: '#FF6B6B',
    [ECGLead.V3]: '#FF6B6B',
    [ECGLead.V4]: '#FF6B6B',
    [ECGLead.V5]: '#FF6B6B',
    [ECGLead.V6]: '#FF6B6B',
  },
  backgroundColor: '#1a1a2e',
  gridColor: '#333366',
  showGrid: true,
  gain: 10,
  paperSpeed: 25,
  leadVisibility: {
    [ECGLead.I]: true,
    [ECGLead.II]: true,
    [ECGLead.III]: true,
    [ECGLead.aVR]: true,
    [ECGLead.aVL]: true,
    [ECGLead.aVF]: true,
    [ECGLead.V1]: true,
    [ECGLead.V2]: true,
    [ECGLead.V3]: true,
    [ECGLead.V4]: true,
    [ECGLead.V5]: true,
    [ECGLead.V6]: true,
  },
};

// ─── 环形缓冲区接口 ───────────────────────────────────────────

/** 环形缓冲区泛型接口 */
export interface RingBuffer<T> {
  /** 缓冲区容量 */
  readonly capacity: number;
  /** 当前元素数量 */
  readonly length: number;
  /** 是否已满 */
  readonly isFull: boolean;
  /** 是否为空 */
  readonly isEmpty: boolean;

  /** 添加元素，满时覆盖最旧数据 */
  push(item: T): T | undefined;
  /** 移除并返回最旧元素 */
  pop(): T | undefined;
  /** 查看最旧元素（不移除） */
  peek(): T | undefined;
  /** 查看最新元素（不移除） */
  peekLast(): T | undefined;
  /** 按索引访问（0=最旧） */
  get(index: number): T | undefined;
  /** 清空缓冲区 */
  clear(): void;
  /** 转换为普通数组（最旧→最新） */
  toArray(): T[];
  /** 批量推入 */
  pushMany(items: T[]): T[];
  /** 遍历 */
  forEach(callback: (item: T, index: number) => void): void;
}

// ─── 监控状态 ─────────────────────────────────────────────────

/** ECG监控应用状态 */
export interface ECGMonitorState {
  /** 串口状态 */
  serial: SerialPortState;
  /** 各导联数据缓冲区 */
  buffers: Record<ECGLead, RingBuffer<number>>;
  /** 波形显示配置 */
  displayConfig: WaveformDisplayConfig;
  /** 是否正在记录 */
  isRecording: boolean;
  /** 当前选中的导联（用于单导联放大视图） */
  selectedLead: ECGLead | null;
  /** 心率（BPM，由算法计算） */
  heartRate: number | null;
  /** 数据帧计数 */
  frameCount: number;
  /** 应用启动时间戳 */
  startTime: number;
}
