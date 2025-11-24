import { Kafka } from 'kafkajs';
import { createNotification } from '../services/notificationService.js';
import { getDoctorById, getPatientById, getAppointmentById } from '../utils/helpers.js';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
});

/**
 * Handle appointment confirmed event
 */
const handleAppointmentConfirmed = async (event) => {
  try {
    const { appointmentId, patientId, doctorId, scheduledDate } = event;

    // Fetch doctor and patient details
    const doctor = await getDoctorById(doctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'your doctor';

    // Format date
    const date = new Date(scheduledDate);
    const dateStr = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Create notification for patient
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Rendez-vous confirmé',
      body: `Votre rendez-vous avec ${doctorName} a été confirmé pour le ${dateStr} à ${timeStr}.`,
      type: 'appointment_confirmed',
      relatedResource: {
        resourceType: 'appointment',
        resourceId: appointmentId,
      },
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
      actionData: {
        appointmentId,
        doctorId,
        scheduledDate,
      },
    });

    console.log(`✅ Appointment confirmed notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling appointment confirmed:', error);
  }
};

/**
 * Handle appointment rejected event
 */
const handleAppointmentRejected = async (event) => {
  try {
    const { appointmentId, patientId, doctorId, reason } = event;

    const doctor = await getDoctorById(doctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'le médecin';

    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Rendez-vous refusé',
      body: `Votre demande de rendez-vous avec ${doctorName} a été refusée. ${
        reason ? `Raison: ${reason}` : ''
      }`,
      type: 'appointment_rejected',
      relatedResource: {
        resourceType: 'appointment',
        resourceId: appointmentId,
      },
      priority: 'medium',
      actionUrl: '/appointments/search',
      actionData: {
        appointmentId,
        doctorId,
        reason,
      },
    });

    console.log(`✅ Appointment rejected notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling appointment rejected:', error);
  }
};

/**
 * Handle appointment cancelled event
 */
const handleAppointmentCancelled = async (event) => {
  try {
    const { appointmentId, patientId, doctorId, cancelledBy, reason } = event;

    // Determine who to notify
    const notifyUserId = cancelledBy === 'patient' ? doctorId : patientId;
    const notifyUserType = cancelledBy === 'patient' ? 'doctor' : 'patient';

    // Get canceller's name
    let cancellerName = 'L\'autre partie';
    if (cancelledBy === 'patient') {
      const patient = await getPatientById(patientId);
      cancellerName = patient ? `${patient.firstName} ${patient.lastName}` : 'Le patient';
    } else {
      const doctor = await getDoctorById(doctorId);
      cancellerName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Le médecin';
    }

    await createNotification({
      userId: notifyUserId,
      userType: notifyUserType,
      title: 'Rendez-vous annulé',
      body: `${cancellerName} a annulé le rendez-vous. ${reason ? `Raison: ${reason}` : ''}`,
      type: 'appointment_cancelled',
      relatedResource: {
        resourceType: 'appointment',
        resourceId: appointmentId,
      },
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
      actionData: {
        appointmentId,
        cancelledBy,
        reason,
      },
    });

    console.log(`✅ Appointment cancelled notification sent to ${notifyUserType} ${notifyUserId}`);
  } catch (error) {
    console.error('Error handling appointment cancelled:', error);
  }
};

/**
 * Handle appointment reminder (scheduled 24h before)
 */
const handleAppointmentReminder = async (event) => {
  try {
    const { appointmentId, patientId, doctorId, scheduledDate } = event;

    const doctor = await getDoctorById(doctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'votre médecin';

    // Calculate reminder time (24 hours before)
    const appointmentDate = new Date(scheduledDate);
    const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);

    const dateStr = appointmentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = appointmentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Create scheduled notification
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Rappel de rendez-vous',
      body: `N'oubliez pas votre rendez-vous avec ${doctorName} demain le ${dateStr} à ${timeStr}.`,
      type: 'appointment_reminder',
      relatedResource: {
        resourceType: 'appointment',
        resourceId: appointmentId,
      },
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
      actionData: {
        appointmentId,
        doctorId,
        scheduledDate,
      },
      scheduledFor: reminderDate,
    });

    console.log(
      `✅ Appointment reminder scheduled for patient ${patientId} at ${reminderDate.toISOString()}`
    );
  } catch (error) {
    console.error('Error handling appointment reminder:', error);
  }
};

