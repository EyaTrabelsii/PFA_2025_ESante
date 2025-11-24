// Database
export { connectDB, disconnectDB, getDBStatus, mongoose } from './config/database.js';

// Middleware
export { auth, authenticateToken, adminAuth, authorize, optionalAuth } from './middleware/auth.js';
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler
} from './middleware/errorHandler.js';
export { requestLogger, getRequestInfo } from './middleware/logger.js';

// Utilities
export {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidDate,
  isPastDate,
  isFutureDate,
  isValidObjectId,
  sanitizeInput,
  validateRequiredFields
} from './utils/validation.js';
export {
  successResponse,
  errorResponse,
  paginatedResponse
} from './utils/responseFormatter.js';
export {
  formatDate,
  addDays,
  addHours,
  getDaysDifference,
  isToday,
  getStartOfDay,
  getEndOfDay,
  doTimeSlotsOverlap
} from './utils/dateUtils.js';

// Kafka
export { default as kafkaProducer } from './kafka/producer.js';
export { default as KafkaConsumer } from './kafka/consumer.js';
export { default as TOPICS } from './kafka/topics.js';
export { EVENT_SCHEMAS, createEvent, generateEventId } from './kafka/schemas.js';
export {
  emitUserRegistered,
  emitAppointmentConfirmed,
  emitConsultationCreated,
  emitPrescriptionCreated,
  emitReferralCreated,
  emitMessageSent
} from './kafka/helpers.js';
