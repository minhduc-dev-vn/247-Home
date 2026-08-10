export type HttpRequestLog = {
  requestId: string;
  clientRequestId?: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export type ApplicationErrorLog = {
  requestId: string;
  clientRequestId?: string;
  route: string;
  category: string;
  errorCode: string;
  errorMessage?: string;
  stack?: string;
};

export function describeError(
  error: unknown,
): Pick<ApplicationErrorLog, 'errorCode' | 'errorMessage' | 'stack'> {
  if (error instanceof Error)
    return {
      errorCode: error.name || 'UNEXPECTED_ERROR',
      errorMessage: error.message,
      stack: error.stack,
    };
  return {
    errorCode: 'UNKNOWN_ERROR',
    errorMessage: 'Non-error value thrown.',
  };
}

export type LogLevel = 'info' | 'warn' | 'error';

export type StructuredLogFields = HttpRequestLog | ApplicationErrorLog;

export interface StructuredLogger {
  info(event: string, fields: StructuredLogFields): void;
  warn(event: string, fields: StructuredLogFields): void;
  error(event: string, fields: StructuredLogFields): void;
}

function writeStdout(
  level: LogLevel,
  event: string,
  fields: StructuredLogFields,
): void {
  if (process.env.NODE_ENV === 'test') return;
  process.stdout.write(
    `${JSON.stringify({ level, event, ...fields, timestamp: new Date().toISOString() })}\n`,
  );
}

const stdoutLogger: StructuredLogger = {
  info: (event, fields) => writeStdout('info', event, fields),
  warn: (event, fields) => writeStdout('warn', event, fields),
  error: (event, fields) => writeStdout('error', event, fields),
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
  activeLogger.error('application.error', fields);
}
