import { useEffect } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * GLOBAL ERROR NOTIFICATION HANDLER
 * Centralized error tracking and user notification
 */

const ERROR_CODES = {
  // Auth errors
  AUTH_REQUIRED: { severity: 'HIGH', action: 'Войдите в систему заново' },
  UNAUTHORIZED: { severity: 'HIGH', action: 'Проверьте права доступа' },
  FORBIDDEN: { severity: 'HIGH', action: 'У вас нет прав для этого действия' },
  
  // Profile errors
  NO_ACTIVE_PROFILE: { severity: 'HIGH', action: 'Активируйте профиль в Настройках' },
  PROFILE_NOT_FOUND: { severity: 'MEDIUM', action: 'Проверьте ID профиля' },
  PROFILE_LIMIT_REACHED: { severity: 'MEDIUM', action: 'Удалите профиль перед созданием нового (макс 5)' },
  INTEGRITY_VIOLATION: { severity: 'CRITICAL', action: 'Свяжитесь с поддержкой - критическая ошибка профиля' },
  
  // Data errors
  VALIDATION_ERROR: { severity: 'LOW', action: 'Проверьте введенные данные' },
  GENERATION_FAILED: { severity: 'MEDIUM', action: 'Проверьте статус профиля и повторите' },
  DELETION_FAILED: { severity: 'MEDIUM', action: 'Повторите попытку или свяжитесь с поддержкой' },
  VERIFICATION_FAILED: { severity: 'MEDIUM', action: 'Проверьте данные и повторите' },
  
  // Network/System errors
  TIMEOUT: { severity: 'MEDIUM', action: 'Проверьте интернет-соединение и повторите' },
  NETWORK_ERROR: { severity: 'MEDIUM', action: 'Проверьте подключение к интернету' },
  INTERNAL_ERROR: { severity: 'HIGH', action: 'Повторите попытку или свяжитесь с поддержкой' },
  
  // API errors
  RELAY_FAILED: { severity: 'HIGH', action: 'Свяжитесь с поддержкой - ошибка прокси' },
};

export class ErrorNotification {
  static notify(error, context = {}) {
    const errorCode = error.error_code || error.code || 'INTERNAL_ERROR';
    const errorMsg = error.error || error.message || 'Неизвестная ошибка';
    const nextStep = error.next_step || ERROR_CODES[errorCode]?.action || 'Повторите попытку';
    const severity = ERROR_CODES[errorCode]?.severity || 'MEDIUM';

    // Log for diagnostics
    const diagnosticData = {
      error_code: errorCode,
      action_name: context.action || 'unknown',
      profile_id: context.profile_id || null,
      request_id: context.request_id || null,
      timestamp: new Date().toISOString(),
      error_message: errorMsg,
      user_email: context.user_email || null
    };

    console.error('[ErrorNotification]', diagnosticData);

    // Persist to Notification entity if critical
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.persistError(diagnosticData).catch(err => {
        console.error('[ErrorNotification] Failed to persist:', err);
      });
    }

    // Show user notification
    const toastConfig = {
      duration: severity === 'CRITICAL' ? 10000 : severity === 'HIGH' ? 6000 : 4000,
      important: severity === 'CRITICAL'
    };

    const message = `❌ ${errorMsg}\n\n💡 Действие: ${nextStep}`;

    if (severity === 'CRITICAL') {
      toast.error(message, { ...toastConfig, className: 'error-critical' });
    } else if (severity === 'HIGH') {
      toast.error(message, toastConfig);
    } else if (severity === 'MEDIUM') {
      toast.warning(message, toastConfig);
    } else {
      toast.info(message, toastConfig);
    }

    return diagnosticData;
  }

  static async persistError(data) {
    try {
      await base44.entities.Notification.create({
        title: `Ошибка: ${data.error_code}`,
        message: `${data.error_message}\n\nДействие: ${data.action_name}\nВремя: ${data.timestamp}`,
        source_page: 'system',
        type: 'other',
        is_read: false,
        is_closed: false
      });
    } catch (e) {
      console.error('[ErrorNotification] Persist failed:', e);
    }
  }

  static success(message, context = {}) {
    console.log('[Success]', { message, ...context });
    toast.success(`✅ ${message}`, { duration: 3000 });
  }
}

export default function ErrorNotificationHandler() {
  useEffect(() => {
    // Global error listener for uncaught errors
    const handleError = (event) => {
      ErrorNotification.notify({
        error: event.message || 'Uncaught error',
        error_code: 'INTERNAL_ERROR'
      }, {
        action: 'window_error',
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return null;
}

// Export for use in mutations/actions
export function handleMutationError(error, context) {
  const errorData = error?.response?.data || error?.data || error;
  ErrorNotification.notify(errorData, context);
}

export function handleMutationSuccess(message, data, context) {
  ErrorNotification.success(message, { ...context, data });
}