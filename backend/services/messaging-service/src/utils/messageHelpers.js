import axios from 'axios';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Get user information from User Service
 */
export const getUserInfo = async (userId, token) => {
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}/api/v1/users/profile/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching user info for ${userId}:`, error.message);
    return null;
  }
};

/**
 * Get all contacts (users with conversations) for a user
 */
export const getContactsForUser = async (userId) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    });

    const contacts = conversations.map((conv) => {
      const otherParticipant = conv.getOtherParticipant(userId);
      return otherParticipant.toString();
    });

    return [...new Set(contacts)]; // Remove duplicates
  } catch (error) {
    console.error('Error getting contacts:', error.message);
    return [];
  }
};

/**
 * Format conversation for API response
 */
export const formatConversationForResponse = async (
  conversation,
  currentUserId,
  recipientInfo,
  onlineUsersMap
) => {
  const otherParticipantId = conversation.getOtherParticipant(currentUserId);
  const unreadCount = conversation.getUnreadCountForUser(currentUserId);

  // Determine if recipient is online
  const isOnline = onlineUsersMap
    ? onlineUsersMap.has(otherParticipantId.toString())
    : false;

  return {
    conversationId: conversation._id,
    conversationType: conversation.conversationType,
    recipient: {
      id: recipientInfo._id || recipientInfo.id,
      name: recipientInfo.fullName || recipientInfo.name,
      type: recipientInfo.role,
      profilePhoto: recipientInfo.profilePhoto || recipientInfo.photo,
      specialty: recipientInfo.specialty || undefined,
      isOnline,
    },
    lastMessage: conversation.lastMessage
      ? {
          content: conversation.lastMessage.content,
          timestamp: conversation.lastMessage.timestamp,
          senderId: conversation.lastMessage.senderId,
          isRead: conversation.lastMessage.isRead,
        }
      : null,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

/**
 * Format message for API response
 */
export const formatMessageForResponse = (message, senderInfo) => {
  const formatted = {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: senderInfo?.fullName || senderInfo?.name || 'Unknown',
    senderType: message.senderType,
    messageType: message.messageType,
    content: message.content,
    isRead: message.isRead,
    readAt: message.readAt,
    isDelivered: message.isDelivered,
    deliveredAt: message.deliveredAt,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
  };

  // Include attachment if present
  if (message.attachment && message.attachment.s3Url) {
    formatted.attachment = {
      fileName: message.attachment.fileName,
      fileSize: message.attachment.fileSize,
      mimeType: message.attachment.mimeType,
      url: message.attachment.s3Url,
    };
  }

  // Include metadata if present
  if (message.metadata && Object.keys(message.metadata).length > 0) {
    formatted.metadata = message.metadata;
  }

  return formatted;
};

/**
 * Calculate total unread count for user across all conversations
 */
export const calculateUnreadCount = async (userId) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    });

    let totalUnread = 0;
    const byConversation = [];

    for (const conv of conversations) {
      const unreadCount = conv.getUnreadCountForUser(userId);
      if (unreadCount > 0) {
        totalUnread += unreadCount;

        const otherParticipantId = conv.getOtherParticipant(userId);
        byConversation.push({
          conversationId: conv._id,
          otherParticipantId,
          unreadCount,
        });
      }
    }

    return { totalUnread, byConversation };
  } catch (error) {
    console.error('Error calculating unread count:', error.message);
    return { totalUnread: 0, byConversation: [] };
  }
};

/**
 * Build query for filtering conversations
 */
export const buildConversationQuery = (userId, filters) => {
  const query = {
    participants: userId,
    isActive: true,
  };

  if (filters.type && filters.type !== 'all') {
    query.conversationType = filters.type;
  }

  if (filters.isArchived !== undefined) {
    query.isArchived = filters.isArchived;
  }

  return query;
};

/**
 * Upload file to S3
 */
export const uploadFileToS3 = async (file, conversationId) => {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Date.now()}_${uuidv4()}.${fileExtension}`;
    const s3Key = `messages/${conversationId}/${fileName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private',
    };

    const uploadResult = await s3.upload(params).promise();

    return {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      s3Key,
      s3Url: uploadResult.Location,
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error.message);
    throw new Error('Failed to upload file');
  }
};

/**
 * Delete file from S3
 */
export const deleteFileFromS3 = async (s3Key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error.message);
    return false;
  }
};

/**
 * Generate signed URL for S3 file (for secure download)
 */
export const getSignedUrl = (s3Key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Expires: expiresIn, // URL expires in seconds
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error.message);
    return null;
  }
};

/**
 * Validate file attachment
 */
export const validateFileAttachment = (file) => {
  const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default

  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Allowed MIME types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const allowedTypes = [...allowedImageTypes, ...allowedDocTypes];

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }

  return true;
};

/**
 * Get user online status
 */
export const getUserOnlineStatus = (userId, onlineUsersMap) => {
  return onlineUsersMap.has(userId.toString());
};

/**
 * Determine conversation type based on participant types
 */
export const determineConversationType = (userType1, userType2) => {
  if (userType1 === 'doctor' && userType2 === 'doctor') {
    return 'doctor_doctor';
  }
  return 'patient_doctor';
};

/**
 * Check if user can message another user
 * Patient can only message their doctors
 */
export const canUserMessageRecipient = async (
  senderId,
  senderType,
  recipientId,
  recipientType
) => {
  // Doctors can message any doctor or any patient they've treated
  if (senderType === 'doctor') {
    return true; // We'll rely on existing relationship checks in other services
  }

  // Patients can only message doctors they have appointments with
  if (senderType === 'patient' && recipientType === 'doctor') {
    // Check if patient has had appointment with this doctor
    // This would require a call to RDV service
    return true; // For now, allow all patient-doctor messaging
  }

  // Patients cannot message other patients
  if (senderType === 'patient' && recipientType === 'patient') {
    return false;
  }

  return false;
};

/**
 * Calculate pagination
 */
export const calculatePagination = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasMore,
    hasPrevious,
  };
};
