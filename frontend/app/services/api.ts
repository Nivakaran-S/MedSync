const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:5000/api/auth';
const PATIENT_SERVICE_URL = process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL || 'http://localhost:3001/api/patients';
const DOCTOR_SERVICE_URL = process.env.NEXT_PUBLIC_DOCTOR_SERVICE_URL || 'http://localhost:3002/api/doctors';
const APPOINTMENT_SERVICE_URL = process.env.NEXT_PUBLIC_APPOINTMENT_SERVICE_URL || 'http://localhost:3003/api/appointments';
const TELEMEDICINE_SERVICE_URL = process.env.NEXT_PUBLIC_TELEMEDICINE_SERVICE_URL || 'http://localhost:3004/api/sessions';
const PAYMENT_SERVICE_URL = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || 'http://localhost:3005/api/payments';
const SYMPTOM_CHECKER_URL = process.env.NEXT_PUBLIC_SYMPTOM_CHECKER_URL || 'http://localhost:3007/api/symptom-checker';
const NOTIFICATION_SERVICE_URL = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/notify';

export const PATIENT_API_BASE = PATIENT_SERVICE_URL;

const getCookie = (name: string) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return getCookie('medsync_token') || localStorage.getItem('medsync_token');
};

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return headers;
};

const getAuthHeadersNoContentType = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return headers;
};

const parseOrThrow = async (response: Response, fallbackMessage: string) => {
  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const error = await response.json();
      if (error?.message) message = error.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return response.json();
};

export const patientApi = {
  login: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Invalid patient credentials');
  },
  register: async (data: any) => {
    const { role: _role, ...payload } = data;
    const response = await fetch(`${PATIENT_SERVICE_URL}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return parseOrThrow(response, 'Failed to register patient');
  },

  getProfile: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/profile`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch profile');
  },
  updateProfile: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/profile`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update profile');
  },

  getRecords: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch records');
  },
  addMedicalRecord: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/history`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add medical record');
  },
  addPrescription: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/prescriptions`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add prescription');
  },
  doctorIssuePrescription: async (patientId: string, data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}/prescriptions`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to issue prescription');
  },

  uploadDocument: async (formData: FormData) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/documents/upload`, {
      method: 'POST', headers: getAuthHeadersNoContentType(), body: formData,
    });
    return parseOrThrow(response, 'Failed to upload document');
  },
  getDocuments: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/documents`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch documents');
  },
  deleteDocument: async (docId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/documents/${docId}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete document');
  },

  // ── Account management ──
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/profile/change-password`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to change password');
  },
  deactivateAccount: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/profile`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to deactivate account');
  },

  // ── Allergies ──
  getAllergies: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/allergies`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch allergies');
  },
  addAllergy: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/allergies`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add allergy');
  },
  deleteAllergy: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/allergies/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to remove allergy');
  },

  // ── Vital signs ──
  getVitalSigns: async (limit?: number) => {
    const url = limit ? `${PATIENT_SERVICE_URL}/vital-signs?limit=${limit}` : `${PATIENT_SERVICE_URL}/vital-signs`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch vital signs');
  },
  addVitalSign: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/vital-signs`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add vital sign');
  },
  deleteVitalSign: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/vital-signs/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to remove vital sign');
  },

  // ── Vaccinations ──
  getVaccinations: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/vaccinations`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch vaccinations');
  },
  addVaccination: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/vaccinations`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add vaccination');
  },
  deleteVaccination: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/vaccinations/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to remove vaccination');
  },

  // ── Chronic conditions ──
  getChronicConditions: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/chronic-conditions`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch chronic conditions');
  },
  addChronicCondition: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/chronic-conditions`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add condition');
  },
  updateChronicCondition: async (id: string, data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/chronic-conditions/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update condition');
  },
  deleteChronicCondition: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/chronic-conditions/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to remove condition');
  },

  // ── Family history ──
  getFamilyHistory: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/family-history`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch family history');
  },
  addFamilyHistory: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/family-history`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add family history');
  },
  deleteFamilyHistory: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/family-history/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to remove family history');
  },

  // ── Insurance ──
  getInsurance: async () => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/insurance`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch insurance');
  },
  updateInsurance: async (data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/insurance`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update insurance');
  },

  // ── Medical history & prescriptions full CRUD ──
  updateMedicalRecord: async (id: string, data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/history/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update record');
  },
  deleteMedicalRecord: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/history/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete record');
  },
  updatePrescription: async (id: string, data: any) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/prescriptions/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update prescription');
  },
  deletePrescription: async (id: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/records/prescriptions/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete prescription');
  },

  // ── Derived analytics ──
  getHealthScore: async (patientId?: string) => {
    const url = patientId
      ? `${PATIENT_SERVICE_URL}/${patientId}/health-score`
      : `${PATIENT_SERVICE_URL}/health-score`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch health score');
  },
  getMedicalSummary: async (patientId?: string) => {
    const url = patientId
      ? `${PATIENT_SERVICE_URL}/${patientId}/summary`
      : `${PATIENT_SERVICE_URL}/summary`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch medical summary');
  },

  // ── Doctor/admin scoped ──
  getPatientFull: async (patientId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}/full`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch patient record');
  },
  getPatientProfile: async (patientId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch patient profile');
  },
  getPatientRecords: async (patientId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}/records`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch patient records');
  },
  getPatientDocuments: async (patientId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}/documents`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch patient documents');
  },
  getAuditLog: async (patientId: string) => {
    const response = await fetch(`${PATIENT_SERVICE_URL}/${patientId}/audit-log`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch audit log');
  },
  listAllPatients: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const url = qs.toString() ? `${PATIENT_SERVICE_URL}?${qs}` : PATIENT_SERVICE_URL;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to list patients');
  },
};

