export type HttpRequestLog = {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export type ApplicationErrorLog = {
  requestId: string;
  route: string;
  category: string;
  errorCode: string;
};

export interface StructuredLogger {
  info(event: string, fields: HttpRequestLog | ApplicationErrorLog): void;
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

export function logApplicationError(fields: ApplicationErrorLog): void {
  activeLogger.info('application.error', fields);
}
