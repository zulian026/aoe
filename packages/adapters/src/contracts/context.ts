export interface AdapterContext {
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  metadata?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export type DetectionConfidence = 'none' | 'low' | 'medium' | 'high' | 'exact';

export interface AdapterDetectionResult {
  detected: boolean;
  confidence: DetectionConfidence;
  agentName?: string;
  version?: string;
  evidence?: string[];
  details?: Record<string, unknown>;
}