export const doctorApi = {
  listDoctors: async (specialty?: string) => {
    const url = specialty
      ? `${DOCTOR_SERVICE_URL}?specialty=${encodeURIComponent(specialty)}`
      : DOCTOR_SERVICE_URL;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch doctors');
  },
  getDoctor: async (id: string) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch doctor details');
  },
  updateDoctor: async (id: string, data: any) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update doctor');
  },
  login: async (data: any) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Invalid doctor credentials');
  },
  register: async (data: any) => {
    const { role: _role, ...payload } = data;
    const response = await fetch(`${DOCTOR_SERVICE_URL}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return parseOrThrow(response, 'Failed to register doctor');
  },
  getAvailability: async (id: string) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/availability`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch availability');
  },
  addAvailability: async (id: string, data: any) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/availability`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add slot');
  },
  addAvailabilityBulk: async (id: string, data: { days: string[]; slots: Array<{ startTime: string; endTime: string }> }) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/availability/bulk`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to add weekly slots');
  },
  updateAvailability: async (id: string, slotId: string, data: { day: string; startTime: string; endTime: string }) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/availability/${slotId}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update slot');
  },
  deleteAvailability: async (id: string, slotId: string) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/availability/${slotId}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete slot');
  },
  getAnalytics: async (id: string) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/analytics`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch analytics');
  },
  issuePrescription: async (data: any) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/prescriptions`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to issue prescription');
  },
  verifyPrescription: async (verificationId: string) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/prescriptions/verify/${verificationId}`);
    return parseOrThrow(response, 'Prescription not found or invalid');
  },
  updateDoctorStatus: async (id: string, isActive: boolean) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/status`, {
      method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ isActive }),
    });
    return parseOrThrow(response, 'Failed to update doctor status');
  },
  changePassword: async (id: string, data: { currentPassword?: string; newPassword: string }) => {
    const response = await fetch(`${DOCTOR_SERVICE_URL}/${id}/change-password`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to change password');
  },
};

export interface SymptomAnalyzePayload {
  symptoms: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'unspecified';
  durationDays?: number;
  bodyLocation?: string;
  additionalContext?: string;
  patientId?: string;
}

