import Appointment from '../models/Appointment.js';
import TimeSlot from '../models/TimeSlot.js';
import { kafkaProducer, TOPICS, createEvent } from '../../../../shared/index.js';
import {
  fetchDoctorProfile,
  checkSlotAvailability,
  bookTimeSlot,
  freeTimeSlot,
  checkAppointmentConflict,
  normalizeDateToStartOfDay,
  normalizeDateToEndOfDay
} from '../utils/appointmentHelpers.js';

/**
 * Doctor: Set availability
 * POST /api/v1/appointments/doctor/availability
 */
export const setAvailability = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { date, slots, isAvailable, specialNotes } = req.body;

    const normalizedDate = normalizeDateToStartOfDay(date);

    // Check if availability already exists
    let timeSlot = await TimeSlot.findOne({
      doctorId,
      date: normalizedDate
    });

    if (timeSlot) {
      // Update existing
      timeSlot.slots = slots.map(s => ({
        time: s.time,
        isBooked: false,
        appointmentId: null
      }));
      timeSlot.isAvailable = isAvailable;
      timeSlot.specialNotes = specialNotes;
    } else {
      // Create new
      timeSlot = await TimeSlot.create({
        doctorId,
        date: normalizedDate,
        slots: slots.map(s => ({
          time: s.time,
          isBooked: false
        })),
        isAvailable,
        specialNotes
      });
    }

    await timeSlot.save();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.AVAILABILITY_SET,
      createEvent('doctor.availability_set', {
        doctorId: doctorId.toString(),
        date: normalizedDate,
        slotsCount: slots.length
      })
    );

    res.status(200).json({
      message: 'Availability set successfully',
      timeSlot
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Get my availability
 * GET /api/v1/appointments/doctor/availability
 */
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { startDate, endDate } = req.query;

    const query = { doctorId };

    if (startDate && endDate) {
      query.date = {
        $gte: normalizeDateToStartOfDay(startDate),
        $lte: normalizeDateToEndOfDay(endDate)
      };
    }

    const timeSlots = await TimeSlot.find(query).sort({ date: 1 });

    res.status(200).json({
      timeSlots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient: View doctor availability
 * GET /api/v1/appointments/doctors/:doctorId/availability
 */
export const viewDoctorAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { date, startDate, endDate } = req.query;

    const query = { doctorId, isAvailable: true };

    if (date) {
      query.date = {
        $gte: normalizeDateToStartOfDay(date),
        $lte: normalizeDateToEndOfDay(date)
      };
    } else if (startDate && endDate) {
      query.date = {
        $gte: normalizeDateToStartOfDay(startDate),
        $lte: normalizeDateToEndOfDay(endDate)
      };
    }

    const timeSlots = await TimeSlot.find(query).sort({ date: 1 });

    // Filter out booked slots
    const availableSlots = timeSlots.map(ts => ({
      date: ts.date,
      availableSlots: ts.slots.filter(slot => !slot.isBooked).map(slot => ({
        time: slot.time
      }))
    }));

    res.status(200).json({
      data: availableSlots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient: Request appointment
 * POST /api/v1/appointments/request
 */
export const requestAppointment = async (req, res, next) => {
  try {
    const { id: patientId } = req.user;
    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;

    // Verify doctor exists and is active
    const doctor = await fetchDoctorProfile(doctorId);

    // Check for conflicts
    const hasConflict = await checkAppointmentConflict(
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime
    );

    if (hasConflict) {
      return res.status(409).json({
        message: 'You already have an appointment with this doctor at this time'
      });
    }

    // Check if slot is available
    const isAvailable = await checkSlotAvailability(doctorId, appointmentDate, appointmentTime);

    if (!isAvailable) {
      return res.status(400).json({
        message: 'This time slot is not available'
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentDate: normalizeDateToStartOfDay(appointmentDate),
      appointmentTime,
      reason,
      status: 'pending'
    });

    // Book the slot
    await bookTimeSlot(doctorId, appointmentDate, appointmentTime, appointment._id);

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.APPOINTMENT_REQUESTED,
      createEvent('appointment.requested', {
        appointmentId: appointment._id.toString(),
        patientId: patientId.toString(),
        doctorId: doctorId.toString(),
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime
      })
    );

    res.status(201).json({
      message: 'Appointment request sent. Waiting for doctor confirmation.',
      appointment: {
        id: appointment._id,
        status: appointment.status,
        doctorName: doctor.fullName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: View appointment requests
 * GET /api/v1/appointments/doctor/requests
 */
export const getAppointmentRequests = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    const query = { doctorId };
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalAppointments = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(totalAppointments / parseInt(limit));

    res.status(200).json({
      appointments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Confirm appointment
 * PUT /api/v1/appointments/:appointmentId/confirm
 */
export const confirmAppointment = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(403).json({
        message: 'You can only confirm your own appointments'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending appointments can be confirmed'
      });
    }

    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    if (notes) appointment.notes = notes;

    await appointment.save();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.APPOINTMENT_CONFIRMED,
      createEvent('appointment.confirmed', {
        appointmentId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        doctorId: appointment.doctorId.toString()
      })
    );

    res.status(200).json({
      message: 'Appointment confirmed successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Reject appointment
 * PUT /api/v1/appointments/:appointmentId/reject
 */
export const rejectAppointment = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { appointmentId } = req.params;
    const { rejectionReason } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(403).json({
        message: 'You can only reject your own appointments'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending appointments can be rejected'
      });
    }

    appointment.status = 'rejected';
    appointment.rejectionReason = rejectionReason;
    appointment.rejectedAt = new Date();

    await appointment.save();

    // Free up the time slot
    await freeTimeSlot(
      appointment.doctorId,
      appointment.appointmentDate,
      appointment.appointmentTime
    );

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.APPOINTMENT_REJECTED,
      createEvent('appointment.rejected', {
        appointmentId: appointment._id.toString(),
        reason: rejectionReason
      })
    );

    res.status(200).json({
      message: 'Appointment rejected successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient: Cancel appointment
 * PUT /api/v1/appointments/:appointmentId/cancel
 */
export const cancelAppointment = async (req, res, next) => {
  try {
    const { id: patientId } = req.user;
    const { appointmentId } = req.params;
    const { cancellationReason } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    if (appointment.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({
        message: 'You can only cancel your own appointments'
      });
    }

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({
        message: 'Only pending or confirmed appointments can be cancelled'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledBy = 'patient';
    appointment.cancelledAt = new Date();

    await appointment.save();

    // Free up the time slot
    await freeTimeSlot(
      appointment.doctorId,
      appointment.appointmentDate,
      appointment.appointmentTime
    );

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.APPOINTMENT_CANCELLED,
      createEvent('appointment.cancelled', {
        appointmentId: appointment._id.toString(),
        cancelledBy: 'patient'
      })
    );

    res.status(200).json({
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointment details
 * GET /api/v1/appointments/:appointmentId
 */
export const getAppointmentDetails = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Verify user is patient or doctor of this appointment
    const isPatient = appointment.patientId.toString() === userId.toString();
    const isDoctor = appointment.doctorId.toString() === userId.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        message: 'You do not have access to this appointment'
      });
    }

    res.status(200).json({
      appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient: Get my appointments
 * GET /api/v1/appointments/patient/my-appointments
 */
export const getPatientAppointments = async (req, res, next) => {
  try {
    const { id: patientId } = req.user;
    const {
      status = 'all',
      timeFilter = 'all',
      page = 1,
      limit = 20
    } = req.query;

    const query = { patientId };

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Filter by time
    const today = normalizeDateToStartOfDay(new Date());
    if (timeFilter === 'upcoming') {
      query.appointmentDate = { $gte: today };
    } else if (timeFilter === 'past') {
      query.appointmentDate = { $lt: today };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort: upcoming (asc), past (desc)
    const sortOrder = timeFilter === 'past' ? -1 : 1;

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: sortOrder, appointmentTime: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    const totalAppointments = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(totalAppointments / parseInt(limit));

    res.status(200).json({
      appointments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Get my appointments
 * GET /api/v1/appointments/doctor/my-appointments
 */
export const getDoctorAppointments = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { date, status = 'all', page = 1, limit = 20 } = req.query;

    const query = { doctorId };

    // Filter by date
    if (date) {
      query.appointmentDate = {
        $gte: normalizeDateToStartOfDay(date),
        $lte: normalizeDateToEndOfDay(date)
      };
    }

    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalAppointments = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(totalAppointments / parseInt(limit));

    res.status(200).json({
      appointments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Mark appointment as completed
 * PUT /api/v1/appointments/:appointmentId/complete
 */
export const completeAppointment = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(403).json({
        message: 'You can only complete your own appointments'
      });
    }

    if (appointment.status !== 'confirmed') {
      return res.status(400).json({
        message: 'Only confirmed appointments can be marked as completed'
      });
    }

    appointment.status = 'completed';
    appointment.completedAt = new Date();

    await appointment.save();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.APPOINTMENT_COMPLETED,
      createEvent('appointment.completed', {
        appointmentId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        doctorId: appointment.doctorId.toString()
      })
    );

    res.status(200).json({
      message: 'Appointment marked as completed',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Referral appointment booking
 * POST /api/v1/appointments/referral-booking
 */
export const referralBooking = async (req, res, next) => {
  try {
    const { id: referringDoctorId } = req.user;
    const {
      patientId,
      targetDoctorId,
      appointmentDate,
      appointmentTime,
      referralId,
      notes
    } = req.body;

    // Verify target doctor exists
    const doctor = await fetchDoctorProfile(targetDoctorId);

    // Check if slot is available
    const isAvailable = await checkSlotAvailability(
      targetDoctorId,
      appointmentDate,
      appointmentTime
    );

    if (!isAvailable) {
      return res.status(400).json({
        message: 'This time slot is not available'
      });
    }

    // Create appointment (auto-confirmed for referrals)
    const appointment = await Appointment.create({
      patientId,
      doctorId: targetDoctorId,
      appointmentDate: normalizeDateToStartOfDay(appointmentDate),
      appointmentTime,
      status: 'confirmed',
      isReferral: true,
      referredBy: referringDoctorId,
      referralId,
      notes,
      confirmedAt: new Date()
    });

    // Book the slot
    await bookTimeSlot(targetDoctorId, appointmentDate, appointmentTime, appointment._id);

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.RDV.REFERRAL_BOOKED,
      createEvent('appointment.referral_booked', {
        appointmentId: appointment._id.toString(),
        referredBy: referringDoctorId.toString(),
        targetDoctorId: targetDoctorId.toString()
      })
    );

    res.status(201).json({
      message: 'Referral appointment booked successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor: Get appointment statistics
 * GET /api/v1/appointments/doctor/statistics
 */
export const getAppointmentStatistics = async (req, res, next) => {
  try {
    const { id: doctorId } = req.user;

    const totalAppointments = await Appointment.countDocuments({ doctorId });
    const pending = await Appointment.countDocuments({ doctorId, status: 'pending' });
    const confirmed = await Appointment.countDocuments({ doctorId, status: 'confirmed' });
    const completed = await Appointment.countDocuments({ doctorId, status: 'completed' });
    const cancelled = await Appointment.countDocuments({ doctorId, status: 'cancelled' });
    const noShow = await Appointment.countDocuments({ doctorId, status: 'no-show' });

    const today = normalizeDateToStartOfDay(new Date());
    const todayAppointments = await Appointment.countDocuments({
      doctorId,
      appointmentDate: {
        $gte: today,
        $lte: normalizeDateToEndOfDay(new Date())
      },
      status: { $in: ['confirmed', 'completed'] }
    });

    res.status(200).json({
      statistics: {
        totalAppointments,
        pending,
        confirmed,
        completed,
        cancelled,
        noShow,
        todayAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};
