export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface UserIdentity {
  sub: string;
  email: string;
}