export const symptomApi = {
  analyzeSymptoms: async (payload: string | SymptomAnalyzePayload, patientId?: string) => {
    const body =
      typeof payload === 'string' ? { symptoms: payload, patientId } : payload;
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/analyze`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
    });
    return parseOrThrow(response, 'Failed to analyze symptoms');
  },
  analyzeImage: async (formData: FormData) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/analyze-image`, {
      method: 'POST', headers: getAuthHeadersNoContentType(), body: formData,
    });
    return parseOrThrow(response, 'Failed to analyze image');
  },

  // Multi-turn conversation
  startConversation: async (initialMessage: string) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/conversations`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ initialMessage }),
    });
    return parseOrThrow(response, 'Failed to start conversation');
  },
  continueConversation: async (id: string, message: string) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/conversations/${id}/messages`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ message }),
    });
    return parseOrThrow(response, 'Failed to send message');
  },
  closeConversation: async (id: string) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/conversations/${id}/close`, {
      method: 'PUT', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to close conversation');
  },
  listConversations: async (patientId?: string) => {
    const url = patientId
      ? `${SYMPTOM_CHECKER_URL}/conversations/patient/${patientId}`
      : `${SYMPTOM_CHECKER_URL}/conversations`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to list conversations');
  },

  // History & individual checks
  getHistory: async (patientId: string, page = 1, limit = 20) => {
    const response = await fetch(
      `${SYMPTOM_CHECKER_URL}/history/${patientId}?page=${page}&limit=${limit}`,
      { headers: getAuthHeaders() }
    );
    return parseOrThrow(response, 'Failed to fetch symptom history');
  },
  getCheck: async (id: string) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/checks/${id}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch check');
  },

  // Admin
  getAdminAnalytics: async () => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/admin/analytics`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch analytics');
  },

  deleteCheck: async (id: string) => {
    const response = await fetch(`${SYMPTOM_CHECKER_URL}/checks/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete check');
  },
};

export interface MedNotification {
  _id: string;
  userId: string;
  type: 'in-app' | 'email' | 'sms';
  category: 'appointment' | 'payment' | 'prescription' | 'account' | 'system' | 'other';
  title?: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  items: MedNotification[];
  page: number;
  limit: number;
  total: number;
  unread: number;
  totalPages: number;
}

export const notificationApi = {
  list: async (opts?: { unreadOnly?: boolean; page?: number; limit?: number }): Promise<NotificationListResponse> => {
    const qs = new URLSearchParams();
    if (opts?.unreadOnly) qs.set('unreadOnly', 'true');
    if (opts?.page) qs.set('page', String(opts.page));
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const url = qs.toString() ? `${NOTIFICATION_SERVICE_URL}?${qs}` : NOTIFICATION_SERVICE_URL;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch notifications');
  },
  get: async (id: string): Promise<MedNotification> => {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/${id}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch notification');
  },
  markRead: async (id: string): Promise<MedNotification> => {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/${id}/read`, {
      method: 'PATCH', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to mark notification as read');
  },
  markAllRead: async (): Promise<{ updated: number }> => {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/read-all`, {
      method: 'PATCH', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to mark notifications as read');
  },
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to delete notification');
  },
  adminTrigger: async (data: {
    userId?: string;
    email?: string;
    phone?: string;
    title?: string;
    subject?: string;
    message: string;
    category?: string;
    channels: Array<'in-app' | 'email' | 'sms'>;
  }) => {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/admin/trigger`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to trigger notification');
  },
};

export const appointmentApi = {
  createAppointment: async (data: any) => {
    const response = await fetch(APPOINTMENT_SERVICE_URL, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to book appointment');
  },
  getAppointment: async (id: string) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/${id}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch appointment');
  },
  getPatientAppointments: async (patientId: string) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/patient/${patientId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch appointments');
  },
  getDoctorAppointments: async (doctorId: string) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/doctor/${doctorId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch doctor appointments');
  },
  getBookedSlots: async (doctorId: string, date: string) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/available-slots/${doctorId}?date=${date}`);
    return parseOrThrow(response, 'Failed to fetch booked slots');
  },
  updateStatus: async (id: string, data: { status: string; cancelledBy?: string; cancellationReason?: string; notes?: string }) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/${id}/status`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to update status');
  },
  cancelAppointment: async (id: string, data?: { cancelledBy: string; cancellationReason?: string }) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(), body: JSON.stringify(data || {}),
    });
    return parseOrThrow(response, 'Failed to cancel appointment');
  },
  rescheduleAppointment: async (id: string, data: { slotDate: string; slotTime: string }) => {
    const response = await fetch(`${APPOINTMENT_SERVICE_URL}/${id}/reschedule`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to reschedule appointment');
  },
  listAllAppointments: async (status?: string) => {
    const url = status
      ? `${APPOINTMENT_SERVICE_URL}/admin/all?status=${encodeURIComponent(status)}`
      : `${APPOINTMENT_SERVICE_URL}/admin/all`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to list appointments');
  },
  adminGetAllAppointments: async () => {
    const response = await fetch(APPOINTMENT_SERVICE_URL, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch all appointments');
  },
};

export const telemedicineApi = {
  createSession: async (data: { appointmentId: string; doctorId: string; patientId: string; signalingUrl?: string }) => {
    const response = await fetch(TELEMEDICINE_SERVICE_URL, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to create session');
  },
  getSession: async (appointmentId: string) => {
    const response = await fetch(`${TELEMEDICINE_SERVICE_URL}/${appointmentId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch session');
  },
  endSession: async (appointmentId: string) => {
    const response = await fetch(`${TELEMEDICINE_SERVICE_URL}/${appointmentId}/end`, {
      method: 'PUT', headers: getAuthHeaders(),
    });
    return parseOrThrow(response, 'Failed to end session');
  },
};

export const paymentApi = {
  createCheckoutSession: async (data: { appointmentId: string; patientId: string; doctorId: string; doctorName: string; amount: number }) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/checkout`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Failed to create payment session');
  },
  getPaymentByAppointment: async (appointmentId: string) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/${appointmentId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch payment details');
  },
  getPatientPayments: async (patientId: string) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/patient/${patientId}`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch payments');
  },
  downloadReceiptPdf: async (appointmentId: string) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/${appointmentId}/receipt/pdf`, { headers: getAuthHeaders() });
    if (!response.ok) {
      let message = 'Failed to download receipt';
      try {
        const error = await response.json();
        if (error?.message) message = error.message;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `medsync-receipt-${appointmentId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },
  resendReceiptEmail: async (appointmentId: string, email?: string) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/${appointmentId}/receipt/email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(email ? { email } : {}),
    });
    return parseOrThrow(response, 'Failed to send receipt email');
  },
  listAllPayments: async () => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/admin/all`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to list payments');
  },
  adminGetAllPayments: async () => {
    const response = await fetch(PAYMENT_SERVICE_URL, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch all system payments');
  },
  refund: async (appointmentId: string, reason?: string) => {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/${appointmentId}/refund`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason }),
    });
    return parseOrThrow(response, 'Failed to issue refund');
  },
};

export const platformApi = {
  getPlatformHealth: async () => {
    const response = await fetch(`${AUTH_SERVICE_URL}/health`, { headers: getAuthHeaders() });
    return parseOrThrow(response, 'Failed to fetch platform health');
  },
};
