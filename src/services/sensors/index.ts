/**
 * Sensor Data Service Stub
 * 
 * This module will be implemented when sensor integration is added.
 * It provides interfaces and placeholder functions for:
 * - Ingesting data from wearable sensors
 * - Processing real-time sensor streams
 * - Storing and retrieving session metrics
 */

export interface SensorDevice {
  deviceId: string;
  deviceType: "heart_rate" | "motion" | "gps" | "accelerometer" | "custom";
  userId: string;
  name: string;
  firmware?: string;
  lastSeen?: Date;
}

export interface SensorReading {
  deviceId: string;
  timestamp: Date;
  data: Record<string, number | string | boolean>;
}

export interface SessionMetrics {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  metrics: {
    heartRate?: {
      average: number;
      max: number;
      min: number;
      zones: number[];
    };
    motion?: {
      cadence: number;
      stride: number;
      balance: number;
    };
    gps?: {
      distance: number;
      elevationGain: number;
      route: [number, number][];
    };
  };
}

export interface SensorDataService {
  /**
   * Register a new sensor device for a user
   */
  registerDevice(device: Omit<SensorDevice, "lastSeen">): Promise<SensorDevice>;
  
  /**
   * Ingest a batch of sensor readings
   */
  ingestData(deviceId: string, readings: SensorReading[]): Promise<void>;
  
  /**
   * Stream real-time sensor data (WebSocket or SSE)
   */
  subscribeToDevice(deviceId: string, callback: (reading: SensorReading) => void): () => void;
  
  /**
   * Get aggregated metrics for a session
   */
  getSessionMetrics(sessionId: string): Promise<SessionMetrics>;
  
  /**
   * Get historical metrics for a user
   */
  getUserMetricsHistory(userId: string, startDate: Date, endDate: Date): Promise<SessionMetrics[]>;
}

// Placeholder implementation - to be replaced with actual sensor integration
export const sensorDataService: SensorDataService = {
  async registerDevice(device): Promise<SensorDevice> {
    console.log("Sensor service not yet implemented", device);
    throw new Error("Sensor integration coming soon");
  },
  
  async ingestData(deviceId, readings): Promise<void> {
    console.log("Sensor data ingestion not yet implemented", { deviceId, readings });
    throw new Error("Sensor integration coming soon");
  },
  
  subscribeToDevice(deviceId, callback): () => void {
    console.log("Sensor streaming not yet implemented", { deviceId, callback });
    throw new Error("Sensor integration coming soon");
  },
  
  async getSessionMetrics(sessionId): Promise<SessionMetrics> {
    console.log("Session metrics not yet implemented", sessionId);
    throw new Error("Sensor integration coming soon");
  },
  
  async getUserMetricsHistory(userId, startDate, endDate): Promise<SessionMetrics[]> {
    console.log("Metrics history not yet implemented", { userId, startDate, endDate });
    throw new Error("Sensor integration coming soon");
  },
};