/**
 * Handle new message event
 */
const handleNewMessage = async (event) => {
  try {
    const { conversationId, senderId, receiverId, senderName, isReceiverOnline } = event;

    // Only send notification if receiver is offline
    if (isReceiverOnline) {
      console.log(`⏩ Skipping notification - receiver ${receiverId} is online`);
      return;
    }

    await createNotification({
      userId: receiverId,
      userType: 'patient', // Will be overridden by actual user type
      title: 'Nouveau message',
      body: `Vous avez reçu un nouveau message de ${senderName}`,
      type: 'new_message',
      relatedResource: {
        resourceType: 'message',
        resourceId: conversationId,
      },
      priority: 'medium',
      actionUrl: `/messages/${conversationId}`,
      actionData: {
        conversationId,
        senderId,
      },
    });

    console.log(`✅ New message notification sent to ${receiverId}`);
  } catch (error) {
    console.error('Error handling new message:', error);
  }
};

/**
 * Handle referral created event
 */
const handleReferralReceived = async (event) => {
  try {
    const { referralId, referringDoctorId, targetDoctorId, patientId, specialty } = event;

    const referringDoctor = await getDoctorById(referringDoctorId);
    const doctorName = referringDoctor
      ? `Dr. ${referringDoctor.firstName} ${referringDoctor.lastName}`
      : 'un confrère';

    // Notify target doctor
    await createNotification({
      userId: targetDoctorId,
      userType: 'doctor',
      title: 'Nouvelle orientation reçue',
      body: `Vous avez reçu une nouvelle orientation de ${doctorName} pour un patient en ${specialty}.`,
      type: 'referral_received',
      relatedResource: {
        resourceType: 'referral',
        resourceId: referralId,
      },
      priority: 'high',
      actionUrl: `/referrals/${referralId}`,
      actionData: {
        referralId,
        referringDoctorId,
        patientId,
        specialty,
      },
    });

    console.log(`✅ Referral received notification sent to doctor ${targetDoctorId}`);
  } catch (error) {
    console.error('Error handling referral received:', error);
  }
};

/**
 * Handle referral scheduled event
 */
const handleReferralScheduled = async (event) => {
  try {
    const { referralId, patientId, targetDoctorId, appointmentId, scheduledDate } = event;

    const doctor = await getDoctorById(targetDoctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'le spécialiste';

    const date = new Date(scheduledDate);
    const dateStr = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Notify patient
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Rendez-vous d\'orientation planifié',
      body: `Votre rendez-vous avec ${doctorName} a été planifié pour le ${dateStr} à ${timeStr}.`,
      type: 'referral_scheduled',
      relatedResource: {
        resourceType: 'referral',
        resourceId: referralId,
      },
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
      actionData: {
        referralId,
        appointmentId,
        targetDoctorId,
        scheduledDate,
      },
    });

    console.log(`✅ Referral scheduled notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling referral scheduled:', error);
  }
};

/**
 * Handle consultation created event
 */
const handleConsultationCreated = async (event) => {
  try {
    const { consultationId, patientId, doctorId, diagnosis, chiefComplaint, consultationDate } = event;

    const doctor = await getDoctorById(doctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'votre médecin';

    // Notify patient
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Nouvelle consultation enregistrée',
      body: `${doctorName} a enregistré les détails de votre consultation dans vos dossiers médicaux.`,
      type: 'consultation_created',
      relatedResource: {
        resourceType: 'consultation',
        resourceId: consultationId,
      },
      priority: 'medium',
      actionUrl: `/consultations/${consultationId}`,
      actionData: {
        consultationId,
        doctorId,
        diagnosis,
        chiefComplaint,
        consultationDate,
        doctorName,
      },
    });

    console.log(`✅ Consultation created notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling consultation created:', error);
  }
};

/**
 * Handle prescription created event
 */
