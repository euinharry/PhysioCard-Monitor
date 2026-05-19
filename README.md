# PhysioCard-Monitor

**多参数生理信号监护上位机** — 基于 Web Serial API 的实时多模态生理信号监测系统，支持心电 (ECG)、血氧 (SpO₂)、呼吸 (Resp)、肌电 (EMG)、体温 (Temp) 五种参数的同步采集与可视化。

![监护界面截图](/qa-ecg-page.png)

---

## 📋 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [系统架构](#-系统架构)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [使用说明](#-使用说明)
- [通信协议](#-通信协议)
- [项目结构](#-项目结构)
- [测试](#-测试)

---

## 📖 项目简介

本系统是医疗多参数监护仪的上位机软件，通过 **Web Serial API** 与下位机采集硬件通信，实时接收并显示心电、血氧、呼吸、肌电、体温五类生理参数。前端采用 React 19 + TypeScript 构建，核心心电模块以 60fps 渲染 12 导联波形，内置 **Pan-Tompkins QRS 检测算法** 实时计算心率。

数据流：`采集硬件 → 串口 → 帧解析器 → DataRouter 分发器 → 各参数环形缓冲区 → 视图组件`

---

## ✨ 功能特性

### 多参数监护

| 参数 | 显示内容 | 图标 |
|------|---------|------|
| **心电 (ECG)** | 12 导联 4×3 网格波形、心率 BPM | ❤️ |
| **血氧 (SpO₂)** | 大字 SpO₂%、脉率 PR、容积波波形 | 💧 |
| **呼吸 (Resp)** | 呼吸波形曲线、呼吸频率 RR | 🌬️ |
| **肌电 (EMG)** | 双通道波形、活动强度指示条 | ⚡ |
| **体温 (Temp)** | 大字体温℃、趋势波形、三级颜色预警 | 🌡️ |

### 核心亮点

- **标签页导航** — MenuBar 驱动五参数视图切换，切换不中断串口数据流
- **实时波形** — 60fps 渲染，延迟 < 100ms
- **心率检测** — Pan-Tompkins 算法，30–220 BPM，含自适应阈值与 T 波识别
- **双协议支持** — 二进制帧格式 + ASCII 文本格式，支持 Type-ID 多参数识别
- **数据路由** — DataRouter 发布订阅模式，各参数独立消费队列
- **环形缓冲区** — O(1) 读写，自动覆盖最旧数据，dataVersion 变更检测
- **视图懒加载** — ViewContainer 仅挂载当前激活视图

---

## 🏗️ 系统架构

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  采集硬件      │───▶│  useSerialPort   │───▶│  DataParser   │───▶│  DataRouter      │───▶│  视图组件         │
│  (串口设备)     │    │  Web Serial API  │    │  帧解析/Type-ID│    │  发布订阅分发     │    │  ECG/SpO2/Resp  │
└──────────────┘    └──────────────────┘    └──────────────┘    └──────────┬───────┘    │  EMG/Temp       │
                                                                           │              └─────────────────┘
                                                                           ▼
                                                                    ┌──────────────┐
                                                                    │  usePhysioBuffer │
                                                                    │  多参数环形缓冲区   │
                                                                    │  dataVersion 检测 │
                                                                    └───────┬───────┘
                                                                            │
                                                                    ┌───────▼───────┐
                                                                    │  心率检测       │
                                                                    │  Pan-Tompkins  │
                                                                    └───────────────┘
```

### 组件树

```
App
 └── PhysioMonitor
      ├── Header           — Logo、串口连接、心率 BPM、帧计数
      ├── MenuBar          — ECG / SpO₂ / Resp / EMG / Temp 标签页
      └── ViewContainer    — 懒加载当前激活视图
           ├── ECGView         — 12 导联 ECharts 波形 + DataZoom
           ├── SpO2View        — SpO₂% + 脉率 + 容积波
           ├── RespiratoryView — 呼吸波形 + RR 频率
           ├── EMGView         — 双通道肌电 + 强度条
           └── TemperatureView — 体温数值 + 趋势 + 三级颜色预警
```

---

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | 6.0 |
| UI 框架 | React | 19.2 |
| 构建 | Vite | 6.x |
| 图表 | ECharts + echarts-for-react | 6.0 |
| 样式 | Tailwind CSS v4 | 4.3 |
| 串口 | Web Serial API (W3C) | — |
| 测试 | Vitest + @testing-library | 4.1 |
| 运行时 | Node.js | ≥ 18 |

---

## 🚀 快速开始

```bash
cd ecg-monitor
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

---

## 📖 使用说明

### 连接硬件

1. 点击右上角 **「连接串口」** 按钮
2. 在浏览器弹窗中选择对应串口设备
3. 连接成功后，顶部状态指示灯变绿，各参数视图开始接收数据

### 模拟测试（无硬件时）

可使用串口调试工具发送以下格式的数据：

**ASCII 格式 — 心电：**
```
ECG: I:100, II:200, III:300, aVR:400, aVL:500, aVF:600, V1:700, V2:800, V3:900, V4:1000, V5:1100, V6:1200
```

**ASCII 格式 — 其他参数：**
```
SPO2: SpO2:98, PR:72
RESP: RESP:16
EMG: CH1:50, CH2:30
TEMP: TEMP:36.6
```

**二进制格式：**
```
[0xAA][0x55][TYPE(0x01~0x05)] + 通道数据(小端int16×通道数) + [0x0D][0x0A]
```

### 波形交互

- 鼠标滚轮 — 缩放波形
- 拖拽 — 平移查看历史
- 点击标签 — 切换参数视图

---

## 🔌 通信协议

### Type-ID 映射

| ID | 参数 | 通道数 | 通道名 |
|----|------|--------|--------|
| 0x01 | ECG | 12 | I, II, III, aVR, aVL, aVF, V1–V6 |
| 0x02 | SpO₂ | 2 | SpO₂, PR |
| 0x03 | Resp | 1 | RESP |
| 0x04 | EMG | 2 | CH1, CH2 |
| 0x05 | Temp | 1 | TEMP |

### 二进制帧

```
[0xAA][0x55][TYPE] + N通道×2字节(小端int16) + [0x0D][0x0A]
```

### ASCII 帧

```
TYPE: key1:val1, key2:val2, ...
```

向后兼容：无 Type-ID 时默认 ECG（兼容旧设备）。

---

## 📁 项目结构

```
ecg-monitor/src/
├── components/          # React 组件
│   ├── PhysioMonitor   # 顶层容器
│   ├── Header          # 顶部栏
│   ├── MenuBar         # 标签导航
│   ├── ViewContainer   # 视图路由
│   ├── ECGView / SpO2View / RespiratoryView / EMGView / TemperatureView
│   └── WaveformDisplay # 波形组件（ECGView 内部使用）
├── hooks/
│   ├── useSerialPort   # 串口通信
│   └── usePhysioBuffer # 多参数缓冲管理
├── utils/
│   ├── dataParser      # 帧解析器（单参数 + 多参数）
│   ├── dataRouter      # 发布订阅数据路由
│   ├── heartRateDetector # Pan-Tompkins 算法
│   └── ringBuffer      # 环形缓冲区
├── types/
│   ├── ecg.ts          # ECG 类型
│   └── physio.ts       # 多参数类型系统
└── styles/ + test/     # 样式 + 测试配置
```

---

## 🧪 测试

153 个测试用例，全部通过：

```bash
npm test
```

| 测试文件 | 用例数 | 覆盖内容 |
|---------|--------|----------|
| `physio.test.ts` | 60 | 枚举、标签、颜色、通道配置、帧构造 |
| `dataParser.test.ts` | 26 | 二进制/ASCII 解析、多参数帧、校验 |
| `ringBuffer.test.ts` | 25 | 构造、push/pop/覆盖、迭代、压力 |
| `dataRouter.test.ts` | 20 | 订阅/分发、异常隔离、单例 |
| `usePhysioBuffer.test.ts` | 12 | 多参数缓冲、版本检测、通道读取 |
| `views.test.tsx` | 10 | 各视图渲染、异常状态颜色 |

---

## 📄 许可

本项目为毕业设计作品，仅供学习研究使用。
