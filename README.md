# PhysioCard-Monitor

**实时多模态生理信号监测系统** — 基于 Web 的 12 导联心电（ECG）监护仪上位机软件。

Real-time multi-modal physiological parameter monitoring system — a web-based 12-lead ECG monitor client.

![ECG Monitor](/qa-ecg-page.png)

---

## 📋 目录 | Table of Contents

- [项目简介 | Overview](#-项目简介--overview)
- [功能特性 | Features](#-功能特性--features)
- [系统架构 | Architecture](#-系统架构--architecture)
- [技术栈 | Tech Stack](#-技术栈--tech-stack)
- [快速开始 | Quick Start](#-快速开始--quick-start)
- [项目结构 | Project Structure](#-项目结构--project-structure)
- [通信协议 | Communication Protocol](#-通信协议--communication-protocol)
- [核心算法 | Core Algorithm](#-核心算法--core-algorithm)
- [开发指南 | Development](#-开发指南--development)
- [测试 | Testing](#-测试--testing)
- [部署 | Deployment](#-部署--deployment)
- [许可 | License](#-许可--license)

---

## 📖 项目简介 | Overview

**PhysioCard-Monitor** 是一个基于 Web 技术的实时心电监护系统，作为医疗设备的上位机软件运行。它通过 **Web Serial API** 连接 ECG 采集硬件设备，以 60fps 的帧率实时渲染 12 导联心电波形，并内置 **Pan-Tompkins QRS 检测算法** 实时计算心率（BPM）。

PhysioCard-Monitor is a web-based real-time ECG monitoring system designed to run as a host computer client for medical devices. It connects to ECG acquisition hardware via the **Web Serial API**, renders 12-lead ECG waveforms at 60fps, and features a built-in **Pan-Tompkins QRS detection algorithm** for real-time heart rate (BPM) computation.

### 适用场景 | Use Cases

- 🏥 **临床监护** — 床边心电图实时监测
- 🔬 **医学研究** — ECG 数据采集与分析
- 🎓 **教学演示** — 心电信号处理算法可视化
- ⚙️ **设备调试** — 心电图机通信协议验证

---

## ✨ 功能特性 | Features

### 核心功能

| 特性 | 说明 |
|------|------|
| **12 导联同步显示** | 标准 4×3 网格布局（I/II/III, aVR/aVL/aVF, V1-V6） |
| **实时波形滚动** | 60fps 流畅渲染，延迟 < 100ms |
| **心率实时计算** | Pan-Tompkins 算法，30-220 BPM 检测范围 |
| **串口通信** | Web Serial API，支持自动重连 |
| **双协议支持** | 二进制帧格式 + ASCII 文本格式 |
| **响应式布局** | 桌面 / 平板 / 移动端自适应 |
| **波形交互** | 鼠标滚轮缩放、拖拽平移、跟随模式 |
| **动态 Y 轴** | 基于百分位数的自适应幅度范围 |

### 技术亮点

- 🔬 **Pan-Tompkins 算法**：完整实现 1985 年经典 QRS 检测算法，含带通滤波、微分、平方、积分、自适应阈值、T 波识别、搜索回退
- ⚡ **渲染优化**：`requestAnimationFrame` 节流到 60Hz，`dataVersion` 变更检测避免无效渲染，ECharts `lazyUpdate` 批量合并
- 📊 **ECG 纸风格**：深色主题 + 导联颜色分组（肢体导联绿色、加压导联琥珀色、胸前导联红色）
- 🧵 **零 GC 数据管理**：12 个独立环形缓冲区，O(1) 读写，满时自动覆盖最旧数据

---

## 🏗️ 系统架构 | Architecture

### 数据流 | Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐     ┌──────────────────┐
│  ECG 采集硬件  │────▶│  UseSerialPort   │────▶│  UseECGData    │────▶│  WaveformDisplay │
│  (串口设备)     │     │  Web Serial API  │     │  环形缓冲区      │     │  ECharts 渲染     │
└──────────────┘     └──────────────────┘     └───────────────┘     └──────────────────┘
                           │                        │
                           ▼                        ▼
                    parseASCIIData /          detectHeartRate
                    parseSerialData          Pan-Tompkins算法
```

### 组件树 | Component Tree

```
App
 └── ECGMonitor
      ├── Header (内联)
      │    ├── Logo + 标题
      │    ├── 串口连接按钮
      │    ├── 状态指示器
      │    └── 心率显示 (BPM)
      └── WaveformDisplay (ECharts 4×3)
           ├── 导联标识 (I, II, III, ...)
           ├── 12 条波形 Series
           ├── 网格背景
           └── DataZoom (缩放/平移)

备用组件 (已实现但未在主界面激活):
      ├── ControlPanel (串口控制 + 录制)
      ├── StatusBar (全功能状态栏)
      └── LeadPanel (导联选择/排序/可见性)
```

---

## 🛠️ 技术栈 | Tech Stack

| 层级 | 技术 | 版本 |
|------|------|------|
| **语言** | TypeScript | 6.0 |
| **UI 框架** | React | 19.2 |
| **构建工具** | Vite | 6.x |
| **图表引擎** | ECharts + echarts-for-react | 6.0 |
| **样式** | Tailwind CSS (v4, CSS-first) | 4.3 |
| **串口** | Web Serial API (W3C 标准) | — |
| **测试** | Vitest + @testing-library | 4.1 |
| **Node.js** | ≥ 18 (推荐 20+) | — |

---

## 🚀 快速开始 | Quick Start

### 前置条件 | Prerequisites

- Node.js ≥ 18（推荐 20+）
- 现代浏览器（Chrome / Edge ≥ 89，支持 Web Serial API）
- 可选：ECG 模拟硬件或串口调试工具

### 安装与运行 | Install & Run

```bash
# 进入项目目录
cd ecg-monitor

# 安装依赖
npm install

# 启动开发服务器 (默认 http://localhost:5173)
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 使用说明 | Usage

1. 打开浏览器访问 `http://localhost:5173`
2. 点击右上角 **「连接串口」** 按钮
3. 在弹出的对话框中选择 ECG 设备串口
4. 连接成功后，波形将实时显示，心率自动计算
5. 鼠标滚轮缩放波形，拖拽平移查看历史数据

---

## 📁 项目结构 | Project Structure

```
PhysioCard-Monitor/
├── ecg-monitor/                    # 主项目目录
│   ├── src/
│   │   ├── components/             # React 组件
│   │   │   ├── ECGMonitor.tsx      #   主布局组件（核心协调器）
│   │   │   ├── WaveformDisplay.tsx #   12导联波形显示（ECharts）
│   │   │   ├── ControlPanel.tsx    #   控制面板（备用）
│   │   │   ├── StatusBar.tsx       #   状态栏（备用）
│   │   │   └── LeadPanel.tsx       #   导联面板（备用）
│   │   ├── hooks/
│   │   │   ├── useSerialPort.ts    #   串口通信 Hook
│   │   │   └── useECGData.ts       #   ECG 数据管理 Hook
│   │   ├── utils/
│   │   │   ├── dataParser.ts       #   串口数据解析器
│   │   │   ├── heartRateDetector.ts #   Pan-Tompkins 算法
│   │   │   ├── ringBuffer.ts       #   环形缓冲区
│   │   │   └── __tests__/          #   单元测试
│   │   ├── types/
│   │   │   └── ecg.ts              #   类型定义与常量
│   │   ├── styles/
│   │   │   └── responsive.css      #   响应式布局样式
│   │   ├── test/
│   │   │   └── setup.ts            #   测试初始化
│   │   ├── App.tsx                 #   根组件
│   │   ├── main.tsx                #   入口文件
│   │   └── index.css               #   全局样式 + Tailwind
│   ├── index.html                  #   HTML 模板
│   ├── package.json                #   依赖配置
│   ├── vite.config.ts              #   Vite + Vitest 配置
│   └── tsconfig*.json              #   TypeScript 配置
├── qa-ecg-page.png                 #   截图
└── README.md                       #   项目文档
```

---

## 🔌 通信协议 | Communication Protocol

### 二进制帧格式 (Binary Frame)

默认配置 `DEFAULT_FRAME_CONFIG`：

```
┌─────────┬─────────────────────────────────┬─────────┐
│  帧头    │           数据区                 │  帧尾    │
│ [0xAA,  │   12导联 × 2字节(小端有符号16位)  │ [0x0D,  │
│  0x55]  │   I II III aVR aVL aVF V1...V6  │  0x0A]  │
├─────────┼─────────────────────────────────┼─────────┤
│  2字节   │           24字节                 │  2字节   │
└─────────┴─────────────────────────────────┴─────────┘
```

- **单帧长度**: 28 字节
- **数据编码**: 小端序有符号 16 位整数 (int16)
- **导联顺序**: I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6

### ASCII 文本格式 (ASCII Frame)

```
I:100, II:200, III:300, aVR:400, aVL:500, aVF:600, V1:700, V2:800, V3:900, V4:1000, V5:1100, V6:1200\r\n
```

- 每行 12 个导联键值对，以 `, ` 分隔
- 行尾 `\r\n` 换行

### 自定义配置

`FrameConfig` 支持自定义帧头、帧尾、导联数、采样宽度：

```typescript
const customCfg: FrameConfig = {
  header: [0xab, 0xcd],
  footer: [0xef, 0x01],
  bytesPerSample: 2,
  leadCount: 4,   // 支持少于12导联
};
```

---

## 🧬 核心算法 | Core Algorithm

### Pan-Tompkins QRS 检测算法

完整实现了 Pan & Tompkins (1985) 经典算法，用于 ECG R 波检测和心率计算。

**信号处理流水线：**

```
原始 ECG → 带通滤波(5-15Hz) → 五窗微分 → 平方放大 → 滑动积分(150ms) → 自适应阈值检测
```

| 阶段 | 说明 |
|------|------|
| **带通滤波** | 级联二阶低通 + 高通 IIR 滤波器，通带约 5-15 Hz |
| **微分** | 五点差分近似，增强 QRS 陡峭斜率 |
| **平方** | 非线性放大 QRS 成分，抑制 T 波 |
| **滑动积分** | 150ms 窗口移动平均，平滑信号 |
| **自适应阈值** | SPKI/NPKI 双阈值 + 搜索回退 + T 波识别 |

**算法特性：**
- 心率范围：30 - 220 BPM
- 不应期：200ms（防双峰误检）
- 搜索回退：1.66 倍平均 RR 间隔
- T 波识别：斜率比较 + RR 间隔分析

> **参考文献**: J. Pan and W. J. Tompkins, "A Real-Time QRS Detection Algorithm," *IEEE Trans. Biomed. Eng.*, vol. BME-32, no. 3, pp. 230-236, 1985.

---

## 👨‍💻 开发指南 | Development

### 可用脚本

```bash
npm run dev          # 启动开发服务器 (localhost:5173)
npm run build        # TypeScript 检查 + Vite 构建
npm run preview      # 预览生产构建
npm run test         # 运行全部测试
npm run test:watch   # 监听模式运行测试
npm run test:coverage # 测试 + 覆盖率报告
npm run lint         # ESLint 代码检查
```

### 启用额外组件

当前 `ControlPanel`、`StatusBar`、`LeadPanel` 已实现但未在主界面激活。如需启用，在 `ECGMonitor.tsx` 中引入对应组件即可。

---

## 🧪 测试 | Testing

测试框架使用 **Vitest**，当前单元测试覆盖：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `ringBuffer.test.ts` (281行) | 构造、push/pop、覆盖、迭代、压力测试 |
| `dataParser.test.ts` (344行) | 帧解析、导联分离、归一化、校验、自定义配置 |

```bash
# 运行全部测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

---

## 📦 部署 | Deployment

### 构建产物

```bash
npm run build
```

构建产物输出到 `ecg-monitor/dist/`，可直接部署到任何静态文件服务器。

### Docker（参考）

```dockerfile
FROM nginx:alpine
COPY ecg-monitor/dist /usr/share/nginx/html
EXPOSE 80
```

### 浏览器兼容性

| 浏览器 | 版本要求 | Web Serial API 支持 |
|--------|----------|-------------------|
| Chrome | ≥ 89 | ✅ 完全支持 |
| Edge   | ≥ 89 | ✅ 完全支持 |
| Firefox| — | ❌ 不支持（需回退方案） |
| Safari | — | ❌ 不支持 |

---

## 📄 许可 | License

本项目仅供学习和研究使用。用于临床前请咨询专业医疗设备认证要求。

---

**PhysioCard-Monitor** — Real-time ECG Monitoring for the Web.
