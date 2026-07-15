export type HttpRequestLog = {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export interface StructuredLogger {
  info(event: string, fields: HttpRequestLog): void;
}

const stdoutLogger: StructuredLogger = {
  info(event, fields) {
    if (process.env.NODE_ENV === 'test') return;
    process.stdout.write(
      `${JSON.stringify({ level: 'info', event, ...fields, timestamp: new Date().toISOString() })}\n`,
    );
  },
};

let activeLogger: StructuredLogger = stdoutLogger;

export function configureStructuredLogger(logger: StructuredLogger): void {
  activeLogger = logger;
}

export function resetStructuredLoggerForTest(): void {
  activeLogger = stdoutLogger;
}

export function logHttpRequest(fields: HttpRequestLog): void {
  activeLogger.info('http.request.completed', fields);
}
