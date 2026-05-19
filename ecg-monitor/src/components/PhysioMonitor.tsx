import { useState, useCallback, useEffect, useRef } from 'react';
import { PhysioParameter } from '../types/physio';
import { useSerialPort } from '../hooks/useSerialPort';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';
import { parseMultiParamASCIIData } from '../utils/dataParser';
import { getDataRouter } from '../utils/dataRouter';
import Header from './Header';
import MenuBar from './MenuBar';
import ViewContainer from './ViewContainer';
import ECGView from './ECGView';
import SpO2View from './SpO2View';
import RespiratoryView from './RespiratoryView';
import EMGView from './EMGView';
import TemperatureView from './TemperatureView';
import '../styles/responsive.css';

export default function PhysioMonitor() {
  const [activeTab, setActiveTab] = useState<PhysioParameter>(PhysioParameter.ECG);

  const {
    state: serialState,
    connect: serialConnect,
    disconnect: serialDisconnect,
    onData: serialOnData,
    onError: serialOnError,
    isConnected: isSerialConnected,
    isSupported: isSerialSupported,
  } = useSerialPort();

  const physioData = usePhysioBuffer(10 * 250, 250);

  const lineBufferRef = useRef('');
  const decoderRef = useRef(new TextDecoder());

  useEffect(() => {
    if (!isSerialConnected) {
      lineBufferRef.current = '';
      return;
    }

    const decoder = decoderRef.current;
    const unsubscribe = serialOnData((data: ArrayBuffer) => {
      const text = decoder.decode(data, { stream: true });
      lineBufferRef.current += text;

      const lastNewline = lineBufferRef.current.lastIndexOf('\n');
      if (lastNewline === -1) return;

      const completePart = lineBufferRef.current.substring(0, lastNewline);
      lineBufferRef.current = lineBufferRef.current.substring(lastNewline + 1);

      const parsed = parseMultiParamASCIIData(completePart);
      if (parsed.length > 0) {
        const router = getDataRouter();
        router.dispatchMany(parsed);
      }
    });

    return unsubscribe;
  }, [isSerialConnected, serialOnData]);

  useEffect(() => {
    const unsubscribe = serialOnError((error: Error) => {
      console.error('[PhysioMonitor] Serial error:', error.message);
    });
    return unsubscribe;
  }, [serialOnError]);

  const handleConnect = useCallback(async () => {
    try {
      await serialConnect();
    } catch (err) {
      console.error('[PhysioMonitor] Connect failed:', err);
    }
  }, [serialConnect]);

  const handleDisconnect = useCallback(async () => {
    try {
      await serialDisconnect();
      physioData.clearData();
    } catch (err) {
      console.error('[PhysioMonitor] Disconnect failed:', err);
    }
  }, [serialDisconnect, physioData]);

  const views: Record<PhysioParameter, React.ReactNode> = {
    [PhysioParameter.ECG]: (
      <ECGView physioData={physioData} isConnected={isSerialConnected} />
    ),
    [PhysioParameter.SpO2]: (
      <SpO2View physioData={physioData} isConnected={isSerialConnected} />
    ),
    [PhysioParameter.Respiration]: (
      <RespiratoryView physioData={physioData} isConnected={isSerialConnected} />
    ),
    [PhysioParameter.EMG]: (
      <EMGView physioData={physioData} isConnected={isSerialConnected} />
    ),
    [PhysioParameter.Temperature]: (
      <TemperatureView physioData={physioData} isConnected={isSerialConnected} />
    ),
  };

  return (
    <div className="ecg-monitor">
      <Header
        title="PhysioCard Monitor"
        connectionState={serialState.connectionState}
        portName={serialState.portName}
        isSerialSupported={isSerialSupported}
        heartRate={physioData.getHeartRate()}
        frameCount={physioData.getFrameCount()}
        isRecording={false}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <MenuBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ViewContainer activeTab={activeTab} views={views} />
    </div>
  );
}

PhysioMonitor.displayName = 'PhysioMonitor';
