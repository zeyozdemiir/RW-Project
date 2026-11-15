/** Kullanıcıya gösterilebilecek, beklenen iş kuralı hatası. */
export class ServiceError extends Error {
  readonly code: string;
  constructor(message: string, code = "invalid") {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function forbidden(message = "Bu işlem için yetkiniz yok."): ServiceError {
  return new ServiceError(message, "forbidden");
}

export function notFound(message = "Kayıt bulunamadı."): ServiceError {
  return new ServiceError(message, "not_found");
}