const handlePrescriptionCreated = async (event) => {
  try {
    const { prescriptionId, patientId, doctorId, medicationCount, medications } = event;

    const doctor = await getDoctorById(doctorId);
    const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'votre médecin';

    // Notify patient
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Nouvelle ordonnance',
      body: `${doctorName} a créé une nouvelle ordonnance avec ${medicationCount} médicament${medicationCount > 1 ? 's' : ''}.`,
      type: 'prescription_created',
      relatedResource: {
        resourceType: 'prescription',
        resourceId: prescriptionId,
      },
      priority: 'high',
      actionUrl: `/prescriptions/${prescriptionId}`,
      actionData: {
        prescriptionId,
        doctorId,
        medicationCount,
        medications: medications || [],
        doctorName,
      },
    });

    console.log(`✅ Prescription created notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling prescription created:', error);
  }
};

/**
 * Handle document uploaded event
 */
const handleDocumentUploaded = async (event) => {
  try {
    const { documentId, patientId, uploadedBy, uploaderType, documentTitle, documentType } = event;

    let uploaderName = 'Un professionnel de santé';
    
    if (uploaderType === 'doctor') {
      const doctor = await getDoctorById(uploadedBy);
      uploaderName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Votre médecin';
    } else if (uploaderType === 'patient') {
      const patient = await getPatientById(uploadedBy);
      uploaderName = patient ? 'Vous' : 'Un patient';
    }

    // Notify patient (only if not self-uploaded)
    if (uploadedBy.toString() !== patientId.toString()) {
      await createNotification({
        userId: patientId,
        userType: 'patient',
        title: 'Nouveau document médical',
        body: `${uploaderName} a téléchargé un nouveau document : ${documentTitle}`,
        type: 'document_uploaded',
        relatedResource: {
          resourceType: 'document',
          resourceId: documentId,
        },
        priority: 'medium',
        actionUrl: `/documents/${documentId}`,
        actionData: {
          documentId,
          uploadedBy,
          uploaderType,
          documentTitle,
          documentType,
          uploaderName,
        },
      });

      console.log(`✅ Document uploaded notification sent to patient ${patientId}`);
    }
  } catch (error) {
    console.error('Error handling document uploaded:', error);
  }
};

/**
 * Route event to appropriate handler
 */
const handleEvent = async (topic, event) => {
  const handlers = {
    'rdv.appointment.confirmed': handleAppointmentConfirmed,
    'rdv.appointment.rejected': handleAppointmentRejected,
    'rdv.appointment.cancelled': handleAppointmentCancelled,
    'rdv.appointment.reminder': handleAppointmentReminder,
    'messaging.message.sent': handleNewMessage,
    'referral.referral.created': handleReferralReceived,
    'referral.referral.scheduled': handleReferralScheduled,
    'medical-records.consultation.created': handleConsultationCreated,
    'medical-records.prescription.created': handlePrescriptionCreated,
    'medical-records.document.uploaded': handleDocumentUploaded,
  };

  const handler = handlers[topic];

  if (handler) {
    await handler(event);
  } else {
    console.log(`⚠️  No handler found for topic: ${topic}`);
  }
};

/**
 * Start Kafka consumer
 */
export const startNotificationConsumer = async () => {
  try {
    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    // Subscribe to topics
    await consumer.subscribe({
      topics: [
        'rdv.appointment.confirmed',
        'rdv.appointment.rejected',
        'rdv.appointment.cancelled',
        'rdv.appointment.reminder',
        'messaging.message.sent',
        'referral.referral.created',
        'referral.referral.scheduled',
        'medical-records.consultation.created',
        'medical-records.prescription.created',
        'medical-records.document.uploaded',
      ],
      fromBeginning: false,
    });

    console.log('✅ Subscribed to notification topics');

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          console.log(`📨 Received event from ${topic}:`, event);
          await handleEvent(topic, event);
        } catch (error) {
          console.error(`Error processing message from ${topic}:`, error);
        }
      },
    });

    console.log('✅ Kafka consumer running');
  } catch (error) {
    console.error('Error starting Kafka consumer:', error);
    throw error;
  }
};

/**
 * Disconnect Kafka consumer
 */
export const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
    console.log('✅ Kafka consumer disconnected');
  } catch (error) {
    console.error('Error disconnecting Kafka consumer:', error);
  }
};
