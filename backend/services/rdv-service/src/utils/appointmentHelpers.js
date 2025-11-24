import TimeSlot from '../models/TimeSlot.js';
import Appointment from '../models/Appointment.js';
import axios from 'axios';

/**
 * Fetch doctor profile from user service
 */
export const fetchDoctorProfile = async (doctorId) => {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/v1/users/doctors/${doctorId}`
    );
    return response.data.doctor;
  } catch (error) {
    throw new Error('Doctor not found or inactive');
  }
};

/**
 * Check if a time slot is available
 */
export const checkSlotAvailability = async (doctorId, date, time) => {
  const timeSlot = await TimeSlot.findOne({
    doctorId,
    date: {
      $gte: new Date(date).setHours(0, 0, 0, 0),
      $lt: new Date(date).setHours(23, 59, 59, 999)
    }
  });

  if (!timeSlot || !timeSlot.isAvailable) {
    return false;
  }

  return timeSlot.isSlotAvailable(time);
};

/**
 * Book a time slot
 */
export const bookTimeSlot = async (doctorId, date, time, appointmentId) => {
  const timeSlot = await TimeSlot.findOne({
    doctorId,
    date: {
      $gte: new Date(date).setHours(0, 0, 0, 0),
      $lt: new Date(date).setHours(23, 59, 59, 999)
    }
  });

  if (!timeSlot) {
    throw new Error('Time slot not found');
  }

  await timeSlot.bookSlot(time, appointmentId);
  return timeSlot;
};

/**
 * Free a time slot
 */
export const freeTimeSlot = async (doctorId, date, time) => {
  const timeSlot = await TimeSlot.findOne({
    doctorId,
    date: {
      $gte: new Date(date).setHours(0, 0, 0, 0),
      $lt: new Date(date).setHours(23, 59, 59, 999)
    }
  });

  if (timeSlot) {
    await timeSlot.freeSlot(time);
  }
};

/**
 * Check for appointment conflicts
 */
export const checkAppointmentConflict = async (patientId, doctorId, date, time) => {
  const existingAppointment = await Appointment.findOne({
    patientId,
    doctorId,
    appointmentDate: {
      $gte: new Date(date).setHours(0, 0, 0, 0),
      $lt: new Date(date).setHours(23, 59, 59, 999)
    },
    appointmentTime: time,
    status: { $in: ['pending', 'confirmed'] }
  });

  return !!existingAppointment;
};

/**
 * Normalize date to start of day
 */
export const normalizeDateToStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Normalize date to end of day
 */
export const normalizeDateToEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Check if appointment can be cancelled (at least 2 hours before)
 */
export const canCancelAppointment = (appointmentDate, appointmentTime) => {
  const appointmentDateTime = new Date(appointmentDate);
  const [hours, minutes] = appointmentTime.split(':');
  appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  const now = new Date();
  const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

  return hoursUntilAppointment >= 2;
};

export default {
  fetchDoctorProfile,
  checkSlotAvailability,
  bookTimeSlot,
  freeTimeSlot,
  checkAppointmentConflict,
  normalizeDateToStartOfDay,
  normalizeDateToEndOfDay,
  canCancelAppointment
};
