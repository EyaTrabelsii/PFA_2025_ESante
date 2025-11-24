import express from 'express';
import {
  setAvailability,
  getDoctorAvailability,
  viewDoctorAvailability,
  requestAppointment,
  getAppointmentRequests,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  getAppointmentDetails,
  getPatientAppointments,
  getDoctorAppointments,
  completeAppointment,
  referralBooking,
  getAppointmentStatistics
} from '../controllers/appointmentController.js';
import { auth, authorize } from '../../../../shared/index.js';
import {
  validateSetAvailability,
  validateRequestAppointment,
  validateConfirmAppointment,
  validateRejectAppointment,
  validateCancelAppointment,
  validateReferralBooking
} from '../validators/appointmentValidator.js';

const router = express.Router();

// ============================
// DOCTOR ROUTES
// ============================

// Doctor: Set availability
router.post(
  '/doctor/availability',
  auth,
  authorize('doctor'),
  validateSetAvailability,
  setAvailability
);

// Doctor: Get my availability
router.get(
  '/doctor/availability',
  auth,
  authorize('doctor'),
  getDoctorAvailability
);

// Doctor: Get appointment requests
router.get(
  '/doctor/requests',
  auth,
  authorize('doctor'),
  getAppointmentRequests
);

// Doctor: Confirm appointment
router.put(
  '/:appointmentId/confirm',
  auth,
  authorize('doctor'),
  validateConfirmAppointment,
  confirmAppointment
);

// Doctor: Reject appointment
router.put(
  '/:appointmentId/reject',
  auth,
  authorize('doctor'),
  validateRejectAppointment,
  rejectAppointment
);

// Doctor: Complete appointment
router.put(
  '/:appointmentId/complete',
  auth,
  authorize('doctor'),
  completeAppointment
);

// Doctor: Get my appointments
router.get(
  '/doctor/my-appointments',
  auth,
  authorize('doctor'),
  getDoctorAppointments
);

// Doctor: Get appointment statistics
router.get(
  '/doctor/statistics',
  auth,
  authorize('doctor'),
  getAppointmentStatistics
);

// Doctor: Book referral appointment
router.post(
  '/referral-booking',
  auth,
  authorize('doctor'),
  validateReferralBooking,
  referralBooking
);

// ============================
// PATIENT ROUTES
// ============================

// Patient: View doctor availability (public)
router.get(
  '/doctors/:doctorId/availability',
  auth,
  authorize('patient'),
  viewDoctorAvailability
);

// Patient: Request appointment
router.post(
  '/request',
  auth,
  authorize('patient'),
  validateRequestAppointment,
  requestAppointment
);

// Patient: Cancel appointment
router.put(
  '/:appointmentId/cancel',
  auth,
  authorize('patient'),
  validateCancelAppointment,
  cancelAppointment
);

// Patient: Get my appointments
router.get(
  '/patient/my-appointments',
  auth,
  authorize('patient'),
  getPatientAppointments
);

// ============================
// SHARED ROUTES
// ============================

// Get appointment details (both patient & doctor)
router.get(
  '/:appointmentId',
  auth,
  getAppointmentDetails
);

export default router;
