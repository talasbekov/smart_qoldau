export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER');
export interface SmsProvider {
  send(phone: string, text: string): Promise<void>;
}
